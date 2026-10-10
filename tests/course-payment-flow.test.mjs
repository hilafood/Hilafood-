import test from "node:test";
import assert from "node:assert/strict";
import { startCourseCheckout, handleCoursePaymentCallback } from "../functions/lib/course-payment-flow.mjs";

const user = { id: "user-verified", phoneVerifiedAt: "2026-10-09T10:00:00Z" };
const course = { id: 7, title: "Sample course", price: 500000, discount_price: 350000, active: 1 };
const envBase = { COURSE_PAYMENTS_ENABLED: "approved", ZARINPAL_MERCHANT_ID: "test-merchant-only" };

function fakeDb(options = {}) {
  const state = { course: options.course || course, order: options.order || null, entitlement: options.entitlement || false, batches: 0, lastBatch: null };
  const db = {
    prepare(sql) {
      const stmt = {
        sql, values: [],
        bind(...values) { stmt.values = values; return stmt; },
        async first() {
          if (sql.includes("SELECT id, title, price, discount_price, active FROM courses")) return state.course;
          if (sql.includes("SELECT id FROM course_entitlements")) return state.entitlement ? { id: 1 } : null;
          if (sql.includes("SELECT o.id, o.user_id, o.course_id")) return state.order ? { ...state.order, phone_verified_at: "2026-10-09T10:00:00Z" } : null;
          if (sql.includes("SELECT id, course_id, status, gateway_authority")) return state.order ? { id: state.order.id, course_id: state.order.course_id, status: state.order.status, gateway_authority: state.order.gateway_authority, gateway_ref_id: state.order.gateway_ref_id, verified_at: state.order.verified_at } : null;
          return null;
        },
        async run() {
          if (sql.startsWith("INSERT INTO course_orders")) {
            state.order = { id: stmt.values[0], user_id: stmt.values[1], course_id: stmt.values[2], list_price_toman: stmt.values[3], amount_due_toman: stmt.values[4], status: "pending_gateway", gateway: "zarinpal", gateway_authority: null, gateway_ref_id: null, verified_at: null };
          } else if (sql.includes("SET status = 'pending_payment'")) {
            if (state.order && state.order.id === stmt.values[1] && state.order.status === "pending_gateway") { state.order.status = "pending_payment"; state.order.gateway_authority = stmt.values[0]; }
          } else if (sql.includes("SET status = 'failed'")) {
            if (state.order && state.order.id === stmt.values[0] && state.order.status === "pending_gateway") state.order.status = "failed";
          }
          return { meta: { changes: 1 } };
        }
      };
      return stmt;
    },
    async batch(statements) {
      state.batches += 1; state.lastBatch = statements;
      const update = statements[0];
      if (state.order && state.order.id === update.values[2] && state.order.status === "pending_payment" && state.order.gateway_authority === update.values[3]) {
        state.order.status = "paid"; state.order.gateway_ref_id = update.values[0]; state.order.verified_at = update.values[1];
      }
      if (state.order && state.order.status === "paid" && state.order.gateway_ref_id === update.values[0]) state.entitlement = true;
      return [{ meta: { changes: 1 } }, { meta: { changes: 1 } }];
    }
  };
  return { db, state };
}
function checkoutRequest(body) {
  return new Request("https://hilafood.pages.dev/api/course-checkout", { method: "POST", headers: { Origin: "https://hilafood.pages.dev", "Content-Type": "application/json" }, body: JSON.stringify(body) });
}
function callbackRequest(orderId, authority = "auth-123", status = "OK") {
  const url = new URL("https://hilafood.pages.dev/api/course-payment");
  url.searchParams.set("order_id", orderId); url.searchParams.set("Authority", authority); url.searchParams.set("Status", status);
  return new Request(url);
}
function response(data, ok = true) { return { ok, json: async () => data }; }

test("guest cannot start course checkout", async () => {
  const { db } = fakeDb(); let gatewayCalls = 0;
  const result = await startCourseCheckout({ request: checkoutRequest({ courseId: 7 }), env: { ...envBase, DB: db }, getUser: async () => null, fetchImpl: async () => { gatewayCalls++; return response({}); } });
  assert.equal(result.status, 401); assert.equal(gatewayCalls, 0);
});
test("checkout rejects inactive courses before creating an order or calling the gateway", async () => {
  const { db, state } = fakeDb({ course: { ...course, active: 0 } });
  let gatewayCalls = 0;
  const result = await startCourseCheckout({
    request: checkoutRequest({ courseId: 7 }),
    env: { ...envBase, DB: db },
    getUser: async () => user,
    fetchImpl: async () => { gatewayCalls++; return response({ data: { code: 100, authority: "auth-123" } }); }
  });
  assert.equal(result.status, 404);
  assert.equal(state.order, null);
  assert.equal(gatewayCalls, 0);
});

