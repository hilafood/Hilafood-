import test from "node:test";
import assert from "node:assert/strict";
import {
  buildCourseCallbackUrl,
  buildPendingCourseOrder,
  buildZarinpalRequest,
  canGrantCourseEntitlement,
  resolveCoursePrice,
  validateCourseGatewayResult
} from "../functions/lib/course-payment.mjs";

const course = { id: 7, active: 1, price: 500000, discount_price: 350000 };
const user = { id: "user-verified-1", phone_verified_at: "2026-10-09T10:00:00Z" };
const orderId = "course_order_20261009_abc123";

test("uses a valid server-side discount", () => {
  assert.deepEqual(resolveCoursePrice(course), { listPriceToman: 500000, amountDueToman: 350000 });
});

test("rejects inactive courses and malformed prices/discounts", () => {
  assert.throws(() => resolveCoursePrice({ ...course, active: 0 }), /course_unavailable/);
  assert.throws(() => resolveCoursePrice({ ...course, price: 0 }), /invalid_course_price/);
  assert.throws(() => resolveCoursePrice({ ...course, discount_price: 500000 }), /invalid_course_discount/);
  assert.throws(() => resolveCoursePrice({ ...course, discount_price: 500 }), /invalid_course_discount/);
});

test("requires verified identity before preparing an order", () => {
  assert.throws(() => buildPendingCourseOrder({ course, user: { id: "unverified" }, orderId }), /verified_user_required/);
});

test("order snapshot contains the server price and starts without authority", () => {
  const order = buildPendingCourseOrder({ course, user, orderId });
  assert.equal(order.amountDueToman, 350000);
  assert.equal(order.status, "pending_gateway");
  assert.equal(order.gatewayAuthority, null);
});

test("callback contains order ID but never a client-controlled amount", () => {
  const callback = buildCourseCallbackUrl("https://hilafood.pages.dev", orderId);
  assert.equal(new URL(callback).searchParams.get("order_id"), orderId);
  assert.equal(new URL(callback).searchParams.has("amount"), false);
});

test("gateway request uses saved order price in rial and validates callback origin", () => {
  const order = buildPendingCourseOrder({ course, user, orderId });
  const callback = buildCourseCallbackUrl("https://hilafood.pages.dev", orderId);
  const payload = buildZarinpalRequest({ order, merchantId: "test-merchant-not-used", callbackUrl: callback, expectedOrigin: "https://hilafood.pages.dev" });
  assert.equal(payload.amount, 3500000);
  assert.equal(payload.metadata.order_id, orderId);
  assert.equal(new URL(payload.callback_url).searchParams.has("amount"), false);
  assert.throws(() => buildZarinpalRequest({ order, merchantId: "test-merchant-not-used", callbackUrl: callback, expectedOrigin: "https://attacker.example" }), /invalid_course_callback/);
});

test("rejects wrong authority, callback-only success and code 101 for a pending order", () => {
  const order = { status: "pending_payment", gatewayAuthority: "A-stored" };
  assert.equal(validateCourseGatewayResult({ order, callbackAuthority: "A-other", gatewayResponse: { httpOk: true, data: { code: 100, ref_id: 99 } } }).ok, false);
  assert.equal(validateCourseGatewayResult({ order, callbackAuthority: "A-stored", gatewayResponse: { status: "success" } }).ok, false);
  assert.equal(validateCourseGatewayResult({ order, callbackAuthority: "A-stored", gatewayResponse: { httpOk: true, data: { code: 101, ref_id: 99 } } }).ok, false);
});

test("requires successful verification code and a reference ID", () => {
  const order = { status: "pending_payment", gatewayAuthority: "A-stored" };
  assert.equal(validateCourseGatewayResult({ order, callbackAuthority: "A-stored", gatewayResponse: { httpOk: true, data: { code: 100 } } }).ok, false);
  assert.deepEqual(validateCourseGatewayResult({ order, callbackAuthority: "A-stored", gatewayResponse: { httpOk: true, data: { code: 100, ref_id: 12345 } } }), { ok: true, alreadyPaid: false, refId: "12345" });
});

test("only accepts exact replay of an already-paid reference", () => {
  const order = { status: "paid", gatewayAuthority: "A-stored", gatewayRefId: "12345" };
  assert.deepEqual(validateCourseGatewayResult({ order, callbackAuthority: "A-stored", gatewayResponse: { data: { ref_id: 12345 } } }), { ok: true, alreadyPaid: true, reason: "already_paid" });
  assert.equal(validateCourseGatewayResult({ order, callbackAuthority: "A-stored", gatewayResponse: { data: { ref_id: 54321 } } }).ok, false);
});

test("full-course entitlement requires the same verified user and paid order", () => {
  const order = { status: "paid", verifiedAt: "2026-10-09T10:00:00Z", gatewayAuthority: "A", gatewayRefId: "R", userId: user.id, courseId: 7 };
  assert.equal(canGrantCourseEntitlement({ order, user }), true);
  assert.equal(canGrantCourseEntitlement({ order, user: { id: user.id } }), false);
  assert.equal(canGrantCourseEntitlement({ order: { ...order, status: "pending_payment" }, user }), false);
  assert.equal(canGrantCourseEntitlement({ order, user: { ...user, id: "someone-else" } }), false);
});
