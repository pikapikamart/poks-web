import test from "node:test";
import assert from "node:assert/strict";
import { blankContent } from "@/libs/records";
import { defaultPreferences } from "@/libs/preferences";
import { database, asUser, asAdmin, alice, bob } from "./helpers/database";

test("database validation, grants, review concurrency, leases and deletion recovery", async (t) => {
  const db = await database();
  t.after(() => db.close());

  const record = (title = "Memory") => ({
    id: crypto.randomUUID(),
    owner_id: alice,
    space_id: null as string | null,
    kind: "reminder",
    content: { ...blankContent(), title },
    deleted: false,
  });

  const save = (r: ReturnType<typeof record>, version = 0) =>
    db.query<{ result: { version: number; content: unknown } }>(
      "select save_record($1,$2,$3) as result",
      [crypto.randomUUID(), JSON.stringify(r), version],
    );

  await t.test(
    "anonymous and authenticated roles cannot call internal functions",
    async () => {
      for (const role of ["anon", "authenticated"]) {
        for (const fn of [
          "save_record_internal(uuid,jsonb,integer)",
          "cleanup_account(uuid)",
          "check_review_sources(jsonb)",
          "reschedule_user(uuid)",
          "consume_api_rate(text,text,integer,integer)",
          "finish_device_attempt(uuid,uuid,text,text,text,text)",
        ]) {
          const { rows } = await db.query<{ allowed: boolean }>(
            "select has_function_privilege($1,$2,'execute') as allowed",
            [role, `public.${fn}`],
          );

          assert.equal(rows[0].allowed, false, `${role} ${fn}`);
        }
      }

      assert.equal(
        (
          await db.query<{ allowed: boolean }>(
            "select has_function_privilege('anon','public.space_role(uuid)','execute') as allowed",
          )
        ).rows[0].allowed,
        false,
      );
    },
  );
  await asAdmin(db);
  await t.test(
    "rate limits atomically report the remaining requests and reset time",
    async () => {
      const args = [`user:${alice}`, "ai-process", 2, 60];
      const first = await db.query<{
        allowed: boolean;
        remaining: number;
        request_limit: number;
        reset_at: string;
      }>("select * from consume_api_rate($1,$2,$3,$4)", args);
      const second = await db.query<{
        allowed: boolean;
        remaining: number;
        reset_at: string;
      }>("select * from consume_api_rate($1,$2,$3,$4)", args);
      const third = await db.query<{
        allowed: boolean;
        remaining: number;
        reset_at: string;
      }>("select * from consume_api_rate($1,$2,$3,$4)", args);

      assert.deepEqual(
        {
          allowed: first.rows[0].allowed,
          remaining: first.rows[0].remaining,
          request_limit: first.rows[0].request_limit,
        },
        { allowed: true, remaining: 1, request_limit: 2 },
      );
      assert.deepEqual(
        {
          allowed: second.rows[0].allowed,
          remaining: second.rows[0].remaining,
        },
        { allowed: true, remaining: 0 },
      );
      assert.deepEqual(
        { allowed: third.rows[0].allowed, remaining: third.rows[0].remaining },
        { allowed: false, remaining: 0 },
      );
      assert.equal(
        new Date(first.rows[0].reset_at).getTime(),
        new Date(second.rows[0].reset_at).getTime(),
      );
      assert.equal(
        new Date(second.rows[0].reset_at).getTime(),
        new Date(third.rows[0].reset_at).getTime(),
      );
    },
  );
  await asUser(db);
  await t.test(
    "direct writes reject malformed fields and null versions",
    async () => {
      for (const bad of [
        { priority: null },
        { nudgeMinutes: null },
        { nudgeMinutes: 1.5 },
        { notes: 7 },
        { dueDate: "2026-02-30" },
        { dueAt: "tomorrow" },
        { archived: null },
        { items: [{ id: crypto.randomUUID(), title: "Missing flags" }] },
      ]) {
        const r = record();
        Object.assign(r.content, bad);
        await assert.rejects(save(r));
      }

      await assert.rejects(
        db.query("select save_record($1,$2,null)", [
          crypto.randomUUID(),
          JSON.stringify(record()),
        ]),
        /INVALID_OPERATION/,
      );
      await assert.rejects(
        db.query("insert into profiles(id,preferences) values($1,$2)", [
          alice,
          JSON.stringify({ ...defaultPreferences, snoozeMinutes: null }),
        ]),
        /INVALID_PREFERENCES/,
      );
    },
  );
  const r = record("Review me");
  await save(r);
  await t.test("record kind cannot bypass structured completion", async () => {
    await assert.rejects(
      save({ ...r, kind: "context" }, 1),
      /INVALID_KIND_CHANGE/,
    );
  });
  let review: string;
  await asAdmin(db);
  review = (
    await db.query<{ id: string }>(
      "insert into ai_reviews(user_id,sources) values($1,$2) returning id",
      [alice, JSON.stringify({ [r.id]: { ...r, version: 1 } })],
    )
  ).rows[0].id;
  await asUser(db);

  const request = crypto.randomUUID();
  const body = { actions: ["one"] };

  const action = {
    operationId: crypto.randomUUID(),
    expectedVersion: 1,
    record: { ...r, content: { ...r.content, title: "Reviewed change" } },
  };

  const prepare = (req = request, payload = body, actions = [action]) =>
    db.query<{ id: string }>("select prepare_proposal($1,$2,$3,$4) as id", [
      review,
      req,
      JSON.stringify(payload),
      JSON.stringify(actions),
    ]);

  const proposal = (await prepare()).rows[0].id;
  await t.test(
    "preparation retries are stable and body reuse conflicts",
    async () => {
      assert.equal((await prepare()).rows[0].id, proposal);
      await assert.rejects(
        prepare(request, { actions: ["different"] }),
        /IDEMPOTENCY_CONFLICT/,
      );
    },
  );
  await t.test(
    "changes during review conflict at preparation and application",
    async () => {
      await save(
        { ...r, content: { ...r.content, title: "Another device" } },
        1,
      );
      await assert.rejects(prepare(crypto.randomUUID()), /CONFLICT/);
      await assert.rejects(
        db.query("select apply_proposal($1)", [proposal]),
        /CONFLICT/,
      );
    },
  );
  await t.test(
    "proposal application is atomic and replay returns identical records after expiry",
    async () => {
      const first = record("First");
      const second = record("Invalid second");

      const actions = [first, second].map((rec) => ({
        operationId: crypto.randomUUID(),
        expectedVersion: 0,
        record: rec,
      }));

      await asAdmin(db);
      const invalid = JSON.parse(JSON.stringify(actions));
      invalid[1].record.content.priority = null;

      const bad = (
        await db.query<{ id: string }>(
          "insert into ai_proposals(user_id,actions) values($1,$2) returning id",
          [alice, JSON.stringify(invalid)],
        )
      ).rows[0].id;

      await asUser(db);
      await assert.rejects(db.query("select apply_proposal($1)", [bad]));
      assert.equal(
        (await db.query("select id from records where id=$1", [first.id])).rows
          .length,
        0,
      );
      await asAdmin(db);

      const good = (
        await db.query<{ id: string }>(
          "insert into ai_proposals(user_id,actions) values($1,$2) returning id",
          [alice, JSON.stringify(actions)],
        )
      ).rows[0].id;

      await asUser(db);

      const result = await db.query("select apply_proposal($1) as records", [
        good,
      ]);

      await asAdmin(db);
      await db.query(
        "update ai_proposals set expires_at=now()-interval '1 day' where id=$1",
        [good],
      );
      await asUser(db);
      assert.deepEqual(
        (await db.query("select apply_proposal($1) as records", [good])).rows,
        result.rows,
      );
    },
  );
  let space: string;
  let token: string;
  await t.test(
    "a fixed invitation link can add a removed member again",
    async () => {
      space = (
        await db.query<{ id: string }>("select (create_space('Team')).id")
      ).rows[0].id;
      token = (
        await db.query<{ token: string }>(
          "select (invite($1,'editor')).token",
          [space],
        )
      ).rows[0].token;
      await asUser(db, bob);
      await db.query("select accept_invite($1)", [token]);
      await db.query("select accept_invite($1)", [token]);
      await asUser(db);
      await db.query("select manage_member($1,$2,null)", [space, bob]);
      await asUser(db, bob);
      await db.query("select accept_invite($1)", [token]);
      const member = await db.query<{ role: string }>(
        "select role from members where space_id=$1 and user_id=$2",
        [space, bob],
      );
      assert.equal(member.rows[0].role, "editor");
      await asUser(db);
    },
  );
  await t.test(
    "preference changes reschedule without causing content version conflicts",
    async () => {
      await db.query("insert into profiles(id,preferences) values($1,$2)", [
        alice,
        JSON.stringify(defaultPreferences),
      ]);

      const before = (
        await db.query("select version from records where id=$1", [r.id])
      ).rows;

      await db.query("update profiles set preferences=$2 where id=$1", [
        alice,
        JSON.stringify({ ...defaultPreferences, intensity: "subtle" }),
      ]);
      assert.deepEqual(
        (await db.query("select version from records where id=$1", [r.id]))
          .rows,
        before,
      );
      await asAdmin(db);
      assert.ok(
        (
          await db.query<{ generation: number }>(
            "select generation from notification_epochs where user_id=$1",
            [alice],
          )
        ).rows[0].generation > 0,
      );
      await asUser(db);
    },
  );
  await t.test(
    "expired worker cannot persist device results or overwrite a reclaimed lease",
    async () => {
      await asAdmin(db);

      const id = (
        await db.query<{ id: string }>(
          "insert into deliveries(record_id,revision,user_id,kind,due_at) values($1,2,$2,'due',now()) returning id",
          [r.id, alice],
        )
      ).rows[0].id;

      const first = (
        await db.query<{ claim_token: string }>(
          "select * from claim_deliveries(1)",
        )
      ).rows[0];

      await db.query(
        "insert into device_deliveries(delivery_id,token) values($1,'device')",
        [id],
      );
      await db.query(
        "update deliveries set lease_until=now()-interval '1 second' where id=$1",
        [id],
      );

      const second = (
        await db.query<{ claim_token: string }>(
          "select * from claim_deliveries(1)",
        )
      ).rows[0];

      assert.notEqual(first.claim_token, second.claim_token);
      assert.equal(
        (
          await db.query<{ ok: boolean }>(
            "select finish_device_attempt($1,$2,'device','accepted','ticket',null) as ok",
            [id, first.claim_token],
          )
        ).rows[0].ok,
        false,
      );
      assert.equal(
        (
          await db.query<{ ok: boolean }>(
            "select finish_device_attempt($1,$2,'device','accepted','ticket',null) as ok",
            [id, second.claim_token],
          )
        ).rows[0].ok,
        true,
      );
      await asUser(db);
    },
  );
  await t.test(
    "transient receipt failures retry only the affected device and ignore stale receipts",
    async () => {
      await asAdmin(db);

      const job = (
        await db.query<{ id: string }>(
          "select id from deliveries where record_id=$1 and kind='due'",
          [r.id],
        )
      ).rows[0].id;

      await db.query("update deliveries set status='sent' where id=$1", [job]);
      await db.query(
        "select record_push_receipt($1,'device','ticket','MessageRateExceeded')",
        [job],
      );
      assert.equal(
        (
          await db.query<{ status: string }>(
            "select status from device_deliveries where delivery_id=$1",
            [job],
          )
        ).rows[0].status,
        "pending",
      );
      assert.equal(
        (
          await db.query<{ status: string }>(
            "select status from deliveries where id=$1",
            [job],
          )
        ).rows[0].status,
        "pending",
      );
      await db.query(
        "select record_push_receipt($1,'device','ticket','DeviceNotRegistered')",
        [job],
      );
      assert.equal(
        (
          await db.query<{ status: string }>(
            "select status from device_deliveries where delivery_id=$1",
            [job],
          )
        ).rows[0].status,
        "pending",
      );
      await asUser(db);
    },
  );
  await t.test(
    "recurrences create independent instances and preserve the calendar anchor",
    async () => {
      const recurring = record("Monthly responsibility");
      recurring.content = {
        ...recurring.content,
        dueDate: "2026-01-31",
        recurrence: "monthly",
      };
      await save(recurring);
      await asAdmin(db);
      const content = { ...recurring.content, dueDate: "2026-02-28" };

      const next = (
        await db.query<{ id: string }>(
          "select spawn_occurrence($1,1,$2) as id",
          [recurring.id, JSON.stringify(content)],
        )
      ).rows[0].id;

      assert.equal(
        (
          await db.query<{ id: string }>(
            "select spawn_occurrence($1,1,$2) as id",
            [recurring.id, JSON.stringify(content)],
          )
        ).rows[0].id,
        next,
      );

      const rows = (
        await db.query<{
          id: string;
          recurrence_anchor: string;
          content: { completed: boolean };
        }>(
          "select id,recurrence_anchor,content from records where id in ($1,$2)",
          [recurring.id, next],
        )
      ).rows;

      assert.equal(rows.length, 2);
      assert.ok(
        rows.every(
          (r) => !r.content.completed && r.recurrence_anchor === "2026-01-31",
        ),
      );
      await asUser(db);
    },
  );
  await t.test(
    "account deletion blocks new mutations and cleanup safely retries",
    async () => {
      await assert.rejects(
        db.query("select prepare_account_deletion()"),
        /TRANSFER_OWNERSHIP_FIRST/,
      );
      await db.query("select delete_space($1)", [space]);
      await db.query("select prepare_account_deletion()");
      await db.query("select prepare_account_deletion()");
      await assert.rejects(save(record()), /DELETING/);
      await assert.rejects(
        db.query("select create_space('Race')"),
        /ACCOUNT_DELETING/,
      );
      await asAdmin(db);
      await db.query("select cleanup_account($1)", [alice]);
      await db.query("select cleanup_account($1)", [alice]);
      assert.equal(
        (await db.query("select id from records where owner_id=$1", [alice]))
          .rows.length,
        0,
      );
      assert.equal(
        (
          await db.query<{ attempts: number }>(
            "select attempts from account_deletions where user_id=$1",
            [alice],
          )
        ).rows[0].attempts,
        2,
      );
      await db.query("delete from auth.users where id=$1", [alice]);
    },
  );
});
