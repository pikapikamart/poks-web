import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { blankContent } from "@/libs/records";

const a = "00000000-0000-4000-8000-000000000001",
  b = "00000000-0000-4000-8000-000000000002";

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

    const id = crypto.randomUUID(),
      operation = crypto.randomUUID();

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
    assert.equal((await save()).rows[0].result.version, 1);
    await assert.rejects(
      db.query("select save_record($1,$2,0)", [
        crypto.randomUUID(),
        JSON.stringify(record),
      ]),
      /CONFLICT/,
    );
    await db.exec(`select set_config('request.jwt.claim.sub','${b}',false);`);
    assert.equal((await db.query("select * from records")).rows.length, 0);
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
    await db.exec(`select set_config('request.jwt.claim.sub','${b}',false);`);
    await db.query("select accept_invite($1)", [token]);
    assert.equal((await db.query("select * from records")).rows.length, 1);
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
          "select content from records",
        )
      ).rows[0].content.completed,
      true,
    );
    await db.exec(`select set_config('request.jwt.claim.sub','${a}',false);`);
    await db.query("select manage_member($1,$2,null)", [space, b]);
    await db.exec(`select set_config('request.jwt.claim.sub','${b}',false);`);
    assert.equal((await db.query("select * from records")).rows.length, 0);
  } finally {
    await db.close();
  }
});
