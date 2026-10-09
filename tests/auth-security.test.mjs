import test from "node:test";
import assert from "node:assert/strict";
import {
  clearSessionCookie,
  createOtpCode,
  hashOtp,
  hashSessionToken,
  isChallengeUsable,
  isSessionActive,
  makeSessionCookie,
  normalizeIranMobile,
  otpAttemptAllowed,
  rateLimitAllowed,
  readSessionCookie,
  safeEqualHex,
  validSameOriginPost
} from "../functions/lib/auth.mjs";

test("normalizes Iranian mobile numbers including Persian digits", () => {
  assert.equal(normalizeIranMobile("۰۹۱۲۳۴۵۶۷۸۹"), "09123456789");
  assert.equal(normalizeIranMobile("+989123456789"), "09123456789");
  assert.equal(normalizeIranMobile("00989123456789"), "09123456789");
  assert.equal(normalizeIranMobile("12345"), null);
});

test("OTP generation returns six digits and OTP hashes are scoped to challenge", async () => {
  const code = createOtpCode();
  assert.match(code, /^\d{6}$/);
  const first = await hashOtp("test-secret-that-is-long-enough-123", "challenge-a", "123456");
  const same = await hashOtp("test-secret-that-is-long-enough-123", "challenge-a", "123456");
  const otherChallenge = await hashOtp("test-secret-that-is-long-enough-123", "challenge-b", "123456");
  assert.equal(first, same);
  assert.notEqual(first, otherChallenge);
  assert.equal(safeEqualHex(first, first), true);
  assert.equal(safeEqualHex(first, otherChallenge), false);
});

test("correct and incorrect OTP digests are distinguishable without storing raw code", async () => {
  const secret = "test-secret-that-is-long-enough-123";
  const expected = await hashOtp(secret, "challenge", "123456");
  const correct = await hashOtp(secret, "challenge", "123456");
  const incorrect = await hashOtp(secret, "challenge", "654321");
  assert.equal(safeEqualHex(expected, correct), true);
  assert.equal(safeEqualHex(expected, incorrect), false);
  assert.equal(expected.includes("123456"), false);
});

test("OTP expiration, consumed state and attempt limit are enforced", () => {
  const now = Date.parse("2026-10-10T00:00:00.000Z");
  assert.equal(isChallengeUsable({ attempts: 0, expires_at: "2026-10-10T00:05:00.000Z", consumed_at: null }, now), true);
  assert.equal(isChallengeUsable({ attempts: 0, expires_at: "2026-10-09T23:59:59.000Z", consumed_at: null }, now), false);
  assert.equal(isChallengeUsable({ attempts: 0, expires_at: "2026-10-10T00:05:00.000Z", consumed_at: "2026-10-10T00:01:00Z" }, now), false);
  assert.equal(otpAttemptAllowed(4), true);
  assert.equal(otpAttemptAllowed(5), false);
  assert.equal(otpAttemptAllowed(6), false);
});

test("rate-limit boundaries include resend and brute-force protection", () => {
  assert.equal(rateLimitAllowed(1, 1), true);
  assert.equal(rateLimitAllowed(2, 1), false);
  assert.equal(rateLimitAllowed(5, 5), true);
  assert.equal(rateLimitAllowed(6, 5), false);
});

test("session validation rejects expired and revoked sessions", () => {
  const now = Date.parse("2026-10-10T00:00:00.000Z");
  assert.equal(isSessionActive({ expires_at: "2026-10-11T00:00:00.000Z", revoked_at: null }, now), true);
  assert.equal(isSessionActive({ expires_at: "2026-10-09T00:00:00.000Z", revoked_at: null }, now), false);
  assert.equal(isSessionActive({ expires_at: "2026-10-11T00:00:00.000Z", revoked_at: "2026-10-09T00:00:00.000Z" }, now), false);
});

test("session cookies are HttpOnly, Secure, scoped and can be cleared", () => {
  const cookie = makeSessionCookie("a".repeat(43));
  assert.match(cookie, /HttpOnly/);
  assert.match(cookie, /Secure/);
  assert.match(cookie, /SameSite=Lax/);
  assert.match(cookie, /Path=\/api\/auth/);
  assert.match(clearSessionCookie(), /Max-Age=0/);
  const request = new Request("https://hilafood.pages.dev/api/auth/me", {
    headers: { Cookie: `other=x; hilafood_session=${"a".repeat(43)}` }
  });
  assert.equal(readSessionCookie(request), "a".repeat(43));
  assert.equal(readSessionCookie(new Request("https://hilafood.pages.dev/api/auth/me", { headers: { Cookie: "hilafood_session=short" } })), null);
});

test("state-changing auth requests require same origin and JSON content type", () => {
  const allowed = new Request("https://hilafood.pages.dev/api/auth/logout", {
    method: "POST",
    headers: { Origin: "https://hilafood.pages.dev", "Content-Type": "application/json" },
    body: "{}"
  });
  const badOrigin = new Request("https://hilafood.pages.dev/api/auth/logout", {
    method: "POST",
    headers: { Origin: "https://attacker.example", "Content-Type": "application/json" },
    body: "{}"
  });
  assert.equal(validSameOriginPost(allowed), true);
  assert.equal(validSameOriginPost(badOrigin), false);
});
