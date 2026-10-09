import { requireAuthenticatedUser, jsonResponse, validSameOriginPost } from "./auth.mjs";
import { buildCourseCallbackUrl, buildPendingCourseOrder, buildZarinpalRequest, validateCourseGatewayResult } from "./course-payment.mjs";

const ENABLED_VALUE = "approved";
const json = (body, status = 200) => jsonResponse(body, status);
const enabled = env => env?.COURSE_PAYMENTS_ENABLED === ENABLED_VALUE;

function resultRedirect(request, order, state) {
  const url = new URL("/course.html", new URL(request.url).origin);
  if (order?.course_id) url.searchParams.set("id", String(order.course_id));
  url.searchParams.set("payment", state);
  return Response.redirect(url.toString(), 302);
}
function paymentUrl(authority) {
  return "https://www.zarinpal.com/pg/StartPay/" + encodeURIComponent(authority);
}

export async function startCourseCheckout({ request, env, getUser = requireAuthenticatedUser, fetchImpl = fetch }) {
  if (request.method !== "POST") return json({ error: "روش درخواست پشتیبانی نمی‌شود." }, 405);
  if (!validSameOriginPost(request)) return json({ error: "درخواست نامعتبر است." }, 403);
  if (!enabled(env)) return json({ error: "خرید دوره هنوز در محیط عملیاتی فعال نشده است." }, 503);
  if (!env?.DB || typeof env.DB.prepare !== "function") return json({ error: "پایگاه داده در دسترس نیست." }, 503);
  if (typeof env.ZARINPAL_MERCHANT_ID !== "string" || !env.ZARINPAL_MERCHANT_ID.trim()) return json({ error: "تنظیم امن درگاه دوره هنوز انجام نشده است." }, 503);

  const user = await getUser(request, env);
  if (!user?.id || !user.phoneVerifiedAt) return json({ error: "برای خرید، ابتدا با شماره موبایل تأییدشده وارد حساب شوید." }, 401);
  let body;
  try { body = await request.json(); } catch { return json({ error: "درخواست نامعتبر است." }, 400); }
  const courseId = Number(body?.courseId);
  if (!Number.isSafeInteger(courseId) || courseId <= 0) return json({ error: "شناسه دوره معتبر نیست." }, 400);

  let orderId = null;
  try {
    const course = await env.DB.prepare("SELECT id, title, price, discount_price, active FROM courses WHERE id = ? LIMIT 1").bind(courseId).first();
    if (!course) return json({ error: "دوره پیدا نشد." }, 404);
    const owned = await env.DB.prepare("SELECT id FROM course_entitlements WHERE user_id = ? AND course_id = ? LIMIT 1").bind(user.id, courseId).first();
    if (owned) return json({ error: "این دوره قبلاً برای حساب شما فعال شده است.", alreadyOwned: true }, 409);

    orderId = crypto.randomUUID();
    const order = buildPendingCourseOrder({ course, user: { id: user.id, phone_verified_at: user.phoneVerifiedAt }, orderId });
    await env.DB.prepare("INSERT INTO course_orders (id, user_id, course_id, list_price_toman, amount_due_toman, status, gateway) VALUES (?, ?, ?, ?, ?, 'pending_gateway', 'zarinpal')")
      .bind(order.id, order.userId, order.courseId, order.listPriceToman, order.amountDueToman).run();

    const origin = new URL(request.url).origin;
    const callbackUrl = buildCourseCallbackUrl(origin, order.id);
    const gatewayPayload = buildZarinpalRequest({ order, merchantId: env.ZARINPAL_MERCHANT_ID, callbackUrl, expectedOrigin: origin });
    const gatewayResponse = await fetchImpl("https://api.zarinpal.com/pg/v4/payment/request.json", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(gatewayPayload)
    });
    let gatewayData = {};
    try { gatewayData = await gatewayResponse.json(); } catch {}
    const authority = gatewayData?.data?.authority;
    if (!gatewayResponse.ok || gatewayData?.data?.code !== 100 || typeof authority !== "string" || !authority.trim()) {
      await env.DB.prepare("UPDATE course_orders SET status = 'failed', updated_at = CURRENT_TIMESTAMP WHERE id = ? AND status = 'pending_gateway'").bind(order.id).run();
      return json({ error: "درگاه پرداخت نتوانست سفارش دوره را آماده کند." }, 502);
    }
    const updated = await env.DB.prepare("UPDATE course_orders SET status = 'pending_payment', gateway_authority = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND user_id = ? AND status = 'pending_gateway'")
      .bind(authority, order.id, user.id).run();
    if (updated?.meta?.changes === 0) return json({ error: "ثبت وضعیت سفارش ناموفق بود." }, 409);
    return json({ ok: true, orderId: order.id, status: "pending_payment", listPriceToman: order.listPriceToman, amountDueToman: order.amountDueToman, paymentUrl: paymentUrl(authority) });
  } catch {
    if (orderId) {
      try { await env.DB.prepare("UPDATE course_orders SET status = 'failed', updated_at = CURRENT_TIMESTAMP WHERE id = ? AND status = 'pending_gateway'").bind(orderId).run(); } catch {}
    }
    return json({ error: "آماده‌سازی سفارش دوره انجام نشد؛ دسترسی به محتوا تغییری نکرد." }, 503);
  }
}

