import {
  jsonResponse,
  requireAuthenticatedUser,
  validSameOriginPost
} from "../lib/auth.mjs";

const VALID_TYPES = new Set(["single", "multiple", "text"]);
const VALID_STATUSES = new Set(["draft", "published", "closed", "archived"]);
const MAX_QUESTIONS = 20;
const MAX_OPTIONS = 12;

function idOf(value) {
  const id = Number(value);
  return Number.isSafeInteger(id) && id > 0 ? id : null;
}
function cleanText(value, max = 2000) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}
function adminAllowed(request, env) {
  const provided = request.headers.get("x-admin-key") || "";
  return Boolean(env?.ADMIN_KEY && provided && provided === env.ADMIN_KEY);
}
function dbReady(env) {
  return Boolean(env?.DB && typeof env.DB.prepare === "function");
}
async function bodyOf(request) {
  try { return await request.json(); } catch { return null; }
}
function normalizeQuestions(raw) {
  if (!Array.isArray(raw) || raw.length < 1 || raw.length > MAX_QUESTIONS) return null;
  const questions = [];
  for (let i = 0; i < raw.length; i++) {
    const item = raw[i] || {};
    const prompt = cleanText(item.prompt, 500);
    const type = String(item.type || "single");
    const required = item.required === false ? 0 : 1;
    const options = Array.isArray(item.options)
      ? item.options.map(v => cleanText(typeof v === "string" ? v : v?.label, 200)).filter(Boolean)
      : [];
    if (!prompt || !VALID_TYPES.has(type)) return null;
    if (type === "text" && options.length) return null;
    if ((type === "single" || type === "multiple") &&
        (options.length < 2 || options.length > MAX_OPTIONS || new Set(options).size !== options.length)) return null;
    questions.push({ prompt, type, required, options, sortOrder: i });
  }
  return questions;
}
function sameStructure(current, incoming) {
  const normalizedCurrent = current.map(q => ({
    prompt: q.prompt, type: q.type, required: Number(q.required),
    options: (q.options || []).map(o => o.label)
  }));
  const normalizedIncoming = incoming.map(q => ({
    prompt: q.prompt, type: q.type, required: Number(q.required), options: q.options
  }));
  return JSON.stringify(normalizedCurrent) === JSON.stringify(normalizedIncoming);
}
async function getQuestions(db, surveyId) {
  const result = await db.prepare(`
    SELECT id, survey_id, prompt, type, required, sort_order
    FROM survey_questions WHERE survey_id = ? ORDER BY sort_order, id
  `).bind(surveyId).all();
  const questions = result.results || [];
  for (const q of questions) {
    const options = await db.prepare(`
      SELECT id, question_id, label, sort_order
      FROM survey_options WHERE question_id = ? ORDER BY sort_order, id
    `).bind(q.id).all();
    q.options = options.results || [];
  }
  return questions;
}
async function adminList(db) {
  const result = await db.prepare(`
    SELECT s.id, s.title, s.description, s.status, s.created_at, s.updated_at,
      (SELECT COUNT(*) FROM survey_responses r WHERE r.survey_id = s.id) AS participants
    FROM surveys s ORDER BY s.updated_at DESC, s.id DESC
  `).all();
  const surveys = result.results || [];
  for (const survey of surveys) survey.questions = await getQuestions(db, survey.id);
  return surveys;
}
async function saveQuestions(db, surveyId, questions, finalStatements = []) {
  // D1 batch is transactional: replacing the question/option tree must either
  // complete in full or roll back, rather than deleting old questions first.
  if (typeof db.batch !== "function") throw new Error("survey_atomic_save_unavailable");
  const statements = [
    db.prepare("DELETE FROM survey_questions WHERE survey_id = ?").bind(surveyId)
  ];
  for (const q of questions) {
    statements.push(db.prepare(`
      INSERT INTO survey_questions (survey_id, prompt, type, required, sort_order)
      VALUES (?, ?, ?, ?, ?)
    `).bind(surveyId, q.prompt, q.type, q.required, q.sortOrder));
    for (let i = 0; i < q.options.length; i++) {
      // Each question's sort_order is its unique position in this replacement.
      // Resolve its ID inside the same batch instead of relying on client IDs.
      statements.push(db.prepare(`
        INSERT INTO survey_options (question_id, label, sort_order)
        SELECT id, ?, ? FROM survey_questions
        WHERE survey_id = ? AND sort_order = ?
      `).bind(q.options[i], i, surveyId, q.sortOrder));
    }
  }
  statements.push(...finalStatements);
  await db.batch(statements);
}
async function saveSurvey(db, body) {
  const title = cleanText(body.title, 200);
  const description = cleanText(body.description, 3000);
  const questions = normalizeQuestions(body.questions);
  const surveyId = body.id == null || body.id === "" ? null : idOf(body.id);
  if (!title || !questions || (body.id != null && !surveyId)) {
    return jsonResponse({ error: "عنوان، شناسه یا ساختار سؤال‌های نظرسنجی معتبر نیست." }, 400);
  }
  if (!surveyId) {
    // Create the survey and its question/option tree in one D1 batch so a
    // failed question insert cannot leave an empty draft behind.
    if (typeof db.batch !== "function") throw new Error("survey_atomic_save_unavailable");
    const statements = [
      db.prepare("INSERT INTO surveys (title, description, status) VALUES (?, ?, 'draft')").bind(title, description)
    ];
    for (const q of questions) {
      statements.push(db.prepare(`
        INSERT INTO survey_questions (survey_id, prompt, type, required, sort_order)
        SELECT id, ?, ?, ?, ? FROM surveys ORDER BY id DESC LIMIT 1
      `).bind(q.prompt, q.type, q.required, q.sortOrder));
      for (let i = 0; i < q.options.length; i++) {
        statements.push(db.prepare(`
          INSERT INTO survey_options (question_id, label, sort_order)
          SELECT id, ?, ? FROM survey_questions
          WHERE survey_id = (SELECT id FROM surveys ORDER BY id DESC LIMIT 1)
            AND sort_order = ?
        `).bind(q.options[i], i, q.sortOrder));
      }
    }
    const results = await db.batch(statements);
    const id = Number(results?.[0]?.meta?.last_row_id);
    if (!Number.isSafeInteger(id) || id <= 0) throw new Error("survey_insert_failed");
    return jsonResponse({ ok: true, id, status: "draft" });
  }
  const existing = await db.prepare("SELECT id, status FROM surveys WHERE id = ?").bind(surveyId).first();
  if (!existing) return jsonResponse({ error: "نظرسنجی پیدا نشد." }, 404);
  if (existing.status === "archived") return jsonResponse({ error: "نظرسنجی بایگانی‌شده قابل ویرایش نیست." }, 409);
  const count = await db.prepare("SELECT COUNT(*) AS total FROM survey_responses WHERE survey_id = ?").bind(surveyId).first();
  if (Number(count?.total || 0) > 0) {
    const current = await getQuestions(db, surveyId);
    if (!sameStructure(current, questions)) {
      return jsonResponse({ error: "پس از ثبت پاسخ، ساختار سؤال‌ها و گزینه‌ها قابل تغییر نیست؛ فقط عنوان و توضیحات را ویرایش کنید." }, 409);
    }
  } else {
    const updateSurvey = db.prepare("UPDATE surveys SET title = ?, description = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?")
      .bind(title, description, surveyId);
    await saveQuestions(db, surveyId, questions, [updateSurvey]);
    return jsonResponse({ ok: true, id: surveyId, status: existing.status });
  }
  await db.prepare("UPDATE surveys SET title = ?, description = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?")
    .bind(title, description, surveyId).run();
  return jsonResponse({ ok: true, id: surveyId, status: existing.status });
}
async function resultsFor(db, surveyId) {
  const survey = await db.prepare("SELECT id, title, description, status FROM surveys WHERE id = ?").bind(surveyId).first();
  if (!survey) return null;
  const participants = await db.prepare("SELECT COUNT(*) AS total FROM survey_responses WHERE survey_id = ?").bind(surveyId).first();
  const questions = await getQuestions(db, surveyId);
  const output = [];
  for (const q of questions) {
    if (q.type === "text") {
      const answers = await db.prepare(`
        SELECT a.answer_text FROM survey_answers a
        JOIN survey_responses r ON r.id = a.response_id
        WHERE r.survey_id = ? AND a.question_id = ? AND a.answer_text IS NOT NULL
        ORDER BY r.created_at DESC LIMIT 500
      `).bind(surveyId, q.id).all();
      output.push({ id: q.id, prompt: q.prompt, type: q.type, answers: (answers.results || []).map(x => x.answer_text) });
    } else {
      const counts = await db.prepare(`
        SELECT o.id, o.label, COUNT(CASE WHEN r.id IS NOT NULL THEN a.id END) AS votes
        FROM survey_options o
        LEFT JOIN survey_answers a ON a.option_id = o.id
        LEFT JOIN survey_responses r ON r.id = a.response_id AND r.survey_id = ?
        WHERE o.question_id = ?
        GROUP BY o.id, o.label, o.sort_order
        ORDER BY o.sort_order, o.id
      `).bind(surveyId, q.id).all();
      output.push({ id: q.id, prompt: q.prompt, type: q.type, options: counts.results || [] });
    }
  }
  return { survey, participants: Number(participants?.total || 0), questions: output };
}
async function publicList(request, env) {
  if (!dbReady(env)) return jsonResponse({ error: "پایگاه داده در دسترس نیست." }, 503);
  try {
    const result = await env.DB.prepare(`
      SELECT id, title, description, status FROM surveys
      WHERE status = 'published' ORDER BY updated_at DESC, id DESC
    `).all();
    const user = await requireAuthenticatedUser(request, env);
    const polls = [];
    for (const survey of result.results || []) {
      const questions = await getQuestions(env.DB, survey.id);
      const responded = user?.phoneVerifiedAt
        ? await env.DB.prepare("SELECT id FROM survey_responses WHERE survey_id = ? AND user_id = ? LIMIT 1").bind(survey.id, user.id).first()
        : null;
      polls.push({ ...survey, questions, hasResponded: Boolean(responded) });
    }
    return jsonResponse({ authenticated: Boolean(user?.phoneVerifiedAt), surveys: polls });
  } catch {
    return jsonResponse({ error: "دریافت نظرسنجی‌ها در حال حاضر ممکن نیست." }, 503);
  }
}
async function vote(db, request, env, body) {
  const user = await requireAuthenticatedUser(request, env);
  if (!user?.phoneVerifiedAt) return jsonResponse({ error: "برای شرکت در نظرسنجی ابتدا وارد حساب کاربری شوید." }, 401);
  const surveyId = idOf(body.survey_id);
  if (!surveyId || !Array.isArray(body.answers)) return jsonResponse({ error: "پاسخ ارسالی معتبر نیست." }, 400);
  const survey = await db.prepare("SELECT id, status FROM surveys WHERE id = ?").bind(surveyId).first();
  if (!survey) return jsonResponse({ error: "نظرسنجی پیدا نشد." }, 404);
  if (survey.status !== "published") return jsonResponse({ error: "این نظرسنجی بسته یا غیرفعال است." }, 409);
  const questions = await getQuestions(db, surveyId);
  const submitted = new Map();
  for (const answer of body.answers) {
    const qid = idOf(answer?.question_id);
    if (!qid || !questions.some(q => Number(q.id) === qid) || submitted.has(qid)) {
      return jsonResponse({ error: "شناسه سؤال نامعتبر یا تکراری است." }, 400);
    }
    submitted.set(qid, answer);
  }
  for (const q of questions) {
    const answer = submitted.get(Number(q.id));
    if (!answer) {
      if (Number(q.required)) return jsonResponse({ error: "لطفاً به همه سؤال‌های الزامی پاسخ دهید." }, 400);
      continue;
    }
    if (q.type === "text") {
      const text = cleanText(answer.answer_text, 2000);
      if (Number(q.required) && !text) return jsonResponse({ error: "پاسخ متنی این سؤال الزامی است." }, 400);
      continue;
    }
    const rawIds = q.type === "multiple" ? answer.option_ids : [answer.option_id];
    if (!Array.isArray(rawIds) || rawIds.length < (Number(q.required) ? 1 : 0) ||
        (q.type === "single" && rawIds.length !== 1) ||
        (q.type === "multiple" && rawIds.length > q.options.length)) {
      return jsonResponse({ error: "انتخاب گزینه برای این سؤال معتبر نیست." }, 400);
    }
    const ids = rawIds.map(idOf);
    if (ids.some(id => !id) || new Set(ids).size !== ids.length) return jsonResponse({ error: "گزینه نامعتبر یا تکراری است." }, 400);
    const validOptions = new Set(q.options.map(o => Number(o.id)));
    if (ids.some(id => !validOptions.has(id))) return jsonResponse({ error: "گزینه انتخاب‌شده متعلق به این سؤال نیست." }, 400);
  }
  const responseId = crypto.randomUUID();
  const finalStatements = [
    db.prepare(`
      INSERT INTO survey_responses (id, survey_id, user_id)
      SELECT ?, id, ? FROM surveys WHERE id = ? AND status = 'published'
    `).bind(responseId, user.id, surveyId)
  ];
  // Bind the generated response ID to answer statements only after validation.
  const answerStatements = [];
  for (const q of questions) {
    const answer = submitted.get(Number(q.id));
    if (!answer) continue;
    if (q.type === "text") {
      const text = cleanText(answer.answer_text, 2000);
      if (text) answerStatements.push(db.prepare("INSERT INTO survey_answers (response_id, question_id, answer_text) VALUES (?, ?, ?)")
        .bind(responseId, q.id, text));
    } else {
      const rawIds = q.type === "multiple" ? answer.option_ids : [answer.option_id];
      for (const optionId of rawIds.map(idOf)) {
        answerStatements.push(db.prepare("INSERT INTO survey_answers (response_id, question_id, option_id) VALUES (?, ?, ?)")
          .bind(responseId, q.id, optionId));
      }
    }
  }
  if (typeof db.batch !== "function") return jsonResponse({ error: "ثبت پاسخ امن در حال حاضر در دسترس نیست." }, 503);
  try {
    // Re-check publication immediately before the atomic response write.
    finalStatements.splice(1, finalStatements.length - 1, ...answerStatements);
    const result = await db.batch(finalStatements);
    if (Number(result?.[0]?.meta?.changes ?? 0) !== 1) return jsonResponse({ error: "این نظرسنجی بسته شده است." }, 409);
    return jsonResponse({ ok: true, message: "پاسخ شما ثبت شد." }, 201);
  } catch (error) {
    const message = String(error?.message || error).toLowerCase();
    if (message.includes("unique") || message.includes("constraint")) {
      return jsonResponse({ error: "پاسخ شما قبلاً ثبت شده است؛ امکان شرکت مجدد وجود ندارد." }, 409);
    }
    return jsonResponse({ error: "ثبت پاسخ انجام نشد؛ هیچ رأیی ثبت‌شده تلقی نمی‌شود." }, 503);
  }
}
export async function onRequestGet({ request, env }) {
  return publicList(request, env);
}
export async function onRequestPost({ request, env }) {
  if (!validSameOriginPost(request)) return jsonResponse({ error: "درخواست نامعتبر است." }, 403);
  if (!dbReady(env)) return jsonResponse({ error: "پایگاه داده در دسترس نیست." }, 503);
  const body = await bodyOf(request);
  if (!body || typeof body.action !== "string") return jsonResponse({ error: "درخواست نامعتبر است." }, 400);
  const action = body.action;
  const adminActions = new Set(["admin-list", "admin-save", "admin-publish", "admin-close", "admin-archive", "admin-results"]);
  if (adminActions.has(action) && !adminAllowed(request, env)) return jsonResponse({ error: "دسترسی غیرمجاز است." }, 403);
  try {
    if (action === "vote") return vote(env.DB, request, env, body);
    if (action === "admin-list") return jsonResponse({ surveys: await adminList(env.DB) });
    if (action === "admin-save") return await saveSurvey(env.DB, body);
    if (action === "admin-publish" || action === "admin-close" || action === "admin-archive") {
      const id = idOf(body.id);
      if (!id) return jsonResponse({ error: "شناسه نظرسنجی معتبر نیست." }, 400);
      const survey = await env.DB.prepare("SELECT id, status FROM surveys WHERE id = ?").bind(id).first();
      if (!survey) return jsonResponse({ error: "نظرسنجی پیدا نشد." }, 404);
      if (survey.status === "archived") return jsonResponse({ error: "نظرسنجی بایگانی‌شده قابل تغییر نیست." }, 409);
      if (action === "admin-publish") {
        const count = await env.DB.prepare("SELECT COUNT(*) AS total FROM survey_questions WHERE survey_id = ?").bind(id).first();
        if (Number(count?.total || 0) < 1) return jsonResponse({ error: "برای انتشار، دست‌کم یک سؤال لازم است." }, 400);
      }
      const status = action === "admin-publish" ? "published" : action === "admin-close" ? "closed" : "archived";
      await env.DB.prepare("UPDATE surveys SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?")
        .bind(status, id).run();
      return jsonResponse({ ok: true, id, status });
    }
    if (action === "admin-results") {
      const id = idOf(body.id);
      if (!id) return jsonResponse({ error: "شناسه نظرسنجی معتبر نیست." }, 400);
      const results = await resultsFor(env.DB, id);
      return results ? jsonResponse(results) : jsonResponse({ error: "نظرسنجی پیدا نشد." }, 404);
    }
    return jsonResponse({ error: "عملیات ناشناخته است." }, 400);
  } catch {
    return jsonResponse({ error: "عملیات نظرسنجی انجام نشد؛ پایگاه داده تغییری موفق گزارش نکرد." }, 503);
  }
}
