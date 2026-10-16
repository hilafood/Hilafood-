const JSON_HEADERS = {
  "Content-Type": "application/json; charset=utf-8",
  "Cache-Control": "no-store"
};

function json(body, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: JSON_HEADERS });
}

function isAdmin(request, env) {
  const expected = String(env.ADMIN_KEY || "");
  const provided = String(request.headers.get("x-admin-key") || "");
  return Boolean(expected && provided && expected === provided);
}

function cleanText(value, maxLength) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

function normalizeSources(value) {
  if (!Array.isArray(value) || value.length > 20) return null;
  const sources = [];
  for (const item of value) {
    if (!item || typeof item !== "object" || Array.isArray(item)) return null;
    const title = cleanText(item.title, 240);
    const urlText = cleanText(item.url, 2048);
    if (!title || !urlText) return null;
    let url;
    try {
      url = new URL(urlText);
    } catch {
      return null;
    }
    if (url.protocol !== "https:" || url.username || url.password) return null;
    sources.push({
      title,
      url: url.href,
      publisher: cleanText(item.publisher, 160)
    });
  }
  return sources;
}

function normalizeArticle(body) {
  if (!body || typeof body !== "object" || Array.isArray(body)) return null;
  const title = cleanText(body.title, 240);
  const summary = cleanText(body.summary, 1200);
  const content = cleanText(body.content, 30000);
  const topic = cleanText(body.topic, 80);
  const preparedAt = cleanText(body.prepared_at, 10);
  const sources = normalizeSources(body.sources);
  const allowedTopics = new Set([
    "غذای فراسودمند", "غلات و حبوبات", "تغذیه کودک",
    "بارداری", "شیردهی", "تغذیه زنان"
  ]);
  if (!title || !summary || !content || !allowedTopics.has(topic) ||
      !/^\d{4}-\d{2}-\d{2}$/.test(preparedAt) || !sources || sources.length === 0) {
    return null;
  }
  const date = new Date(preparedAt + "T00:00:00Z");
  if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== preparedAt) return null;
  const duplicateKey = title.normalize("NFKC").toLocaleLowerCase("fa").replace(/[\s\p{P}\p{S}]+/gu, " ").trim();
  return { title, summary, content, topic, prepared_at: preparedAt, sources, duplicate_key: duplicateKey };
}

function articleFromRow(row) {
  let sources = [];
  try {
    const parsed = JSON.parse(row.sources || "[]");
    if (Array.isArray(parsed)) sources = parsed;
  } catch {
    sources = [];
  }
  return {
    id: row.id,
    title: row.title,
    summary: row.summary,
    content: row.content,
    topic: row.topic,
    prepared_at: row.prepared_at,
    sources,
    status: row.status,
    published_at: row.published_at || null,
    created_at: row.created_at,
    updated_at: row.updated_at
  };
}

function dbUnavailable(error) {
  // Do not return SQL or schema details to public callers.
  return json({ error: "مخزن دانستنی‌های علمی هنوز آماده نیست؛ migration آزمایشی و انتشار آن لازم است." }, 503);
}

export async function onRequestGet({ request, env }) {
  if (!env.DB) return json({ error: "مخزن دانستنی‌های علمی در دسترس نیست." }, 503);
  const admin = isAdmin(request, env);
  try {
    const result = admin
      ? await env.DB.prepare("SELECT * FROM science_articles ORDER BY updated_at DESC, id DESC").all()
      : await env.DB.prepare("SELECT * FROM science_articles WHERE status = 'published' ORDER BY published_at DESC, id DESC").all();
    return json({ articles: (result.results || []).map(articleFromRow) });
  } catch (error) {
    return dbUnavailable(error);
  }
}

