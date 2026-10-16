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

test("valid upload matches the server-side order and moves it only to review", async () => {
  const state = { order: { id: 7, customer_phone: "09123456789", total: 123456, payment_status: "unpaid" }, receipts: [], nextId: 1, stored: [] };
  const DB = { prepare(sql) {
    const stmt = { args: [], bind(...args) { stmt.args = args; return stmt; },
      async first() {
        if (sql.includes("SELECT id, customer_phone, total, payment_status FROM orders")) return state.order;
        return null;
      },
      async run() {
        if (sql.includes("INSERT INTO payment_receipts")) state.receipts.push({ id: state.nextId++, order_id: stmt.args[0], storage_key: stmt.args[1], content_type: stmt.args[2], size_bytes: stmt.args[3], status: "pending" });
        if (sql.includes("UPDATE orders SET payment_status = 'awaiting_review'")) state.order.payment_status = "awaiting_review";
        return { meta: { changes: 1 } };
      }
    }; return stmt;
  } };
  const bucket = { async put(key, bytes) { state.stored.push({ key, bytes: new Uint8Array(bytes) }); }, async delete() {} };
  const form = new FormData(); form.set("orderId", "HF-7"); form.set("phone", "09123456789");
  form.set("receipt", new Blob(["%PDF-1.7 dummy receipt"], { type: "application/pdf" }), "dummy.pdf");
  const response = await onRequest({ request: new Request("https://example.test/api/payment-receipts", { method: "POST", body: form }), env: { DB, PAYMENT_RECEIPTS_BUCKET: bucket } });
  assert.equal(response.status, 201);
  assert.equal(state.order.payment_status, "awaiting_review");
  assert.equal(state.receipts[0].status, "pending");
  assert.equal(state.stored.length, 1);
  assert.equal((await response.json()).status, "awaiting_review");
});

test("only an authenticated manager can approve, and approval uses the stored order status", async () => {
  const state = { order: { id: 7, payment_status: "awaiting_review" }, receipt: { id: 3, order_id: 7, status: "pending" }, orderPayment: "awaiting_review", receiptStatus: "pending" };
  const DB = { prepare(sql) {
    const stmt = { args: [], bind(...args) { stmt.args = args; return stmt; },
      async first() {
        if (sql.includes("SELECT id, order_id, status FROM payment_receipts")) return state.receipt;
        if (sql.includes("SELECT MAX(id) AS id")) return { id: 3 };
        if (sql.includes("SELECT id, payment_status FROM orders")) return { id: 7, payment_status: state.orderPayment };
        return null;
      },
      async run() {
        if (sql.includes("UPDATE orders SET payment_status = ?")) { state.orderPayment = stmt.args[0]; return { meta: { changes: 1 } }; }
        if (sql.includes("UPDATE payment_receipts SET status = ?")) { state.receiptStatus = stmt.args[0]; return { meta: { changes: 1 } }; }
        return { meta: { changes: 1 } };
      }
    }; return stmt;
  } };
  const response = await onRequest({ request: new Request("https://example.test/api/payment-receipts", { method: "PATCH", headers: { "Content-Type": "application/json", "x-admin-key": "test-admin" }, body: JSON.stringify({ receiptId: 3, decision: "approve" }) }), env: { ADMIN_KEY: "test-admin", DB } });
  assert.equal(response.status, 200);
  assert.equal(state.orderPayment, "paid");
  assert.equal(state.receiptStatus, "approved");
});
