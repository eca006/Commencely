CREATE TABLE accounts (id TEXT PRIMARY KEY, login TEXT NOT NULL UNIQUE, salt TEXT NOT NULL, hash TEXT NOT NULL);
--> statement-breakpoint
CREATE TABLE sessions (token TEXT PRIMARY KEY, account TEXT NOT NULL, expires INTEGER NOT NULL);
--> statement-breakpoint
CREATE INDEX sessions_expiration ON sessions(expires);
