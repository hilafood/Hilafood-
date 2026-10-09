# Stage 5 — course checkout foundation

This stage adds a server-side course checkout and callback path without changing the existing product checkout endpoint.

## Routes

- \`POST /api/course-checkout\`: requires a same-origin JSON request and a valid phone-verified session. It reads the active course and server-side price/discount from D1, creates one order for the whole course, and requests a Zarinpal authority using the saved amount.
- \`GET /api/course-payment\`: looks up the saved order by opaque order ID, checks the saved authority and pending status, calls Zarinpal verification using the saved amount, then uses one D1 batch to mark the order paid and grant course-level entitlement.
- \`GET /api/course-orders\`: returns only the signed-in user's course orders.

The existing \`/api/payment\` product payment route and product order tables are unchanged.

## Deliberate operational gate

The new checkout and entitlement display remain disabled unless the server environment contains \`COURSE_PAYMENTS_ENABLED=approved\`. This value was not set or changed by this commit. The gateway merchant credential must be provided as the existing Cloudflare secret \`ZARINPAL_MERCHANT_ID\`; no secret was added or modified. Tests use a stubbed gateway transport and never contact Zarinpal.

Before separate operational approval, review and apply migrations \`0002_course_purchase_foundation.sql\` and \`0003_auth_rate_limits.sql\` to the target D1 database, confirm the merchant credential and callback URL, and run a separately authorized gateway test. No live migration, payment, SMS, or Cloudflare setting change is part of this stage.

## Access and media

Entitlement is tied to the same user, course, and paid order; database triggers prevent direct insertion of a paid order, mismatched entitlement, and downgrading a paid order. Public/external video URLs are not considered protected. Paid lesson text can be delivered after server-side entitlement is enabled, but paid video delivery remains unavailable until private media storage or an authenticated media proxy is separately designed and reviewed.
