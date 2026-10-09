import { requireAuthenticatedUser, jsonResponse } from "../lib/auth.mjs";

export async function onRequest({ request, env }) {
  if (request.method !== "GET") return jsonResponse({ error: "روش درخواست پشتیبانی نمی‌شود." }, 405, { Allow: "GET" });
  const user = await requireAuthenticatedUser(request, env);
  if (!user) return jsonResponse({ error: "برای مشاهده سفارش‌ها وارد حساب شوید." }, 401);
  try {
    const result = await env.DB.prepare("SELECT o.id, o.course_id, c.title AS course_title, o.list_price_toman, o.amount_due_toman, o.status, o.gateway_ref_id, o.created_at, o.verified_at FROM course_orders o JOIN courses c ON c.id = o.course_id WHERE o.user_id = ? ORDER BY o.created_at DESC LIMIT 100").bind(user.id).all();
    return jsonResponse({ orders: result.results || [] });
  } catch {
    return jsonResponse({ error: "سفارش‌های دوره فعلاً در دسترس نیستند." }, 503);
  }
}
