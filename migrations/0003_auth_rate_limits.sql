-- Stage 3: authentication rate limiting.
-- Requires 0002_course_purchase_foundation.sql to have been applied to the target DB.
-- Never execute against production D1 without a separate approval and backup.

CREATE TABLE IF NOT EXISTS auth_rate_limits (
  key_hash TEXT PRIMARY KEY,
  scope TEXT NOT NULL,
  window_started_at INTEGER NOT NULL,
  count INTEGER NOT NULL CHECK (count >= 0),
  last_action_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_auth_rate_limits_last_action
  ON auth_rate_limits(last_action_at);

CREATE TRIGGER IF NOT EXISTS trg_auth_otp_attempt_limit
BEFORE UPDATE OF attempts ON auth_otp_challenges
WHEN NEW.attempts > 5
BEGIN
  SELECT RAISE(ABORT, 'OTP attempt limit exceeded');
END;

CREATE TRIGGER IF NOT EXISTS trg_auth_otp_consumed_immutable
BEFORE UPDATE ON auth_otp_challenges
WHEN OLD.consumed_at IS NOT NULL
BEGIN
  SELECT RAISE(ABORT, 'OTP challenge already consumed');
END;

CREATE TRIGGER IF NOT EXISTS trg_auth_session_token_immutable
BEFORE UPDATE OF token_hash, user_id ON auth_sessions
BEGIN
  SELECT RAISE(ABORT, 'session identity is immutable');
END;
