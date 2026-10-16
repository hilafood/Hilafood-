const MAX_BYTES = 5 * 1024 * 1024;
const HEADERS = { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" };
function json(body, status = 200) { return new Response(JSON.stringify(body), { status, headers: HEADERS }); }
function isAdmin(request, env) { const expected = String(env.ADMIN_KEY || ""); const provided = String(request.headers.get("x-admin-key") || ""); return Boolean(expected && provided && expected === provided); }
function digits(value) { return String(value || "").replace(/[۰-۹٠-٩]/g, ch => { const fa = "۰۱۲۳۴۵۶۷۸۹".indexOf(ch); return String(fa >= 0 ? fa : "٠١٢٣٤٥٦٧٨٩".indexOf(ch)); }).replace(/\D/g, ""); }
async function validateFile(file) {
  if (!file || typeof file.arrayBuffer !== "function" || file.size <= 0 || file.size > MAX_BYTES) return null;
  const allowed = new Map([["image/jpeg","jpg"],["image/png","png"],["image/webp","webp"],["application/pdf","pdf"]]);
  const extension = allowed.get(file.type); if (!extension) return null;
  const bytes = new Uint8Array(await file.slice(0, 16).arrayBuffer());
  const starts = (...values) => values.every((value, index) => bytes[index] === value);
  let valid = false;
  if (extension === "jpg") valid = starts(0xff,0xd8,0xff);
  if (extension === "png") valid = starts(0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a);
  if (extension === "webp") valid = starts(0x52,0x49,0x46,0x46) && String.fromCharCode(...bytes.slice(8,12)) === "WEBP";
  if (extension === "pdf") valid = String.fromCharCode(...bytes.slice(0,5)) === "%PDF-";
  return valid ? { extension, contentType: file.type } : null;
}
function safeId(value) { const id = Number(value); return Number.isSafeInteger(id) && id > 0 ? id : 0; }

export async function onRequest({ request, env }) {
  if (!env.DB) return json({ error: "پایگاه داده در دسترس نیست." }, 503);
  const method = request.method.toUpperCase();
  if (method === "POST") {
    if (!env.PAYMENT_RECEIPTS_BUCKET) return json({ error: "ذخیره‌سازی خصوصی فیش هنوز پیکربندی نشده است؛ فعلاً از روش دستی ایتا استفاده کنید." }, 503);
    let form; try { form = await request.formData(); } catch { return json({ error: "فرم ارسال فیش نامعتبر است." }, 400); }
    const orderId = safeId(form.get("orderId")); const phone = digits(form.get("phone")); const file = form.get("receipt");
    if (!orderId || phone.length < 10 || phone.length > 15) return json({ error: "شماره سفارش یا موبایل نامعتبر است." }, 400);
    const fileInfo = await validateFile(file);
    if (!fileInfo) return json({ error: "فایل باید تصویر JPEG/PNG/WebP یا PDF معتبر و حداکثر ۵ مگابایت باشد." }, 400);
    try {
      const order = await env.DB.prepare("SELECT id, customer_phone, total, payment_status FROM orders WHERE id = ?").bind(orderId).first();
      if (!order || digits(order.customer_phone) !== phone) return json({ error: "سفارش با این شماره موبایل پیدا نشد." }, 404);
      if (order.payment_status === "paid") return json({ error: "این سفارش قبلاً پرداخت‌شده ثبت شده است." }, 409);
      if (!["unpaid","failed","awaiting_review"].includes(String(order.payment_status || "unpaid"))) return json({ error: "وضعیت فعلی سفارش اجازه ارسال فیش نمی‌دهد." }, 409);
      const receiptId = crypto.randomUUID(); const key = "receipts/" + orderId + "/" + receiptId + "." + fileInfo.extension;
      await env.PAYMENT_RECEIPTS_BUCKET.put(key, await file.arrayBuffer(), { httpMetadata: { contentType: fileInfo.contentType, cacheControl: "private, no-store" }, customMetadata: { orderId: String(orderId), receiptId } });
      try {
        await env.DB.prepare("INSERT INTO payment_receipts (order_id, storage_key, content_type, size_bytes, status) VALUES (?, ?, ?, ?, 'pending')").bind(orderId, key, fileInfo.contentType, file.size).run();
        await env.DB.prepare("UPDATE orders SET payment_status = 'awaiting_review' WHERE id = ? AND payment_status IN ('unpaid','failed','awaiting_review')").bind(orderId).run();
      } catch (error) { await env.PAYMENT_RECEIPTS_BUCKET.delete(key).catch(() => {}); throw error; }
      return json({ success: true, status: "awaiting_review", message: "فیش دریافت شد؛ پرداخت پس از بررسی مدیر تأیید می‌شود." }, 201);
    } catch (error) { console.error("Receipt upload failed", error); return json({ error: "ثبت فیش انجام نشد؛ از روش دستی ایتا استفاده کنید." }, 500); }
  }
  if (method === "GET") {
    if (!isAdmin(request, env)) return json({ error: "دسترسی مدیر لازم است." }, 401);
    const url = new URL(request.url); const receiptId = safeId(url.searchParams.get("receiptId"));
    try {
      if (!receiptId) {
        const result = await env.DB.prepare(`SELECT r.id, r.order_id, r.content_type, r.size_bytes, r.status, r.created_at, o.total
          FROM payment_receipts r JOIN orders o ON o.id = r.order_id
          WHERE r.id IN (SELECT MAX(id) FROM payment_receipts GROUP BY order_id)
          ORDER BY r.created_at DESC, r.id DESC`).all();
        return json({ receipts: (result.results || []).map(row => ({ ...row, orderId: "HF-" + row.order_id })) });
      }
      if (!env.PAYMENT_RECEIPTS_BUCKET) return json({ error: "مخزن خصوصی فیش پیکربندی نشده است." }, 503);
      const row = await env.DB.prepare("SELECT storage_key, content_type, size_bytes FROM payment_receipts WHERE id = ?").bind(receiptId).first();
      if (!row) return json({ error: "فیش پیدا نشد." }, 404);
      const object = await env.PAYMENT_RECEIPTS_BUCKET.get(row.storage_key);
      if (!object) return json({ error: "فایل خصوصی فیش پیدا نشد." }, 404);
      const contentType = ["image/jpeg","image/png","image/webp","application/pdf"].includes(row.content_type) ? row.content_type : "application/octet-stream";
      return new Response(object.body, { headers: { "Content-Type": contentType, "Content-Length": String(row.size_bytes), "Content-Disposition": "attachment; filename=\"payment-receipt-" + receiptId + "\"", "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff", "Content-Security-Policy": "sandbox" } });
    } catch (error) { console.error("Receipt read failed", error); return json({ error: "خواندن فیش ممکن نیست؛ migration آزمایشی و پیکربندی مخزن خصوصی را بررسی کنید." }, 503); }
  }
  if (method === "PATCH") {
    if (!isAdmin(request, env)) return json({ error: "دسترسی مدیر لازم است." }, 401);
    let body; try { body = await request.json(); } catch { return json({ error: "درخواست نامعتبر است." }, 400); }
    const receiptId = safeId(body.receiptId); const decision = String(body.decision || ""); const note = typeof body.note === "string" ? body.note.trim().slice(0,500) : "";
    if (!receiptId || !["approve","reject"].includes(decision)) return json({ error: "شناسه فیش یا تصمیم نامعتبر است." }, 400);
    try {
      const receipt = await env.DB.prepare("SELECT id, order_id, status FROM payment_receipts WHERE id = ?").bind(receiptId).first();
      if (!receipt) return json({ error: "فیش پیدا نشد." }, 404);
      if (receipt.status !== "pending") return json({ error: "این فیش قبلاً بررسی شده است." }, 409);
      const order = await env.DB.prepare("SELECT id, payment_status FROM orders WHERE id = ?").bind(receipt.order_id).first();
      if (!order || order.payment_status !== "awaiting_review") return json({ error: "وضعیت سفارش با بررسی فیش سازگار نیست." }, 409);
      const nextStatus = decision === "approve" ? "paid" : "failed";
      const changed = await env.DB.prepare("UPDATE orders SET payment_status = ? WHERE id = ? AND payment_status = 'awaiting_review'").bind(nextStatus, receipt.order_id).run();
      if (!changed.meta?.changes) return json({ error: "وضعیت سفارش هم‌زمان تغییر کرده است؛ فهرست را تازه کنید." }, 409);
      const receiptStatus = decision === "approve" ? "approved" : "rejected";
      await env.DB.prepare("UPDATE payment_receipts SET status = ?, reviewer_note = ?, reviewed_at = CURRENT_TIMESTAMP WHERE id = ? AND status = 'pending'").bind(receiptStatus, note, receiptId).run();
      return json({ success: true, paymentStatus: nextStatus });
    } catch (error) { console.error("Receipt review failed", error); return json({ error: "بررسی فیش انجام نشد؛ migration آزمایشی را بررسی کنید." }, 503); }
  }
  return json({ error: "روش درخواست پشتیبانی نمی‌شود." }, 405);
}
