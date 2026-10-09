import { getCurrentUser } from "../../lib/auth.mjs";

export async function onRequest(context) {
  if (context.request.method !== "GET") {
    return new Response(JSON.stringify({ error: "روش درخواست پشتیبانی نمی‌شود." }), {
      status: 405,
      headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", "Allow": "GET" }
    });
  }
  return getCurrentUser(context);
}
