ALTER TABLE accounts ADD COLUMN recovery_email TEXT;
--> statement-breakpoint
ALTER TABLE accounts ADD COLUMN security_version INTEGER NOT NULL DEFAULT 0;
--> statement-breakpoint
ALTER TABLE sessions ADD COLUMN account_version INTEGER NOT NULL DEFAULT 0;
--> statement-breakpoint
ALTER TABLE account_challenges ADD COLUMN account_version INTEGER NOT NULL DEFAULT 0;
--> statement-breakpoint
CREATE TABLE recovery_requests (
  token TEXT PRIMARY KEY,
  account TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('verify', 'reset')),
  email TEXT NOT NULL,
  account_version INTEGER NOT NULL,
  expires INTEGER NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0
);
--> statement-breakpoint
CREATE INDEX recovery_requests_account ON recovery_requests(account, kind);
--> statement-breakpoint
CREATE INDEX recovery_requests_expiration ON recovery_requests(expires);
--> statement-breakpoint
CREATE TABLE recovery_limits (
  key TEXT PRIMARY KEY,
  window INTEGER NOT NULL,
  count INTEGER NOT NULL DEFAULT 0
);
