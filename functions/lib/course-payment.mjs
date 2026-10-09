/**
 * Pure, fail-closed primitives for course checkout.
 * Not wired to a live endpoint until verified sessions and the D1 migration
 * have been deployed and separately approved.
 */

export const MIN_COURSE_PAYMENT_TOMAN = 1000;

function positiveInteger(value) {
  const number = typeof value === "number" ? value : Number(value);
  return Number.isSafeInteger(number) && number > 0 ? number : null;
}

function isVerifiedUser(user) {
  return Boolean(
    user &&
    typeof user.id === "string" &&
    user.id.trim() &&
    (user.phone_verified_at || user.phoneVerifiedAt)
  );
}

/** Prices are read from a server-loaded course row; client-supplied amounts are not accepted. */
export function resolveCoursePrice(course) {
  if (!course || Number(course.active) !== 1) {
    throw new Error("course_unavailable");
  }

  const listPrice = positiveInteger(course.price);
  if (!listPrice || listPrice < MIN_COURSE_PAYMENT_TOMAN) {
    throw new Error("invalid_course_price");
  }

  const rawDiscount = course.discount_price ?? course.discountPrice;
  let amountDue = listPrice;
  if (rawDiscount !== null && rawDiscount !== undefined && rawDiscount !== "") {
    const discount = positiveInteger(rawDiscount);
    if (!discount || discount < MIN_COURSE_PAYMENT_TOMAN || discount >= listPrice) {
      throw new Error("invalid_course_discount");
    }
    amountDue = discount;
  }

  return Object.freeze({ listPriceToman: listPrice, amountDueToman: amountDue });
}

/** Create the server-side order snapshot before requesting a gateway authority. */
export function buildPendingCourseOrder({ course, user, orderId }) {
  if (!isVerifiedUser(user)) throw new Error("verified_user_required");
  if (typeof orderId !== "string" || !/^[A-Za-z0-9_-]{16,100}$/.test(orderId)) {
    throw new Error("invalid_course_order_id");
  }

  const price = resolveCoursePrice(course);
  const courseId = positiveInteger(course.id);
  if (!courseId) throw new Error("invalid_course_id");
  return Object.freeze({
    id: orderId,
    userId: user.id,
    userVerifiedAt: user.phone_verified_at || user.phoneVerifiedAt,
    courseId,
    listPriceToman: price.listPriceToman,
    amountDueToman: price.amountDueToman,
    status: "pending_gateway",
    gateway: "zarinpal",
    gatewayAuthority: null,
    gatewayRefId: null,
    verifiedAt: null
  });
}

/** Build a callback URL that carries only the opaque order ID, never the amount. */
export function buildCourseCallbackUrl(origin, orderId) {
  if (typeof orderId !== "string" || !/^[A-Za-z0-9_-]{16,100}$/.test(orderId)) {
    throw new Error("invalid_course_order_id");
  }
  const base = new URL(origin);
  if (base.protocol !== "https:" && base.hostname !== "localhost") {
    throw new Error("https_required");
  }
  const callback = new URL("/api/course-payment", base.origin);
  callback.searchParams.set("order_id", orderId);
  return callback.toString();
}

/** Construct gateway request data only from the immutable server-side order snapshot. */
export function buildZarinpalRequest({ order, merchantId, callbackUrl, expectedOrigin }) {
  if (!order || order.status !== "pending_gateway") throw new Error("order_not_payable");
  if (!isVerifiedUser({ id: order.userId, phone_verified_at: order.userVerifiedAt })) {
    throw new Error("verified_user_required");
  }
  if (!merchantId || typeof merchantId !== "string") throw new Error("gateway_not_configured");
  const amount = positiveInteger(order.amountDueToman);
  if (!amount || amount < MIN_COURSE_PAYMENT_TOMAN) throw new Error("invalid_course_price");
  const callback = new URL(callbackUrl);
  if (callback.protocol !== "https:" ||
      callback.pathname !== "/api/course-payment" ||
      !expectedOrigin || callback.origin !== new URL(expectedOrigin).origin ||
      callback.searchParams.get("order_id") !== order.id ||
      callback.searchParams.has("amount")) {
    throw new Error("invalid_course_callback");
  }

  return Object.freeze({
    merchant_id: merchantId,
    amount: amount * 10,
    callback_url: callback.toString(),
    description: "خرید کامل دوره آموزشی هیلا فود",
    metadata: { order_id: order.id }
  });
}

/** Validate a gateway result against the server-stored order, not callback status/amount. */
export function validateCourseGatewayResult({ order, callbackAuthority, gatewayResponse }) {
  if (!order || !callbackAuthority || callbackAuthority !== order.gatewayAuthority) {
    return Object.freeze({ ok: false, reason: "authority_mismatch" });
  }

  // Replays of an already-paid order are idempotent only for the same saved ref.
  if (order.status === "paid") {
    const sameRef = Boolean(order.gatewayRefId && gatewayResponse?.data?.ref_id &&
      String(order.gatewayRefId) === String(gatewayResponse.data.ref_id));
    return Object.freeze({ ok: sameRef, alreadyPaid: sameRef,
      reason: sameRef ? "already_paid" : "paid_reference_mismatch" });
  }

  if (order.status !== "pending_payment") {
    return Object.freeze({ ok: false, reason: "order_not_pending" });
  }
  if (gatewayResponse?.httpOk !== true || gatewayResponse?.data?.code !== 100) {
    return Object.freeze({ ok: false, reason: "gateway_not_verified" });
  }
  const refId = gatewayResponse?.data?.ref_id;
  if (refId === undefined || refId === null || String(refId).trim() === "") {
    return Object.freeze({ ok: false, reason: "missing_gateway_reference" });
  }

  return Object.freeze({ ok: true, alreadyPaid: false, refId: String(refId) });
}

/** Guard for full-course ownership; this never grants access by itself. */
export function canGrantCourseEntitlement({ order, user }) {
  return Boolean(
    order &&
    order.status === "paid" &&
    order.verifiedAt &&
    order.gatewayAuthority &&
    order.gatewayRefId &&
    isVerifiedUser(user) &&
    user.id === order.userId &&
    positiveInteger(order.courseId)
  );
}
