-- Hila Food stage 2: additive course purchase foundation.
-- Apply only with Wrangler D1 migrations after backup and separate approval.
-- This file is intentionally NOT executed against production D1 by this change.

ALTER TABLE courses ADD COLUMN discount_price INTEGER;

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  phone TEXT NOT NULL UNIQUE,
  phone_verified_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS auth_otp_challenges (
  id TEXT PRIMARY KEY,
  phone TEXT NOT NULL,
  code_hash TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  consumed_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_auth_otp_phone_created
  ON auth_otp_challenges(phone, created_at);

CREATE TABLE IF NOT EXISTS auth_sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TEXT NOT NULL,
  revoked_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_auth_sessions_user
  ON auth_sessions(user_id, expires_at);

CREATE TABLE IF NOT EXISTS course_orders (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  course_id INTEGER NOT NULL,
  list_price_toman INTEGER NOT NULL CHECK (list_price_toman >= 1000),
  amount_due_toman INTEGER NOT NULL CHECK (
    amount_due_toman >= 1000 AND amount_due_toman <= list_price_toman
  ),
  status TEXT NOT NULL DEFAULT 'pending_gateway'
    CHECK (status IN ('pending_gateway', 'pending_payment', 'paid', 'failed', 'cancelled')),
  gateway TEXT NOT NULL DEFAULT 'zarinpal',
  gateway_authority TEXT UNIQUE,
  gateway_ref_id TEXT UNIQUE,
  verified_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (course_id) REFERENCES courses(id)
);
CREATE INDEX IF NOT EXISTS idx_course_orders_user_created
  ON course_orders(user_id, created_at);
CREATE INDEX IF NOT EXISTS idx_course_orders_status_created
  ON course_orders(status, created_at);

CREATE TABLE IF NOT EXISTS course_entitlements (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,
  course_id INTEGER NOT NULL,
  course_order_id TEXT NOT NULL UNIQUE,
  granted_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (user_id, course_id),
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (course_id) REFERENCES courses(id),
  FOREIGN KEY (course_order_id) REFERENCES course_orders(id)
);

CREATE TRIGGER IF NOT EXISTS trg_course_order_cannot_insert_paid
BEFORE INSERT ON course_orders
WHEN NEW.status = 'paid'
BEGIN
  SELECT RAISE(ABORT, 'course order cannot be inserted as paid');
END;

-- Defense in depth: a course cannot become paid unless the account is verified
-- and a server-verified gateway reference has been stored.
CREATE TRIGGER IF NOT EXISTS trg_course_order_paid_requires_verified_user
BEFORE UPDATE OF status ON course_orders
WHEN NEW.status = 'paid'
BEGIN
  SELECT CASE WHEN OLD.status <> 'pending_payment'
    THEN RAISE(ABORT, 'course order must be pending payment') END;
  SELECT CASE WHEN NOT EXISTS (
    SELECT 1 FROM users u
    WHERE u.id = NEW.user_id AND u.phone_verified_at IS NOT NULL
  ) THEN RAISE(ABORT, 'course order requires verified user') END;
  SELECT CASE WHEN NEW.gateway_authority IS NULL
    OR NEW.gateway_ref_id IS NULL
    OR NEW.verified_at IS NULL
    THEN RAISE(ABORT, 'course order requires verified gateway reference') END;
END;

-- A paid order is immutable in this first version; refunds/reversals need a
-- separately designed lifecycle and must not silently revoke course access.
CREATE TRIGGER IF NOT EXISTS trg_course_order_paid_is_terminal
BEFORE UPDATE OF status ON course_orders
WHEN OLD.status = 'paid' AND NEW.status <> 'paid'
BEGIN
  SELECT RAISE(ABORT, 'paid course order is terminal');
END;

-- Entitlement can only be granted from the matching paid order and verified user.
CREATE TRIGGER IF NOT EXISTS trg_course_entitlement_requires_paid_order
BEFORE INSERT ON course_entitlements
BEGIN
  SELECT CASE WHEN NOT EXISTS (
    SELECT 1
    FROM course_orders o
    JOIN users u ON u.id = o.user_id
    WHERE o.id = NEW.course_order_id
      AND o.user_id = NEW.user_id
      AND o.course_id = NEW.course_id
      AND o.status = 'paid'
      AND o.verified_at IS NOT NULL
      AND u.phone_verified_at IS NOT NULL
  ) THEN RAISE(ABORT, 'entitlement requires matching verified paid order') END;
END;

CREATE TRIGGER IF NOT EXISTS trg_course_entitlement_immutable_update
BEFORE UPDATE ON course_entitlements
BEGIN
  SELECT RAISE(ABORT, 'course entitlement is immutable');
END;

CREATE TRIGGER IF NOT EXISTS trg_course_entitlement_immutable_delete
BEFORE DELETE ON course_entitlements
BEGIN
  SELECT RAISE(ABORT, 'course entitlement deletion requires a separate process');
END;