export async function onRequestPost({ request, env }) {
  if (!isAdmin(request, env)) return json({ error: "دسترسی مدیر لازم است." }, 401);
  if (!env.DB) return json({ error: "مخزن دانستنی‌های علمی در دسترس نیست." }, 503);
  let body;
  try { body = await request.json(); } catch { return json({ error: "JSON نامعتبر است." }, 400); }
  const article = normalizeArticle(body);
  if (!article) return json({ error: "عنوان، خلاصه، متن، موضوع، تاریخ و منابع معتبر الزامی است." }, 400);
  try {
    const result = await env.DB.prepare(`
      INSERT INTO science_articles
        (title, summary, content, topic, prepared_at, sources, status, duplicate_key)
      VALUES (?, ?, ?, ?, ?, ?, 'draft', ?)
    `).bind(article.title, article.summary, article.content, article.topic, article.prepared_at, JSON.stringify(article.sources), article.duplicate_key).run();
    return json({ success: true, id: result.meta?.last_row_id ?? null, status: "draft" }, 201);
  } catch (error) {
    if (/UNIQUE constraint failed/i.test(String(error?.message || error))) {
      return json({ error: "مطلبی با عنوان مشابه از قبل ثبت شده است.", code: "ARTICLE_DUPLICATE" }, 409);
    }
    return dbUnavailable(error);
  }
}

export async function onRequestPut({ request, env }) {
  if (!isAdmin(request, env)) return json({ error: "دسترسی مدیر لازم است." }, 401);
  if (!env.DB) return json({ error: "مخزن دانستنی‌های علمی در دسترس نیست." }, 503);
  let body;
  try { body = await request.json(); } catch { return json({ error: "JSON نامعتبر است." }, 400); }
  const id = Number(body?.id);
  if (!Number.isSafeInteger(id) || id <= 0) return json({ error: "شناسه مطلب نامعتبر است." }, 400);
  const action = cleanText(body?.action, 20);
  try {
    if (action === "publish") {
      const result = await env.DB.prepare("UPDATE science_articles SET status = 'published', published_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND status != 'rejected'").bind(id).run();
      if (!result.meta?.changes) return json({ error: "مطلب پیدا نشد یا رد شده است." }, 404);
      return json({ success: true, id, status: "published" });
    }
    if (action === "reject") {
      const result = await env.DB.prepare("UPDATE science_articles SET status = 'rejected', published_at = NULL, updated_at = CURRENT_TIMESTAMP WHERE id = ?").bind(id).run();
      if (!result.meta?.changes) return json({ error: "مطلب پیدا نشد." }, 404);
      return json({ success: true, id, status: "rejected" });
    }
    if (action !== "edit") return json({ error: "برای تغییر وضعیت، اقدام صریح publish یا reject لازم است." }, 400);
    const article = normalizeArticle(body);
    if (!article) return json({ error: "عنوان، خلاصه، متن، موضوع، تاریخ و منابع معتبر الزامی است." }, 400);
    const result = await env.DB.prepare(`
      UPDATE science_articles
      SET title = ?, summary = ?, content = ?, topic = ?, prepared_at = ?,
          sources = ?, duplicate_key = ?, status = 'draft', published_at = NULL,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).bind(article.title, article.summary, article.content, article.topic, article.prepared_at, JSON.stringify(article.sources), article.duplicate_key, id).run();
    if (!result.meta?.changes) return json({ error: "مطلب پیدا نشد." }, 404);
    return json({ success: true, id, status: "draft" });
  } catch (error) {
    if (/UNIQUE constraint failed/i.test(String(error?.message || error))) {
      return json({ error: "مطلبی با عنوان مشابه از قبل ثبت شده است.", code: "ARTICLE_DUPLICATE" }, 409);
    }
    return dbUnavailable(error);
  }
}

export async function onRequestDelete({ request, env }) {
  if (!isAdmin(request, env)) return json({ error: "دسترسی مدیر لازم است." }, 401);
  if (!env.DB) return json({ error: "مخزن دانستنی‌های علمی در دسترس نیست." }, 503);
  let body;
  try { body = await request.json(); } catch { return json({ error: "JSON نامعتبر است." }, 400); }
  const id = Number(body?.id);
  if (!Number.isSafeInteger(id) || id <= 0) return json({ error: "شناسه مطلب نامعتبر است." }, 400);
  try {
    const result = await env.DB.prepare("DELETE FROM science_articles WHERE id = ?").bind(id).run();
    if (!result.meta?.changes) return json({ error: "مطلب پیدا نشد." }, 404);
    return json({ success: true, id });
  } catch (error) {
    return dbUnavailable(error);
  }
}
