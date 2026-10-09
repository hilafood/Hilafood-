import test from "node:test";
import assert from "node:assert/strict";
import { projectLessons } from "../functions/lib/course-access.mjs";

const lessons = [
  {
    id: 1, chapter_id: 7, title: "درس رایگان", description: "معرفی",
    content_type: "text", content_text: "متن رایگان", content_url: "",
    is_free: 1, active: 1
  },
  {
    id: 2, chapter_id: 7, title: "درس پولی", description: "محتوای دوره",
    content_type: "video", content_text: "متن محرمانه", content_url: "https://media.example/paid.mp4",
    is_free: 0, active: 1
  }
];

test("guest and non-owner never receive paid lesson text or URL", () => {
  const projected = projectLessons(lessons, false);
  assert.equal(projected[0].content_text, "متن رایگان");
  assert.equal(projected[0].contentAvailable, true);
  assert.equal(projected[1].contentAvailable, false);
  assert.equal("content_text" in projected[1], false);
  assert.equal("content_url" in projected[1], false);
});

test("server-confirmed entitlement permits paid lesson payload projection", () => {
  const projected = projectLessons(lessons, true);
  assert.equal(projected[1].contentAvailable, true);
  assert.equal(projected[1].content_text, "متن محرمانه");
  assert.equal(projected[1].content_url, "");
});

test("lesson projection does not trust client-supplied ownership", () => {
  // Ownership is an explicit server-side argument; client fields are not consulted.
  const clientShapedLesson = { ...lessons[1], entitled: true, isOwner: true };
  const projected = projectLessons([clientShapedLesson], false);
  assert.equal(projected[0].contentAvailable, false);
  assert.equal("content_text" in projected[0], false);
  assert.equal("content_url" in projected[0], false);
});