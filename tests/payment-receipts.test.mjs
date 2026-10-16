import test from "node:test";
import assert from "node:assert/strict";
import { onRequest } from "../functions/api/payment-receipts.js";

const adminEnv = { ADMIN_KEY: "test-admin", DB: { prepare() { throw new Error("DB should not be touched"); } } };

test("receipt list and private file require admin authorization", async () => {
  const response = await onRequest({ request: new Request("https://example.test/api/payment-receipts"), env: adminEnv });
  assert.equal(response.status, 401);
});
test("receipt decisions require admin authorization", async () => {
  const response = await onRequest({ request: new Request("https://example.test/api/payment-receipts", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ receiptId: 1, decision: "approve" }) }), env: adminEnv });
  assert.equal(response.status, 401);
});
test("upload fails closed when private R2 binding is absent", async () => {
  const body = new FormData(); body.set("orderId", "1"); body.set("phone", "09123456789"); body.set("receipt", new Blob(["%PDF-1.7 test"], { type: "application/pdf" }), "receipt.pdf");
  const response = await onRequest({ request: new Request("https://example.test/api/payment-receipts", { method: "POST", body }), env: { DB: {} } });
  assert.equal(response.status, 503); assert.match((await response.json()).error, /ذخیره‌سازی خصوصی/);
});
test("spoofed file content is rejected even when MIME claims PDF", async () => {
  const body = new FormData(); body.set("orderId", "1"); body.set("phone", "09123456789"); body.set("receipt", new Blob(["not a pdf"], { type: "application/pdf" }), "receipt.pdf");
  const response = await onRequest({ request: new Request("https://example.test/api/payment-receipts", { method: "POST", body }), env: { DB: {}, PAYMENT_RECEIPTS_BUCKET: { put() { throw new Error("must not store invalid bytes"); } } } });
  assert.equal(response.status, 400);
});
test("authenticated admin can list receipt metadata without exposing storage keys", async () => {
  const env = { ADMIN_KEY: "test-admin", DB: { prepare() { return { all: async () => ({ results: [{ id: 2, order_id: 1, content_type: "application/pdf", size_bytes: 12, status: "pending", total: 12345, created_at: "2026-10-16" }] }) }; } } };
  const response = await onRequest({ request: new Request("https://example.test/api/payment-receipts", { headers: { "x-admin-key": "test-admin" } }), env });
  assert.equal(response.status, 200); const payload = await response.json(); assert.equal(payload.receipts[0].orderId, "HF-1"); assert.equal("storage_key" in payload.receipts[0], false);
});
test("generic store API contains server-side authorization and forbids client-side paid status", async () => {
  const source = await (await import("node:fs/promises")).readFile(new URL("../functions/api/store.js", import.meta.url), "utf8");
  assert.match(source, /تأیید پرداخت فقط از مسیر بررسی فیش/); assert.match(source, /adminActions\.has\(action\) && !isAdmin/);
});
