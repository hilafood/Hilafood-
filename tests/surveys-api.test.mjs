import test from "node:test";
import assert from "node:assert/strict";
import { onRequestPost, onRequestGet } from "../functions/api/surveys.js";
import { hashSessionToken } from "../functions/lib/auth.mjs";

const origin = "https://hilafood.pages.dev";
const authSecret = "survey-test-secret-that-is-long-enough-32";
const token = "T".repeat(48);
const tokenHash = await hashSessionToken(authSecret, token);
function post(body, headers = {}) {
  return new Request(origin + "/api/surveys", {
    method: "POST",
    headers: { Origin: origin, "Content-Type": "application/json", ...headers },
    body: JSON.stringify(body)
  });
}
function adminEnv(db) { return { ADMIN_KEY: "secret", DB: db }; }
function makeDb(initialStatus = "published") {
  const state = { status: initialStatus, responses: new Set(), answers: [], batches: 0 };
  const db = {
    state,
    prepare(sql) {
      const query = { sql, args: [] };
      query.bind = (...args) => { query.args = args; return query; };
      query.first = async () => {
        if (sql.includes("FROM auth_sessions")) return {
          id: "user-1", phone: "09000000001", phone_verified_at: "2026-10-01T00:00:00.000Z",
          session_id: "session-1", expires_at: "2099-01-01T00:00:00.000Z", revoked_at: null
        };
        if (sql.includes("SELECT id, status FROM surveys") || sql.includes("SELECT status FROM surveys")) {
          return { id: 1, status: state.status };
        }
        if (sql.includes("COUNT(*) AS total FROM survey_questions")) return { total: 1 };
        if (sql.includes("COUNT(*) AS total FROM survey_responses")) return { total: state.responses.size };
        return null;
      };
      query.all = async () => {
        if (sql.includes("FROM surveys s")) return { results: [{id:1,title:"نمونه",description:"",status:state.status,participants:state.responses.size}] };
        if (sql.includes("FROM surveys") && sql.includes("ORDER BY updated_at")) return { results: [{ id:1,title:"نمونه",description:"",status:state.status }] };
        if (sql.includes("FROM survey_questions")) return { results: [{ id: 2, survey_id: 1, prompt: "سؤال", type: "single", required: 1, sort_order: 0 }] };
        if (sql.includes("FROM survey_options")) return { results: [{ id: 3, question_id: 2, label: "گزینه اول", sort_order: 0 }, { id: 4, question_id: 2, label: "گزینه دوم", sort_order: 1 }] };
        return { results: [] };
      };
      query.run = async () => {
        if (sql.includes("UPDATE surveys SET status")) state.status = query.args[0];
        if (sql.includes("INSERT INTO surveys")) return { meta: { last_row_id: 1, changes: 1 } };
        if (sql.includes("INSERT INTO survey_questions")) return { meta: { last_row_id: 2, changes: 1 } };
        return { meta: { changes: 1 } };
      };
      return query;
    },
    async batch(statements) {
      state.batches++;
      const first = statements[0];
      if (state.status !== "published") return [{ meta: { changes: 0 } }];
      const responseKey = first.args[1] + ":" + first.args[2];
      if (state.responses.has(responseKey)) throw new Error("UNIQUE constraint failed: survey_responses.survey_id, survey_responses.user_id");
      state.responses.add(responseKey);
      for (const statement of statements.slice(1)) state.answers.push(statement.args);
      return statements.map((_, index) => ({ meta: { changes: index === 0 ? 1 : 1 } }));
    }
  };
  return db;
}
function voteRequest(body) {
  return new Request(origin + "/api/surveys", {
    method: "POST",
    headers: { Origin: origin, "Content-Type": "application/json", Cookie: "hilafood_session=" + token },
    body: JSON.stringify(body)
  });
}
const userEnv = db => ({ DB: db, AUTH_SECRET: authSecret });

