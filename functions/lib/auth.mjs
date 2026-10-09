const OTP_TTL_SECONDS = 5 * 60;
const SESSION_TTL_SECONDS = 30 * 24 * 60 * 60;
const MAX_OTP_ATTEMPTS = 5;
const RESEND_COOLDOWN_SECONDS = 60;
const PHONE_HOURLY_LIMIT = 5;
const IP_HOURLY_LIMIT = 20;

const encoder = new TextEncoder();

export function normalizeIranMobile(value) {
  if (typeof value !== "string") return null;
  let phone = value.trim().replace(/[۰-۹]/g, digit => String("۰۱۲۳۴۵۶۷۸۹".indexOf(digit)))
    .replace(/[٠-٩]/g, digit => String("٠١٢٣٤٥٦٧٨٩".indexOf(digit)))
    .replace(/[\s()-]/g, "");
  if (phone.startsWith("+98")) phone = "0" + phone.slice(3);
  else if (phone.startsWith("0098")) phone = "0" + phone.slice(4);
  return /^09\d{9}$/.test(phone) ? phone : null;
}

export function createOtpCode(cryptoApi = globalThis.crypto) {
  const value = new Uint32Array(1);
  cryptoApi.getRandomValues(value);
  return String(value[0] % 1_000_000).padStart(6, "0");
}

function toHex(bytes) {
  return Array.from(new Uint8Array(bytes), byte => byte.toString(16).padStart(2, "0")).join("");
}

async function hmacHex(secret, value) {
  const key = await crypto.subtle.importKey(
    "raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]
  );
  return toHex(await crypto.subtle.sign("HMAC", key, encoder.encode(value)));
}

export async function hashOtp(secret, challengeId, code) {
  return hmacHex(secret, `hilafood:otp:${challengeId}:${code}`);
}

export async function hashRateLimitKey(secret, scope, key) {
  return hmacHex(secret, `hilafood:rate:${scope}:${key}`);
}

export async function hashSessionToken(secret, token) {
  return hmacHex(secret, `hilafood:session:${token}`);
}

export function safeEqualHex(left, right) {
  if (typeof left !== "string" || typeof right !== "string" || left.length !== right.length) return false;
  let difference = 0;
  for (let index = 0; index < left.length; index++) {
    difference |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }
  return difference === 0;
}

export function isChallengeUsable(challenge, nowMs = Date.now()) {
  return Boolean(challenge &&
    !challenge.consumed_at &&
    Number(challenge.attempts) < MAX_OTP_ATTEMPTS &&
    Number.isFinite(Date.parse(challenge.expires_at)) &&
    Date.parse(challenge.expires_at) > nowMs);
}

export function isSessionActive(session, nowMs = Date.now()) {
  return Boolean(session &&
    !session.revoked_at &&
    Number.isFinite(Date.parse(session.expires_at)) &&
    Date.parse(session.expires_at) > nowMs);
}

export function otpAttemptAllowed(attempts) {
  return Number.isInteger(Number(attempts)) && Number(attempts) >= 0 &&
    Number(attempts) < MAX_OTP_ATTEMPTS;
}

export function rateLimitAllowed(count, maximum) {
  return Number.isInteger(Number(count)) && Number(count) >= 1 &&
    Number(count) <= maximum;
}

export function makeSessionCookie(token, maxAge = SESSION_TTL_SECONDS) {
  return `hilafood_session=${token}; Max-Age=${maxAge}; Path=/; Secure; HttpOnly; SameSite=Lax`;
}

export function clearSessionCookie() {
  return "hilafood_session=; Max-Age=0; Path=/api/auth; Secure; HttpOnly; SameSite=Lax";
}

export function readSessionCookie(request) {
  const cookieHeader = request.headers.get("Cookie") || "";
  for (const item of cookieHeader.split(";")) {
    const separator = item.indexOf("=");
    if (separator < 0) continue;
    if (item.slice(0, separator).trim() === "hilafood_session") {
      const value = item.slice(separator + 1).trim();
      return /^[A-Za-z0-9_-]{40,100}$/.test(value) ? value : null;
    }
  }
  return null;
}

export function jsonResponse(body, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
      ...extraHeaders
    }
  });
}

export function hasStrongAuthSecret(env) {
  return typeof env?.AUTH_SECRET === "string" && env.AUTH_SECRET.length >= 32;
}

export function validSameOriginPost(request) {
  if (request.method !== "POST") return false;
  const origin = request.headers.get("Origin");
  if (!origin) return false;
  try {
    return new URL(origin).origin === new URL(request.url).origin &&
      (request.headers.get("Content-Type") || "").toLowerCase().startsWith("application/json");
  } catch {
    return false;
  }
}

