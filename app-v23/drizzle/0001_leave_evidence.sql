CREATE TABLE leave_evidence (
 id TEXT PRIMARY KEY NOT NULL,
 owner TEXT NOT NULL,
 leave_id TEXT NOT NULL,
 employee_id TEXT NOT NULL,
 mime TEXT NOT NULL,
 body TEXT NOT NULL,
 bytes INTEGER NOT NULL,
 created_at TEXT NOT NULL,
 expires_at TEXT NOT NULL
);
CREATE INDEX evidence_owner_leave ON leave_evidence(owner, leave_id);
