# Course access and payment safety

## Current state

The course-payment endpoint intentionally returns HTTP 503 for GET/POST until a verified server-side order and authenticated account flow exists. It does not accept client-supplied amounts, and URL parameters such as `Status=OK` do not grant access. Product orders remain on the separate store API; no real payment or SMS was tested.

The repository currently does not provide a complete phone-verified account/session system or a persisted course entitlement model. Course chapters and lessons can be managed by an authenticated admin, but there is no public endpoint that releases paid lesson content to a verified owner. This is fail-closed, not a completed purchase flow.

## Required design before enabling course purchases

1. Choose an OTP provider and document its delivery, rate limits, retention, regional availability, and pricing. No provider or new secret is configured by this branch.
2. Create an account/session design that verifies phone ownership; do not treat a submitted phone number as identity. Use expiring, one-time verification challenges, rate limits, attempt limits, and secure server-managed sessions.
3. Store course orders separately from product orders. Each course order must bind an authenticated user, course ID, server-calculated payable amount, currency, payment state, and a unique payment Authority.
4. Verify the payment with the provider from the server and compare the verified amount/currency against that exact order. Ignore client-supplied amount and callback success flags.
5. Grant course entitlement only after successful verification and a transactional, idempotent order-state update. A duplicate callback must not create duplicate entitlements.
6. Authorize every paid lesson read on the server using the verified session and entitlement. Free lessons may be public only when their explicit free flag is set.
7. Keep the product-order flow and tables independent. Test payment logic only with mocks and a disposable database until an explicitly approved sandbox is available.

Until these criteria and tests are met, the payment endpoint must remain disabled. Do not apply any migration from this branch to production.

## OTP and provider decision

An OTP provider must be selected before implementation can send real verification messages. This branch must not create an account, API key, paid subscription, or secret. Once a provider is selected, configure credentials through the approved runtime's secret manager in a separate, explicitly authorized operational step. Use mocks for CI.

## Science article generation

The science article API supports admin-reviewed drafts and explicit publishing. There is no AI provider configured, so no scheduled content generator is enabled. Do not fabricate scientific citations or make a scheduled workflow that pretends to generate content. A future 14-day workflow needs an approved provider, a cost ceiling, secure secret injection, a persistent duplicate key, and an atomic lease/lock before it can create drafts. It must never publish automatically.