function isoAfter(seconds) {
  return new Date(Date.now() + seconds * 1000).toISOString();
}

async function takeRateLimit(db, secret, scope, key, windowSeconds, maximum) {
  const keyHash = await hashRateLimitKey(secret, scope, key);
  const now = Math.floor(Date.now() / 1000);
  const row = await db.prepare(`
    INSERT INTO auth_rate_limits
      (key_hash, scope, window_started_at, count, last_action_at)
    VALUES (?, ?, ?, 1, ?)
    ON CONFLICT(key_hash) DO UPDATE SET
      count = CASE
        WHEN excluded.window_started_at - auth_rate_limits.window_started_at >= ?
        THEN 1 ELSE auth_rate_limits.count + 1 END,
      window_started_at = CASE
        WHEN excluded.window_started_at - auth_rate_limits.window_started_at >= ?
        THEN excluded.window_started_at ELSE auth_rate_limits.window_started_at END,
      last_action_at = excluded.last_action_at
    RETURNING count
  `).bind(keyHash, scope, now, now, windowSeconds, windowSeconds).first();
  return rateLimitAllowed(Number(row?.count), maximum);
}

async function consumeSendLimits(db, secret, phone, ip) {
  const phoneHash = await hashRateLimitKey(secret, "phone-id", phone);
  const now = Math.floor(Date.now() / 1000);
  // The cooldown is a separate fixed-window counter; all counters are keyed by HMAC.
  const cooldownKey = await hashRateLimitKey(secret, "send-cooldown", phone);
  const cooldown = await db.prepare(`
    INSERT INTO auth_rate_limits(key_hash, scope, window_started_at, count, last_action_at)
    VALUES (?, 'send-cooldown', ?, 1, ?)
    ON CONFLICT(key_hash) DO UPDATE SET
      count = CASE WHEN excluded.window_started_at - auth_rate_limits.window_started_at >= 60
        THEN 1 ELSE auth_rate_limits.count + 1 END,
      window_started_at = CASE WHEN excluded.window_started_at - auth_rate_limits.window_started_at >= 60
        THEN excluded.window_started_at ELSE auth_rate_limits.window_started_at END,
      last_action_at = excluded.last_action_at
    RETURNING count
  `).bind(cooldownKey, now, now).first();
  const phoneAllowed = await takeRateLimit(db, secret, "send-phone-hour", phoneHash, 3600, PHONE_HOURLY_LIMIT);
  const ipAllowed = await takeRateLimit(db, secret, "send-ip-hour", ip || "unknown", 3600, IP_HOURLY_LIMIT);
  return Number(cooldown?.count) === 1 && phoneAllowed && ipAllowed;
}

async function consumeVerifyLimits(db, secret, phone, ip) {
  const phoneAllowed = await takeRateLimit(db, secret, "verify-phone-hour", phone, 3600, 10);
  const ipAllowed = await takeRateLimit(db, secret, "verify-ip-hour", ip || "unknown", 3600, 30);
  return phoneAllowed && ipAllowed;
}

function clientIp(request) {
  // Used only as an HMAC input; the raw address is never written to D1.
  return request.headers.get("CF-Connecting-IP") || "unknown";
}

function isValidProviderConfig(env) {
  if (!env?.SMS_API_URL || !env?.SMS_API_TOKEN) return false;
  try {
    return new URL(env.SMS_API_URL).protocol === "https:";
  } catch {
    return false;
  }
}

