CREATE TABLE auth_users (
 id TEXT PRIMARY KEY NOT NULL,
 email TEXT UNIQUE NOT NULL,
 name TEXT NOT NULL,
 password_hash TEXT NOT NULL,
 salt TEXT NOT NULL,
 role TEXT NOT NULL,
 email_verified INTEGER NOT NULL DEFAULT 0,
 created_at INTEGER NOT NULL
);
CREATE TABLE auth_sessions (
 token_hash TEXT PRIMARY KEY NOT NULL,
 user_id TEXT NOT NULL REFERENCES auth_users(id),
 expires_at INTEGER NOT NULL
);
CREATE INDEX auth_sessions_user ON auth_sessions(user_id);
CREATE TABLE auth_limits (
 bucket TEXT PRIMARY KEY NOT NULL,
 hits INTEGER NOT NULL,
 expires_at INTEGER NOT NULL
);
CREATE TABLE auth_recovery (
 token_hash TEXT PRIMARY KEY NOT NULL,
 user_id TEXT NOT NULL REFERENCES auth_users(id),
 expires_at INTEGER NOT NULL
);
