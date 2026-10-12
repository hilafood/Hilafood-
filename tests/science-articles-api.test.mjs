import test from "node:test";
import assert from "node:assert/strict";
import { onRequestDelete, onRequestGet, onRequestPost, onRequestPut } from "../functions/api/science-articles.js";

const origin = "https://hilafood.pages.dev";
const adminKey = "test-admin-key";
const sample = {
  title: "تغذیه نمونه",
  summary: "خلاصه آموزشی",
  content: "متن آموزشی برای آزمون.",
  topic: "تغذیه زنان",
  prepared_at: "2026-10-12",
  sources: [{ title: "WHO", url: "https://www.who.int/" }]
};

function request(method, body, admin = false) {
  return new Request(origin + "/api/science-articles", {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(admin ? { "x-admin-key": adminKey } : {})
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) })
  });
}

function makeDb() {
  const state = { rows: [], nextId: 1 };
  return {
    state,
    prepare(sql) {
      let args = [];
      const stmt = {
        bind(...values) { args = values; return stmt; },
        async all() {
          const publicOnly = sql.includes("WHERE status = 'published'");
          const rows = publicOnly ? state.rows.filter(r => r.status === "published") : state.rows;
          return { results: rows.slice().sort((a,b) => b.id-a.id).map(r => ({...r})) };
        },
        async run() {
          if (sql.includes("INSERT INTO science_articles")) {
            if (state.rows.some(r => r.duplicate_key === args[6])) throw new Error("UNIQUE constraint failed: science_articles.duplicate_key");
            const row = {
              id: state.nextId++, title: args[0], summary: args[1], content: args[2],
              topic: args[3], prepared_at: args[4], sources: args[5],
              status: "draft", duplicate_key: args[6], published_at: null,
              created_at: "test", updated_at: "test"
            };
            state.rows.push(row);
            return { meta: { last_row_id: row.id, changes: 1 } };
          }
          const id = Number(args[args.length - 1]);
          const row = state.rows.find(r => r.id === id);
          if (!row) return { meta: { changes: 0 } };
          if (sql.includes("SET status = 'published'")) {
            if (row.status === "rejected") return { meta: { changes: 0 } };
            row.status = "published"; row.published_at = "test"; return { meta: { changes: 1 } };
          }
          if (sql.includes("SET status = 'rejected'")) {
            row.status = "rejected"; row.published_at = null; return { meta: { changes: 1 } };
          }
          if (sql.includes("SET title =")) {
            if (state.rows.some(r => r.id !== id && r.duplicate_key === args[6])) throw new Error("UNIQUE constraint failed: science_articles.duplicate_key");
            Object.assign(row, { title: args[0], summary: args[1], content: args[2], topic: args[3], prepared_at: args[4], sources: args[5], duplicate_key: args[6], status: "draft", published_at: null });
            return { meta: { changes: 1 } };
          }
          if (sql.includes("DELETE FROM science_articles")) {
            state.rows = state.rows.filter(r => r.id !== id);
            return { meta: { changes: 1 } };
          }
          return { meta: { changes: 0 } };
        }
      };
      return stmt;
    }
  };
}
const env = db => ({ DB: db, ADMIN_KEY: adminKey });

test("public readers only receive published science articles", async () => {
  const db = makeDb();
  const draft = await onRequestPost({ request: request("POST", sample, true), env: env(db) });
  assert.equal(draft.status, 201);
  const publicResponse = await onRequestGet({ request: request("GET"), env: env(db) });
  assert.deepEqual((await publicResponse.json()).articles, []);
  const adminResponse = await onRequestGet({ request: request("GET", undefined, true), env: env(db) });
  assert.equal((await adminResponse.json()).articles[0].status, "draft");
});

test("only an authenticated admin can create, publish, reject, or delete articles", async () => {
  const db = makeDb();
  assert.equal((await onRequestPost({ request: request("POST", sample), env: env(db) })).status, 401);
  await onRequestPost({ request: request("POST", sample, true), env: env(db) });
  assert.equal((await onRequestPut({ request: request("PUT", { id: 1, action: "publish" }), env: env(db) })).status, 401);
  assert.equal((await onRequestDelete({ request: request("DELETE", { id: 1 }), env: env(db) })).status, 401);
  assert.equal(db.state.rows[0].status, "draft");
});

test("publishing requires explicit admin action and public API exposes it only after publish", async () => {
  const db = makeDb();
  await onRequestPost({ request: request("POST", sample, true), env: env(db) });
  const deniedAction = await onRequestPut({ request: request("PUT", { id: 1, status: "published" }, true), env: env(db) });
  assert.equal(deniedAction.status, 400);
  assert.equal(db.state.rows[0].status, "draft");
  const published = await onRequestPut({ request: request("PUT", { id: 1, action: "publish" }, true), env: env(db) });
  assert.equal(published.status, 200);
  const publicResponse = await onRequestGet({ request: request("GET"), env: env(db) });
  assert.equal((await publicResponse.json()).articles.length, 1);
});

test("rejects invalid source URLs and malformed article fields", async () => {
  const db = makeDb();
  for (const bad of [
    { ...sample, sources: [{ title: "bad", url: "javascript:alert(1)" }] },
    { ...sample, sources: [{ title: "bad", url: "https://user:pass@example.com" }] },
    { ...sample, prepared_at: "2026-02-31" },
    { ...sample, topic: "topic-injected" },
    { ...sample, sources: [] }
  ]) {
    const response = await onRequestPost({ request: request("POST", bad, true), env: env(db) });
    assert.equal(response.status, 400);
  }
  assert.equal(db.state.rows.length, 0);
});

test("duplicate articles are rejected and edits return published articles to draft", async () => {
  const db = makeDb();
  await onRequestPost({ request: request("POST", sample, true), env: env(db) });
  const duplicate = await onRequestPost({ request: request("POST", { ...sample, title: " تغذیه نمونه " }, true), env: env(db) });
  assert.equal(duplicate.status, 409);
  await onRequestPut({ request: request("PUT", { id: 1, action: "publish" }, true), env: env(db) });
  const edited = await onRequestPut({ request: request("PUT", { ...sample, id: 1, title: "عنوان ویرایش‌شده", action: "edit" }, true), env: env(db) });
  assert.equal(edited.status, 200);
  assert.equal(db.state.rows[0].status, "draft");
  assert.equal(db.state.rows[0].published_at, null);
});
