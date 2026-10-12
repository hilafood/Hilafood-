import test from "node:test";
import assert from "node:assert/strict";
import { onRequestPost } from "../functions/api/store.js";

const adminKey = "test-admin-key";
function makeDb() {
  const state = { insertedLessons: [] };
  return {
    state,
    prepare(sql) {
      let args = [];
      const stmt = {
        bind(...values) { args = values; return stmt; },
        async all() { return { results: [] }; },
        async first() { return null; },
        async run() {
          if (sql.includes("INSERT INTO course_lessons")) {
            state.insertedLessons.push(args);
            return { meta: { last_row_id: state.insertedLessons.length, changes: 1 } };
          }
          return { meta: { changes: 1 } };
        }
      };
      return stmt;
    }
  };
}
function request(body, authenticated = true) {
  return new Request("https://hilafood.pages.dev/api/store", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(authenticated ? { "x-admin-key": adminKey } : {})
    },
    body: JSON.stringify(body)
  });
}
const base = {
  action: "admin-lesson-create",
  chapter_id: 1,
  title: "درس آزمایشی",
  description: "",
  content_type: "video",
  content_url: "https://example.org/video.mp4",
  content_text: "",
  image: "",
  is_free: true,
  sort_order: 0,
  active: true
};

test("course lesson creation rejects unsafe URLs and unsupported content types on the server", async () => {
  for (const changes of [
    { content_url: "javascript:alert(1)" },
    { content_url: "http://example.org/video.mp4" },
    { content_url: "https://user:pass@example.org/video.mp4" },
    { image: "data:text/html,<script>alert(1)</script>" },
    { content_type: "iframe" },
    { sort_order: -1 },
    { sort_order: 1.2 }
  ]) {
    const db = makeDb();
    const response = await onRequestPost({
      request: request({ ...base, ...changes }),
      env: { DB: db, ADMIN_KEY: adminKey }
    });
    assert.equal(response.status, 400, JSON.stringify(changes));
    assert.equal(db.state.insertedLessons.length, 0);
  }
});

test("course lesson creation still accepts valid HTTPS media and text lesson data", async () => {
  const db = makeDb();
  const response = await onRequestPost({
    request: request(base),
    env: { DB: db, ADMIN_KEY: adminKey }
  });
  assert.equal(response.status, 200);
  assert.equal(db.state.insertedLessons.length, 1);
});

test("course lesson mutation remains admin-only", async () => {
  const db = makeDb();
  const response = await onRequestPost({
    request: request(base, false),
    env: { DB: db, ADMIN_KEY: adminKey }
  });
  assert.equal(response.status, 403);
  assert.equal(db.state.insertedLessons.length, 0);
});
