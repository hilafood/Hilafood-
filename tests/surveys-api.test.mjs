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
test("public survey listing does not expose results or participant identifiers", async () => {
  const request = new Request(origin + "/api/surveys");
  const response = await onRequestGet({ request, env: {} });
  assert.equal(response.status, 503);
  const data = await response.json();
  assert.equal("results" in data, false);
  assert.equal("phone" in data, false);
  assert.equal("user_id" in data, false);
});
