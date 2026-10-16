import test from "node:test";
import assert from "node:assert/strict";
import { onRequest } from "../functions/api/payment.js";

test("payment endpoint fails closed for client-supplied amounts without a server order", async () => {
  const response = await onRequest({
    request: new Request("https://hilafood.pages.dev/api/payment", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ amount: 1000, mobile: "09000000000" })
    }),
    env: { ZARINPAL_MERCHANT_ID: "test-only-not-a-real-secret" }
  });

  assert.equal(response.status, 503);
  const body = await response.json();
  assert.equal(body.success, false);
  assert.match(body.error, /سفارش معتبر سمت سرور/);
});

test("payment callback URL parameters cannot mark a transaction successful", async () => {
  const response = await onRequest({
    request: new Request(
      "https://hilafood.pages.dev/api/payment?Authority=arbitrary&Status=OK&amount=1000",
      { method: "GET" }
    ),
    env: { ZARINPAL_MERCHANT_ID: "test-only-not-a-real-secret" }
  });

  assert.equal(response.status, 503);
  assert.equal(response.headers.get("cache-control"), "no-store");
  assert.equal((await response.json()).success, false);
});

test("unsupported payment methods are rejected", async () => {
  const response = await onRequest({
    request: new Request("https://hilafood.pages.dev/api/payment", {
      method: "DELETE"
    }),
    env: {}
  });
  assert.equal(response.status, 405);
});
