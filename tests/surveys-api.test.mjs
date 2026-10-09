import test from "node:test";
import assert from "node:assert/strict";
import { onRequestPost, onRequestGet } from "../functions/api/surveys.js";

const origin = "https://hilafood.pages.dev";
function post(body, headers = {}) {
  return new Request(origin + "/api/surveys", {
    method: "POST",
    headers: { Origin: origin, "Content-Type": "application/json", ...headers },
    body: JSON.stringify(body)
  });
}
test("survey administration rejects guests before database access", async () => {
  const response = await onRequestPost({ request: post({ action: "admin-list" }), env: { ADMIN_KEY: "secret", DB: { prepare(){ throw new Error("must not query"); } } } });
  assert.equal(response.status, 403);
});
test("survey administration rejects ordinary users without admin key", async () => {
  const response = await onRequestPost({ request: post({ action: "admin-save", title: "x" }, { "x-admin-key": "wrong" }), env: { ADMIN_KEY: "secret", DB: { prepare(){ throw new Error("must not query"); } } } });
  assert.equal(response.status, 403);
});
test("survey mutations reject cross-origin requests", async () => {
  const request = new Request(origin + "/api/surveys", { method: "POST", headers: { Origin: "https://evil.example", "Content-Type": "application/json" }, body: JSON.stringify({ action: "admin-list" }) });
  const response = await onRequestPost({ request, env: { ADMIN_KEY: "secret", DB: { prepare(){ throw new Error("must not query"); } } } });
  assert.equal(response.status, 403);
});
test("survey database failures fail closed", async () => {
  const response = await onRequestPost({ request: post({ action: "admin-list" }, { "x-admin-key": "secret" }), env: { ADMIN_KEY: "secret", DB: { prepare(){ throw new Error("db down"); } } } });
  assert.equal(response.status, 503);
});
test("public survey listing returns active questions but never participant IDs or results", async () => {
  const db = {
    prepare(sql) {
      const query = { sql, args: [] };
      query.bind = (...args) => { query.args = args; return query; };
      query.all = async () => {
        if (sql.includes("FROM surveys")) return { results: [{ id: 1, title: "نمونه", description: "توضیح", status: "published" }] };
        if (sql.includes("FROM survey_questions")) return { results: [{ id: 2, survey_id: 1, prompt: "سؤال", type: "single", required: 1, sort_order: 0 }] };
        if (sql.includes("FROM survey_options")) return { results: [{ id: 3, question_id: 2, label: "گزینه اول", sort_order: 0 }, { id: 4, question_id: 2, label: "گزینه دوم", sort_order: 1 }] };
        return { results: [] };
      };
      query.first = async () => null;
      return query;
    }
  };
  const response = await onRequestGet({ request: new Request(origin + "/api/surveys"), env: { DB: db, AUTH_SECRET: "a".repeat(32) } });
  assert.equal(response.status, 200);
  const data = await response.json();
  assert.equal(data.surveys.length, 1);
  assert.equal(data.surveys[0].questions[0].options.length, 2);
  assert.equal("results" in data.surveys[0], false);
  assert.equal("user_id" in data.surveys[0], false);
  assert.equal("phone" in data.surveys[0], false);
});
test("guest votes are rejected before any survey or response write", async () => {
  const response = await onRequestPost({
    request: post({ action: "vote", survey_id: 1, answers: [] }),
    env: { AUTH_SECRET: "a".repeat(32), DB: { prepare(){ throw new Error("must not query without a session token"); } } }
  });
  assert.equal(response.status, 401);
});
test("publishing an empty survey is rejected", async () => {
  const db = {
    prepare(sql) {
      const q={sql,args:[]}; q.bind=(...args)=>{q.args=args;return q;};
      q.first=async()=>sql.includes("SELECT id, status FROM surveys")?{id:1,status:"draft"}:{total:0};
      q.run=async()=>({meta:{changes:1}});
      return q;
    }
  };
  const response = await onRequestPost({ request: post({action:"admin-publish",id:1},{"x-admin-key":"secret"}), env:{ADMIN_KEY:"secret",DB:db} });
  assert.equal(response.status,400);
});
test("a guest cannot vote merely by knowing a survey ID", async () => {
  const response = await onRequestPost({
    request: post({ action: "vote", survey_id: 1, answers: [] }),
    env: { AUTH_SECRET: "a".repeat(32), DB: { prepare(){ throw new Error("must not query without a session token"); } } }
  });
  assert.equal(response.status,401);
});
