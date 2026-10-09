import test from "node:test";
import assert from "node:assert/strict";
import { hashOtp, verifyOtp } from "../functions/lib/auth.mjs";

const secret = "test-secret-that-is-long-enough-123";
const challengeId = "challenge-stage-four";
const phone = "09123456789";
const code = "123456";

function authDb({ expectedHash }) {
  return {
    prepare(sql) {
      return {
        bind(...values) {
          return {
            async first() {
              if (sql.includes("INSERT INTO auth_rate_limits")) return { count: 1 };
              if (sql.includes("SELECT id, phone, code_hash")) {
                return { id: challengeId, phone, code_hash: expectedHash,
                  expires_at: new Date(Date.now() + 5 * 60_000).toISOString(),
                  attempts: 0, consumed_at: null };
              }
              if (sql.includes("UPDATE auth_otp_challenges SET attempts")) return { attempts: 1 };
              if (sql.includes("UPDATE auth_otp_challenges SET consumed_at")) return { id: challengeId };
              if (sql.includes("SELECT id, phone, phone_verified_at FROM users")) {
                return { id: "user-stage-four", phone, phone_verified_at: new Date().toISOString() };
              }
              return null;
            },
            async run() { return { success: true, meta: { changes: 1 } }; }
          };
        }
      };
    }
  };
}

function requestWithCode(value) {
  return new Request("https://hilafood.pages.dev/api/auth/verify-otp", {
    method: "POST",
    headers: { Origin: "https://hilafood.pages.dev", "Content-Type": "application/json" },
    body: JSON.stringify({ phone, code: value })
  });
}

test("successful OTP verification creates a server session cookie without sending SMS", async () => {
  const expectedHash = await hashOtp(secret, challengeId, code);
  const response = await verifyOtp({
    request: requestWithCode(code),
    env: { AUTH_SECRET: secret, DB: authDb({ expectedHash }) }
  });
  assert.equal(response.status, 200);
  const data = await response.json();
  assert.equal(data.ok, true);
  assert.equal(data.user.phoneVerifiedAt != null, true);
  assert.match(response.headers.get("Set-Cookie"), /HttpOnly/);
  assert.match(response.headers.get("Set-Cookie"), /Secure/);
  assert.match(response.headers.get("Set-Cookie"), /SameSite=Lax/);
  assert.doesNotMatch(JSON.stringify(data), /hilafood_session/);
});

test("incorrect OTP verification fails and does not create a session", async () => {
  const expectedHash = await hashOtp(secret, challengeId, code);
  const response = await verifyOtp({
    request: requestWithCode("654321"),
    env: { AUTH_SECRET: secret, DB: authDb({ expectedHash }) }
  });
  assert.equal(response.status, 400);
  assert.equal(response.headers.get("Set-Cookie"), null);
  assert.match((await response.json()).error, /نامعتبر|منقضی/);
});

test("OTP verification rejects requests without same-origin JSON protections", async () => {
  const expectedHash = await hashOtp(secret, challengeId, code);
  const request = new Request("https://hilafood.pages.dev/api/auth/verify-otp", {
    method: "POST",
    headers: { Origin: "https://attacker.example", "Content-Type": "application/json" },
    body: JSON.stringify({ phone, code })
  });
  const response = await verifyOtp({ request, env: { AUTH_SECRET: secret, DB: authDb({ expectedHash }) } });
  assert.equal(response.status, 403);
});