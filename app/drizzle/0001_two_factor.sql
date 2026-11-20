ALTER TABLE accounts ADD COLUMN totp_secret TEXT;
--> statement-breakpoint
ALTER TABLE accounts ADD COLUMN totp_step INTEGER NOT NULL DEFAULT -1;
--> statement-breakpoint
ALTER TABLE accounts ADD COLUMN recovery_hashes TEXT NOT NULL DEFAULT '[]';
--> statement-breakpoint
ALTER TABLE accounts ADD COLUMN verification_window INTEGER NOT NULL DEFAULT 0;
--> statement-breakpoint
ALTER TABLE accounts ADD COLUMN verification_count INTEGER NOT NULL DEFAULT 0;
--> statement-breakpoint
ALTER TABLE sessions ADD COLUMN two_factor_verified INTEGER NOT NULL DEFAULT 0;
--> statement-breakpoint
CREATE TABLE account_challenges (
  token TEXT PRIMARY KEY,
  account TEXT NOT NULL,
  login TEXT NOT NULL,
  salt TEXT,
  hash TEXT,
  secret TEXT,
  expires INTEGER NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0
);
--> statement-breakpoint
CREATE INDEX account_challenges_expiration ON account_challenges(expires);
