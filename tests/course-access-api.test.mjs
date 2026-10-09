import test from "node:test";
import assert from "node:assert/strict";
import { getCourseContent, projectLessons } from "../functions/lib/course-access.mjs";

const lessonRows = [
  { id: 1, chapter_id: 10, title: "مقدمه رایگان", description: "", content_type: "text", content_text: "متن رایگان", content_url: "", image: "", is_free: 1, sort_order: 1, active: 1 },
  { id: 2, chapter_id: 10, title: "درس پولی", description: "", content_type: "video", content_text: "محتوای محرمانه", content_url: "https://media.example/paid.mp4", image: "", is_free: 0, sort_order: 2, active: 1 }
];

function fakeDb({ session = null, entitlement = null } = {}) {
  return {
    prepare(sql) {
      return {
        bind(...args) {
          return {
            async first() {
              if (sql.includes("FROM courses")) return { id: 3, title: "اولین خوشمزه های من", slug: "first-tastes", description: "آموزش", image: "", active: 1 };
              if (sql.includes("FROM auth_sessions s")) return session;
              if (sql.includes("FROM course_entitlements e")) return entitlement;
              return null;
            },
            async all() {
              if (sql.includes("FROM course_chapters")) return { results: [{ id: 10, course_id: 3, title: "فصل اول", sort_order: 1 }] };
              if (sql.includes("FROM course_lessons")) return { results: lessonRows };
              return { results: [] };
            }
          };
        }
      };
    }
  };
}

const secret = "test-secret-that-is-long-enough-123";

test("course API returns lesson titles to guests but strips paid lesson content", async () => {
  const request = new Request("https://hilafood.pages.dev/api/course-content?course_id=3");
  const response = await getCourseContent({ request, env: { DB: fakeDb() } });
  assert.equal(response.status, 200);
  const data = await response.json();
  assert.equal(data.authenticated, false);
  assert.equal(data.entitled, false);
  const paid = data.lessons.find(lesson => lesson.id === 2);
  assert.equal(paid.contentAvailable, false);
  assert.equal("content_text" in paid, false);
  assert.equal("content_url" in paid, false);
});

test("course API keeps paid content closed even when a mock entitlement exists while purchases are disabled", async () => {
  const session = {
    id: "user-1", phone: "09123456789", phone_verified_at: "2026-10-09T00:00:00.000Z",
    session_id: "session-1", expires_at: new Date(Date.now() + 60_000).toISOString(), revoked_at: null
  };
  const request = new Request("https://hilafood.pages.dev/api/course-content?course_id=3", {
    headers: { Cookie: "hilafood_session=" + "a".repeat(43) }
  });
  const response = await getCourseContent({
    request,
    env: { AUTH_SECRET: secret, DB: fakeDb({ session, entitlement: { id: 44 } }) }
  });
  assert.equal(response.status, 200);
  const data = await response.json();
  assert.equal(data.authenticated, true);
  assert.equal(data.entitled, false);
  const paid = data.lessons.find(lesson => lesson.id === 2);
  assert.equal(paid.contentAvailable, false);
  assert.equal("content_text" in paid, false);
  assert.equal("content_url" in paid, false);
});

test("course API denies paid content to a signed-in user without ownership", async () => {
  const session = {
    id: "user-2", phone: "09123456780", phone_verified_at: "2026-10-09T00:00:00.000Z",
    session_id: "session-2", expires_at: new Date(Date.now() + 60_000).toISOString(), revoked_at: null
  };
  const request = new Request("https://hilafood.pages.dev/api/course-content?course_id=3", {
    headers: { Cookie: "hilafood_session=" + "b".repeat(43) }
  });
  const response = await getCourseContent({ request, env: { AUTH_SECRET: secret, DB: fakeDb({ session, entitlement: null }) } });
  assert.equal(response.status, 200);
  const data = await response.json();
  assert.equal(data.authenticated, true);
  assert.equal(data.entitled, false);
  const paid = data.lessons.find(lesson => lesson.id === 2);
  assert.equal(paid.contentAvailable, false);
  assert.equal("content_text" in paid, false);
  assert.equal("content_url" in paid, false);
});

test("course API fails closed when the course schema is unavailable", async () => {
  const request = new Request("https://hilafood.pages.dev/api/course-content?course_id=3");
  const response = await getCourseContent({ request, env: { DB: { prepare() { throw new Error("missing table"); } } } });
  assert.equal(response.status, 503);
});

test("course API rejects invalid course identifiers", async () => {
  const request = new Request("https://hilafood.pages.dev/api/course-content?course_id=0");
  const response = await getCourseContent({ request, env: { DB: fakeDb() } });
  assert.equal(response.status, 400);
});

test("lesson projection ignores client-provided ownership flags", () => {
  const projected = projectLessons([{ ...lessonRows[1], isOwner: true, entitled: true }], false);
  assert.equal(projected[0].contentAvailable, false);
  assert.equal("content_text" in projected[0], false);
});