test("survey administration rejects guests before database access", async () => {
  const response = await onRequestPost({ request: post({ action: "admin-list" }), env: adminEnv({ prepare(){ throw new Error("must not query"); } }) });
  assert.equal(response.status, 403);
});
test("survey administration rejects ordinary users without admin key", async () => {
  const response = await onRequestPost({ request: post({ action: "admin-save", title: "x" }, { "x-admin-key": "wrong" }), env: adminEnv({ prepare(){ throw new Error("must not query"); } }) });
  assert.equal(response.status, 403);
});
test("survey mutations reject cross-origin requests", async () => {
  const request = new Request(origin + "/api/surveys", { method: "POST", headers: { Origin: "https://evil.example", "Content-Type": "application/json" }, body: JSON.stringify({ action: "admin-list" }) });
  const response = await onRequestPost({ request, env: adminEnv({ prepare(){ throw new Error("must not query"); } }) });
  assert.equal(response.status, 403);
});
test("survey database failures fail closed", async () => {
  const response = await onRequestPost({ request: post({ action: "admin-list" }, { "x-admin-key": "secret" }), env: adminEnv({ prepare(){ throw new Error("db down"); } }) });
  assert.equal(response.status, 503);
});
test("admin can create a draft with questions and options", async () => {
  const db = makeDb("draft");
  const response = await onRequestPost({ request: post({
    action:"admin-save", title:"نظرسنجی جدید", description:"توضیح",
    questions:[{prompt:"سؤال",type:"single",required:true,options:["گزینه الف","گزینه ب"]}]
  }, {"x-admin-key":"secret"}), env:adminEnv(db) });
  assert.equal(response.status, 200);
  const data = await response.json();
  assert.equal(data.status, "draft");
  assert.equal(data.id, 1);
});
test("admin can close a published survey", async () => {
  const db = makeDb("published");
  const response = await onRequestPost({ request: post({action:"admin-close",id:1},{"x-admin-key":"secret"}), env:adminEnv(db) });
  assert.equal(response.status, 200);
  assert.equal(db.state.status, "closed");
});
test("public survey listing returns active questions but never participant IDs or results", async () => {
  const db = makeDb("published");
  const response = await onRequestGet({ request: new Request(origin + "/api/surveys"), env: userEnv(db) });
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
    env: { AUTH_SECRET: authSecret, DB: { prepare(){ throw new Error("must not query without a session token"); } } }
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
  const response = await onRequestPost({ request: post({action:"admin-publish",id:1},{"x-admin-key":"secret"}), env:adminEnv(db) });
  assert.equal(response.status,400);
});
test("valid verified-user vote is recorded once", async () => {
  const db = makeDb("published");
  const response = await onRequestPost({ request: voteRequest({action:"vote",survey_id:1,answers:[{question_id:2,option_id:3}]}), env:userEnv(db) });
  assert.equal(response.status,201);
  assert.equal(db.state.responses.size,1);
  assert.equal(db.state.answers.length,1);
});
test("repeat voting by the same account is rejected", async () => {
  const db = makeDb("published");
  const body = {action:"vote",survey_id:1,answers:[{question_id:2,option_id:3}]};
  assert.equal((await onRequestPost({request:voteRequest(body),env:userEnv(db)})).status,201);
  assert.equal((await onRequestPost({request:voteRequest(body),env:userEnv(db)})).status,409);
  assert.equal(db.state.responses.size,1);
});
test("vote is rejected after the survey is closed", async () => {
  const db = makeDb("closed");
  const response = await onRequestPost({ request: voteRequest({action:"vote",survey_id:1,answers:[{question_id:2,option_id:3}]}), env:userEnv(db) });
  assert.equal(response.status,409);
  assert.equal(db.state.responses.size,0);
});
test("an option belonging to another question is rejected", async () => {
  const db = makeDb("published");
  const response = await onRequestPost({ request: voteRequest({action:"vote",survey_id:1,answers:[{question_id:2,option_id:999}]}), env:userEnv(db) });
  assert.equal(response.status,400);
  assert.equal(db.state.responses.size,0);
});
