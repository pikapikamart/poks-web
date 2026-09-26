import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { blankContent } from "@/libs/records";

const a = "00000000-0000-4000-8000-000000000001";
const b = "00000000-0000-4000-8000-000000000002";

test("migrations, RLS, conflicts, completion, and invitation lifecycle", async () => {
  const db = new PGlite();

  try {
    await db.exec(
      `create role anon;create role authenticated;create role service_role bypassrls;create schema auth;create table auth.users(id uuid primary key);create function auth.uid() returns uuid language sql as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;grant usage on schema public,auth to authenticated,service_role;grant execute on function auth.uid() to authenticated;create publication supabase_realtime;insert into auth.users values('${a}'),('${b}');`,
    );

    for (const file of readdirSync("supabase/migrations").sort()) {
      await db.exec(readFileSync(`supabase/migrations/${file}`, "utf8"));
    }

    await db.exec(
      `set role authenticated;select set_config('request.jwt.claim.sub','${a}',false);`,
    );

    const physicalTables = await db.query<{ table_name: string }>(
      "select table_name from information_schema.tables where table_schema='public' and table_type='BASE TABLE'",
    );
    const tableNames = new Set(
      physicalTables.rows.map(({ table_name }) => table_name),
    );

    assert.equal(tableNames.has("records"), false);
    assert.equal(tableNames.has("members"), false);
    assert.equal(tableNames.has("contexts"), true);
    assert.equal(tableNames.has("reminders"), true);
    assert.equal(tableNames.has("context_reminders"), true);
    assert.equal(tableNames.has("space_reminders"), true);
    assert.equal(tableNames.has("space_members"), true);

    const contextId = crypto.randomUUID();
    const contextContent = {
      ...blankContent(),
      title: "Travel checklist",
      items: [
        {
          id: crypto.randomUUID(),
          title: "Passport",
          required: true,
          completed: false,
          assignee: null,
          instructions: "",
        },
      ],
    };

    await db.query("select save_record($1,$2,0)", [
      crypto.randomUUID(),
      JSON.stringify({
        id: contextId,
        owner_id: a,
        space_id: null,
        kind: "context",
        content: contextContent,
        deleted: false,
      }),
    ]);

    const id = crypto.randomUUID();
    const operation = crypto.randomUUID();

    const content = {
      ...blankContent(),
      title: "Trip",
      items: [
        {
          id: crypto.randomUUID(),
          title: "Passport",
          required: true,
          completed: false,
          assignee: null,
          instructions: "",
        },
      ],
      completed: true,
      templateId: contextId,
    };

    const record = {
      id,
      owner_id: a,
      space_id: null,
      kind: "instance",
      content,
      deleted: false,
    };

    const save = () =>
      db.query<{
        result: { version: number; content: { completed: boolean } };
      }>("select save_record($1,$2,0) as result", [
        operation,
        JSON.stringify(record),
      ]);

    const first = await save();
    assert.equal(first.rows[0].result.content.completed, false);
    assert.deepEqual(
      (
        await db.query<{ context_id: string; reminder_id: string }>(
          "select context_id,reminder_id from context_reminders where reminder_id=$1",
          [id],
        )
      ).rows,
      [{ context_id: contextId, reminder_id: id }],
    );
    assert.equal((await save()).rows[0].result.version, 1);
    await assert.rejects(
      db.query("select save_record($1,$2,0)", [
        crypto.randomUUID(),
        JSON.stringify(record),
      ]),
      /CONFLICT/,
    );
    await db.exec(`select set_config('request.jwt.claim.sub','${b}',false);`);
    assert.equal((await db.query("select * from reminders")).rows.length, 0);
    await assert.rejects(
      db.query("select save_record($1,$2,1)", [
        crypto.randomUUID(),
        JSON.stringify(record),
      ]),
      /FORBIDDEN/,
    );
    await db.exec(`select set_config('request.jwt.claim.sub','${a}',false);`);

    const space = (
      await db.query<{ id: string }>("select (create_space('Family')).id")
    ).rows[0].id;

    const token = (
      await db.query<{ token: string }>("select (invite($1,'viewer')).token", [
        space,
      ])
    ).rows[0].token;

    await db.query("select save_record($1,$2,1)", [
      crypto.randomUUID(),
      JSON.stringify({ ...record, space_id: space }),
    ]);
    assert.deepEqual(
      (
        await db.query<{ space_id: string; reminder_id: string }>(
          "select space_id,reminder_id from space_reminders where reminder_id=$1",
          [id],
        )
      ).rows,
      [{ space_id: space, reminder_id: id }],
    );
    await db.exec(`select set_config('request.jwt.claim.sub','${b}',false);`);
    await db.query("select accept_invite($1)", [token]);
    assert.equal((await db.query("select * from reminders")).rows.length, 1);
    await assert.rejects(
      db.query("select save_record($1,$2,2)", [
        crypto.randomUUID(),
        JSON.stringify({ ...record, space_id: space }),
      ]),
      /FORBIDDEN/,
    );
    await db.exec(`select set_config('request.jwt.claim.sub','${a}',false);`);
    await db.query("select manage_member($1,$2,'editor')", [space, b]);
    await db.exec(`select set_config('request.jwt.claim.sub','${b}',false);`);
    await db.query("select save_record($1,$2,2)", [
      crypto.randomUUID(),
      JSON.stringify({
        ...record,
        space_id: space,
        content: {
          ...content,
          items: content.items.map((i) => ({ ...i, completed: true })),
        },
      }),
    ]);
    assert.equal(
      (
        await db.query<{ content: { completed: boolean } }>(
          "select content from reminders",
        )
      ).rows[0].content.completed,
      true,
    );
    await db.exec(`select set_config('request.jwt.claim.sub','${a}',false);`);
    const completionInbox = await db.query<{ body: string }>(
      "select body from inbox order by created_at",
    );

    assert.deepEqual(completionInbox.rows, [
      { body: "Step completed: Passport" },
    ]);
    await db.exec(`select set_config('request.jwt.claim.sub','${b}',false);`);
    const completed = (
      await db.query<{
        content: typeof content;
        version: number;
      }>("select content,version from reminders where id=$1", [id])
    ).rows[0];

    await assert.rejects(
      db.query("select save_record($1,$2,$3)", [
        crypto.randomUUID(),
        JSON.stringify({
          ...record,
          space_id: space,
          content: {
            ...completed.content,
            items: completed.content.items.map((item) => ({
              ...item,
              completed: false,
            })),
          },
        }),
        completed.version,
      ]),
      /CANNOT_EDIT_COMPLETED/,
    );
    await db.query("select save_record($1,$2,$3)", [
      crypto.randomUUID(),
      JSON.stringify({
        ...record,
        space_id: space,
        content: completed.content,
        deleted: true,
      }),
      completed.version,
    ]);
    await db.exec(`select set_config('request.jwt.claim.sub','${a}',false);`);
    await db.query("select manage_member($1,$2,null)", [space, b]);
    await db.exec(`select set_config('request.jwt.claim.sub','${b}',false);`);
    assert.equal((await db.query("select * from reminders")).rows.length, 0);
  } finally {
    await db.close();
  }
});