export async function handleCoursePaymentCallback({ request, env, fetchImpl = fetch }) {
  if (request.method !== "GET") return json({ error: "روش درخواست پشتیبانی نمی‌شود." }, 405);
  if (!enabled(env)) return resultRedirect(request, null, "disabled");
  if (!env?.DB || typeof env.DB.prepare !== "function" || typeof env.ZARINPAL_MERCHANT_ID !== "string" || !env.ZARINPAL_MERCHANT_ID.trim()) return resultRedirect(request, null, "processing");

  const params = new URL(request.url).searchParams;
  const orderId = params.get("order_id") || "";
  const authority = params.get("Authority") || "";
  const status = params.get("Status") || "";
  if (!/^[A-Za-z0-9_-]{16,100}$/.test(orderId) || !authority) return resultRedirect(request, null, "failed");

  try {
    const order = await env.DB.prepare("SELECT o.id, o.user_id, o.course_id, o.amount_due_toman, o.status, o.gateway_authority, o.gateway_ref_id, o.verified_at, u.phone_verified_at FROM course_orders o JOIN users u ON u.id = o.user_id WHERE o.id = ? LIMIT 1").bind(orderId).first();
    if (!order) return resultRedirect(request, null, "failed");
    if (order.status === "paid") {
      const sameAuthority = authority === order.gateway_authority;
      return resultRedirect(request, order, sameAuthority && order.gateway_ref_id && order.verified_at ? "success" : "failed");
    }
    if (status !== "OK" || order.status !== "pending_payment" || authority !== order.gateway_authority || !order.phone_verified_at) return resultRedirect(request, order, "failed");

    const verifyResponse = await fetchImpl("https://api.zarinpal.com/pg/v4/payment/verify.json", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ merchant_id: env.ZARINPAL_MERCHANT_ID, amount: Number(order.amount_due_toman) * 10, authority: order.gateway_authority })
    });
    let verifyData = {};
    try { verifyData = await verifyResponse.json(); } catch {}
    const validation = validateCourseGatewayResult({
      order: { ...order, gatewayAuthority: order.gateway_authority, gatewayRefId: order.gateway_ref_id, verifiedAt: order.verified_at },
      callbackAuthority: authority,
      gatewayResponse: { httpOk: verifyResponse.ok, data: verifyData?.data }
    });
    if (!validation.ok) return resultRedirect(request, order, "failed");
    if (typeof env.DB.batch !== "function") return resultRedirect(request, order, "processing");

    const verifiedAt = new Date().toISOString();
    await env.DB.batch([
      env.DB.prepare("UPDATE course_orders SET status = 'paid', gateway_ref_id = ?, verified_at = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND status = 'pending_payment' AND gateway_authority = ?").bind(validation.refId, verifiedAt, order.id, authority),
      env.DB.prepare("INSERT INTO course_entitlements (user_id, course_id, course_order_id) SELECT o.user_id, o.course_id, o.id FROM course_orders o JOIN users u ON u.id = o.user_id WHERE o.id = ? AND o.status = 'paid' AND o.gateway_ref_id = ? AND o.verified_at IS NOT NULL AND u.phone_verified_at IS NOT NULL ON CONFLICT DO NOTHING").bind(order.id, validation.refId)
    ]);
    const finalOrder = await env.DB.prepare("SELECT id, course_id, status, gateway_authority, gateway_ref_id, verified_at FROM course_orders WHERE id = ? LIMIT 1").bind(order.id).first();
    if (finalOrder?.status === "paid" && finalOrder.gateway_authority === authority && String(finalOrder.gateway_ref_id) === String(validation.refId) && finalOrder.verified_at) return resultRedirect(request, finalOrder, "success");
    return resultRedirect(request, order, "processing");
  } catch {
    return resultRedirect(request, null, "processing");
  }
}