async function sendOtp(env, phone, code) {
  const response = await fetch(env.SMS_API_URL, {
    method: "POST",
    redirect: "error",
    headers: {
      "Authorization": `Bearer ${env.SMS_API_TOKEN}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      to: phone,
      message: `کد ورود هیلا فود: ${code} — اعتبار کد ۵ دقیقه است.`
    })
  });
  return response.ok;
}

function requireDatabase(env) {
  return Boolean(env?.DB && typeof env.DB.prepare === "function");
}

export async function requestOtp({ request, env }) {
  if (!validSameOriginPost(request)) return jsonResponse({ error: "درخواست نامعتبر است." }, 403);
  if (!requireDatabase(env) || !hasStrongAuthSecret(env)) {
    return jsonResponse({ error: "ورود موقتاً در دسترس نیست." }, 503);
  }
  let body;
  try { body = await request.json(); } catch { return jsonResponse({ error: "درخواست نامعتبر است." }, 400); }
  const phone = normalizeIranMobile(body?.phone);
  if (!phone) return jsonResponse({ error: "شماره موبایل معتبر وارد کنید." }, 400);

  // Never reveal whether this phone is already registered. Without a configured provider,
  // do not generate or persist a code and do not pretend a message was sent.
  if (!isValidProviderConfig(env)) {
    return jsonResponse({ error: "ارسال کد فعلاً در دسترس نیست." }, 503);
  }

  const allowed = await consumeSendLimits(env.DB, env.AUTH_SECRET, phone, clientIp(request));
  if (!allowed) return jsonResponse({ error: "برای ارسال کد کمی صبر کنید و دوباره تلاش کنید." }, 429);

  const id = crypto.randomUUID();
  const code = createOtpCode();
  const codeHash = await hashOtp(env.AUTH_SECRET, id, code);
  const now = new Date().toISOString();
  const expiresAt = isoAfter(OTP_TTL_SECONDS);

  await env.DB.prepare(`
    INSERT INTO auth_otp_challenges (id, phone, code_hash, expires_at, attempts, consumed_at)
    VALUES (?, ?, ?, ?, 0, NULL)
  `).bind(id, phone, codeHash, expiresAt).run();

  let sent = false;
  try { sent = await sendOtp(env, phone, code); } catch { sent = false; }
  if (!sent) {
    await env.DB.prepare("UPDATE auth_otp_challenges SET consumed_at = ? WHERE id = ? AND consumed_at IS NULL")
      .bind(new Date().toISOString(), id).run();
    return jsonResponse({ error: "ارسال کد فعلاً ناموفق بود؛ بعداً دوباره تلاش کنید." }, 503);
  }

  return jsonResponse({ ok: true, message: "اگر ارسال پیامک امکان‌پذیر باشد، کد ورود ارسال می‌شود.", expiresIn: OTP_TTL_SECONDS }, 202);
}

export async function verifyOtp({ request, env }) {
  if (!validSameOriginPost(request)) return jsonResponse({ error: "درخواست نامعتبر است." }, 403);
  if (!requireDatabase(env) || !hasStrongAuthSecret(env)) {
    return jsonResponse({ error: "ورود موقتاً در دسترس نیست." }, 503);
  }
  let body;
  try { body = await request.json(); } catch { return jsonResponse({ error: "درخواست نامعتبر است." }, 400); }
  const phone = normalizeIranMobile(body?.phone);
  const code = typeof body?.code === "string" ? body.code.trim() : "";
  if (!phone || !/^\d{6}$/.test(code)) return jsonResponse({ error: "کد یا شماره معتبر نیست." }, 400);

  if (!await consumeVerifyLimits(env.DB, env.AUTH_SECRET, phone, clientIp(request))) {
    return jsonResponse({ error: "تلاش‌های زیادی انجام شده است؛ بعداً دوباره تلاش کنید." }, 429);
  }

  const challenge = await env.DB.prepare(`
    SELECT id, phone, code_hash, expires_at, attempts, consumed_at
    FROM auth_otp_challenges
    WHERE phone = ? AND consumed_at IS NULL
    ORDER BY created_at DESC LIMIT 1
  `).bind(phone).first();

  if (!isChallengeUsable(challenge)) {
    if (challenge && !challenge.consumed_at &&
        (!Number.isFinite(Date.parse(challenge.expires_at)) || Date.parse(challenge.expires_at) <= Date.now() ||
         Number(challenge.attempts) >= MAX_OTP_ATTEMPTS)) {
      await env.DB.prepare("UPDATE auth_otp_challenges SET consumed_at = ? WHERE id = ? AND consumed_at IS NULL")
        .bind(new Date().toISOString(), challenge.id).run();
    }
    return jsonResponse({ error: "کد نامعتبر یا منقضی است؛ کد تازه درخواست کنید." }, 400);
  }

  const attempt = await env.DB.prepare(`
    UPDATE auth_otp_challenges SET attempts = attempts + 1
    WHERE id = ? AND consumed_at IS NULL AND attempts < ? AND expires_at > ?
    RETURNING attempts
  `).bind(challenge.id, MAX_OTP_ATTEMPTS, new Date().toISOString()).first();
  if (!attempt) return jsonResponse({ error: "کد نامعتبر یا منقضی است؛ کد تازه درخواست کنید." }, 400);

  const suppliedHash = await hashOtp(env.AUTH_SECRET, challenge.id, code);
  if (!safeEqualHex(suppliedHash, challenge.code_hash)) {
    if (Number(attempt.attempts) >= MAX_OTP_ATTEMPTS) {
      await env.DB.prepare("UPDATE auth_otp_challenges SET consumed_at = ? WHERE id = ? AND consumed_at IS NULL")
        .bind(new Date().toISOString(), challenge.id).run();
    }
    return jsonResponse({ error: "کد نامعتبر یا منقضی است؛ کد تازه درخواست کنید." }, 400);
  }

  const consumedAt = new Date().toISOString();
  const consumed = await env.DB.prepare(`
    UPDATE auth_otp_challenges SET consumed_at = ?
    WHERE id = ? AND consumed_at IS NULL AND expires_at > ? AND attempts <= ?
    RETURNING id
  `).bind(consumedAt, challenge.id, consumedAt, MAX_OTP_ATTEMPTS).first();
  if (!consumed) return jsonResponse({ error: "کد نامعتبر یا منقضی است؛ کد تازه درخواست کنید." }, 400);

  const proposedUserId = crypto.randomUUID();
  await env.DB.prepare(`
    INSERT INTO users (id, phone, phone_verified_at, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(phone) DO UPDATE SET
      phone_verified_at = COALESCE(users.phone_verified_at, excluded.phone_verified_at),
      updated_at = excluded.updated_at
  `).bind(proposedUserId, phone, consumedAt, consumedAt, consumedAt).run();

  const user = await env.DB.prepare("SELECT id, phone, phone_verified_at FROM users WHERE phone = ?")
    .bind(phone).first();
  if (!user?.id || !user.phone_verified_at) return jsonResponse({ error: "ورود انجام نشد؛ دوباره تلاش کنید." }, 503);

  const sessionTokenBytes = new Uint8Array(32);
  crypto.getRandomValues(sessionTokenBytes);
  const sessionToken = toBase64Url(sessionTokenBytes);
  const sessionHash = await hashSessionToken(env.AUTH_SECRET, sessionToken);
  const sessionId = crypto.randomUUID();
  const expiresAt = isoAfter(SESSION_TTL_SECONDS);
  await env.DB.prepare(`
    INSERT INTO auth_sessions (id, user_id, token_hash, expires_at, revoked_at, created_at)
    VALUES (?, ?, ?, ?, NULL, ?)
  `).bind(sessionId, user.id, sessionHash, expiresAt, consumedAt).run();

  return jsonResponse(
    { ok: true, user: { id: user.id, phone: user.phone, phoneVerifiedAt: user.phone_verified_at }, expiresAt },
    200,
    { "Set-Cookie": makeSessionCookie(sessionToken, SESSION_TTL_SECONDS) }
  );
}

function toBase64Url(bytes) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

export async function requireAuthenticatedUser(request, env) {
  if (!requireDatabase(env) || !hasStrongAuthSecret(env)) return null;
  const token = readSessionCookie(request);
  if (!token) return null;
  const tokenHash = await hashSessionToken(env.AUTH_SECRET, token);
  const row = await env.DB.prepare(`
    SELECT u.id, u.phone, u.phone_verified_at,
           s.id AS session_id, s.expires_at, s.revoked_at
    FROM auth_sessions s
    JOIN users u ON u.id = s.user_id
    WHERE s.token_hash = ?
    LIMIT 1
  `).bind(tokenHash).first();
  if (!row || !row.phone_verified_at || !isSessionActive(row)) return null;
  return {
    id: row.id,
    phone: row.phone,
    phoneVerifiedAt: row.phone_verified_at,
    sessionId: row.session_id,
    sessionExpiresAt: row.expires_at
  };
}

export async function getCurrentUser({ request, env }) {
  const user = await requireAuthenticatedUser(request, env);
  if (!user) return jsonResponse({ error: "برای ادامه وارد حساب شوید." }, 401);
  return jsonResponse({
    user: { id: user.id, phone: user.phone, phoneVerifiedAt: user.phoneVerifiedAt },
    sessionExpiresAt: user.sessionExpiresAt
  });
}

export async function logout({ request, env }) {
  if (!validSameOriginPost(request)) return jsonResponse({ error: "درخواست نامعتبر است." }, 403);
  if (requireDatabase(env) && hasStrongAuthSecret(env)) {
    const token = readSessionCookie(request);
    if (token) {
      const tokenHash = await hashSessionToken(env.AUTH_SECRET, token);
      await env.DB.prepare(`
        UPDATE auth_sessions SET revoked_at = ?
        WHERE token_hash = ? AND revoked_at IS NULL
      `).bind(new Date().toISOString(), tokenHash).run();
    }
  }
  return jsonResponse({ ok: true }, 200, { "Set-Cookie": clearSessionCookie() });
}
