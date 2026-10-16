/*
 * Payment is intentionally fail-closed until course payments are bound to a
 * server-created order and authenticated account. The current product order
 * flow is separate and does not call this endpoint.
 *
 * Do not accept client-supplied amounts or grant access from callback URL
 * parameters. A future implementation must persist Authority-to-order binding,
 * calculate the amount on the server, and verify the transaction server-side.
 */
export async function onRequest({ request }) {
  const method = request.method.toUpperCase();
  const status = method === "GET" || method === "POST" ? 503 : 405;
  const message = status === 503
    ? "پرداخت آنلاین تا زمان اتصال امن به سفارش معتبر سمت سرور غیرفعال است."
    : "روش درخواست نامعتبر است.";

  return new Response(JSON.stringify({
    success: false,
    error: message
  }), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store"
    }
  });
}