test("checkout uses server course price and ignores a forged browser amount", async () => {
  const { db, state } = fakeDb(); let sentPayload = null;
  const result = await startCourseCheckout({ request: checkoutRequest({ courseId: 7, amount: 1, amountDueToman: 1 }), env: { ...envBase, DB: db }, getUser: async () => user, fetchImpl: async (_url, options) => { sentPayload = JSON.parse(options.body); return response({ data: { code: 100, authority: "auth-123" } }); } });
  assert.equal(result.status, 200);
  const data = await result.json();
  assert.equal(state.order.list_price_toman, 500000); assert.equal(state.order.amount_due_toman, 350000);
  assert.equal(sentPayload.amount, 3500000); assert.equal(sentPayload.metadata.order_id, data.orderId);
  assert.equal(new URL(sentPayload.callback_url).searchParams.has("amount"), false);
  assert.equal(state.order.status, "pending_payment");
});
test("checkout remains disabled unless explicit operational approval flag is set", async () => {
  const { db } = fakeDb(); let calls = 0;
  const result = await startCourseCheckout({ request: checkoutRequest({ courseId: 7 }), env: { ...envBase, COURSE_PAYMENTS_ENABLED: "true", DB: db }, getUser: async () => user, fetchImpl: async () => { calls++; return response({}); } });
  assert.equal(result.status, 503); assert.equal(calls, 0);
});
test("callback with mismatched authority cannot verify or grant access", async () => {
  const { db, state } = fakeDb({ order: { id: "course-order-123456", user_id: user.id, course_id: 7, amount_due_toman: 350000, status: "pending_payment", gateway_authority: "auth-123", gateway_ref_id: null, verified_at: null } });
  let calls = 0;
  const result = await handleCoursePaymentCallback({ request: callbackRequest(state.order.id, "forged-authority"), env: { ...envBase, DB: db }, fetchImpl: async () => { calls++; return response({ data: { code: 100, ref_id: "R1" } }); } });
  assert.equal(result.status, 302); assert.equal(calls, 0); assert.equal(state.order.status, "pending_payment"); assert.equal(state.entitlement, false);
});
test("valid server verification atomically pays the matching order and grants full-course entitlement", async () => {
  const { db, state } = fakeDb({ order: { id: "course-order-123456", user_id: user.id, course_id: 7, amount_due_toman: 350000, status: "pending_payment", gateway_authority: "auth-123", gateway_ref_id: null, verified_at: null } });
  let verifyPayload = null;
  const result = await handleCoursePaymentCallback({ request: callbackRequest(state.order.id), env: { ...envBase, DB: db }, fetchImpl: async (_url, options) => { verifyPayload = JSON.parse(options.body); return response({ data: { code: 100, ref_id: "R-100" } }); } });
  assert.equal(result.status, 302); assert.match(result.headers.get("Location"), /payment=success/);
  assert.equal(verifyPayload.amount, 3500000); assert.equal(verifyPayload.authority, "auth-123");
  assert.equal(state.order.status, "paid"); assert.equal(state.order.gateway_ref_id, "R-100"); assert.equal(state.entitlement, true); assert.equal(state.batches, 1);
});
test("gateway rejection does not pay an order or grant access", async () => {
  const { db, state } = fakeDb({ order: { id: "course-order-123456", user_id: user.id, course_id: 7, amount_due_toman: 350000, status: "pending_payment", gateway_authority: "auth-123", gateway_ref_id: null, verified_at: null } });
  const result = await handleCoursePaymentCallback({ request: callbackRequest(state.order.id), env: { ...envBase, DB: db }, fetchImpl: async () => response({ data: { code: 101, ref_id: "R-101" } }) });
  assert.equal(result.status, 302); assert.match(result.headers.get("Location"), /payment=failed/);
  assert.equal(state.order.status, "pending_payment"); assert.equal(state.entitlement, false); assert.equal(state.batches, 0);
});
test("repeated callback for an already-paid order cannot change its saved reference or downgrade status", async () => {
  const { db, state } = fakeDb({ order: { id: "course-order-123456", user_id: user.id, course_id: 7, amount_due_toman: 350000, status: "paid", gateway_authority: "auth-123", gateway_ref_id: "R-100", verified_at: "2026-10-09T10:00:00Z" }, entitlement: true });
  let calls = 0;
  const result = await handleCoursePaymentCallback({ request: callbackRequest(state.order.id), env: { ...envBase, DB: db }, fetchImpl: async () => { calls++; return response({ data: { code: 100, ref_id: "R-other" } }); } });
  assert.equal(result.status, 302); assert.match(result.headers.get("Location"), /payment=success/);
  assert.equal(calls, 0); assert.equal(state.order.status, "paid"); assert.equal(state.order.gateway_ref_id, "R-100"); assert.equal(state.batches, 0);
});
