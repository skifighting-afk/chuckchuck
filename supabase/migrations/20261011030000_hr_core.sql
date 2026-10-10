CREATE TABLE hr_grants (
 owner text NOT NULL REFERENCES stores(owner) ON UPDATE CASCADE ON DELETE CASCADE,
 id text NOT NULL, branch_id text NOT NULL, employee_id text NOT NULL,
 scope text NOT NULL CHECK(scope IN ('hiring','training','staffing','meetings','cases','pulse','items')),
 valid_until text, revoked_at text, created_by text NOT NULL,
 created_at text NOT NULL, updated_at text NOT NULL, version integer NOT NULL DEFAULT 1 CHECK(version>0),
 PRIMARY KEY(owner,id)
);
CREATE UNIQUE INDEX hr_grant_active ON hr_grants(owner,branch_id,employee_id,scope) WHERE revoked_at IS NULL;
CREATE TABLE hr_audit (
 owner text NOT NULL REFERENCES stores(owner) ON UPDATE CASCADE ON DELETE CASCADE,
 id text NOT NULL, branch_id text NOT NULL, actor text NOT NULL, request_id text NOT NULL,
 operation text NOT NULL, fingerprint text NOT NULL, target_id text NOT NULL, created_at text NOT NULL,
 PRIMARY KEY(owner,id), UNIQUE(owner,actor,request_id)
);
CREATE TABLE hr_settings (
 owner text PRIMARY KEY REFERENCES stores(owner) ON UPDATE CASCADE ON DELETE CASCADE,
 candidate_retention_days integer CHECK(candidate_retention_days BETWEEN 1 AND 3650),
 updated_at text, updated_by text
);
ALTER TABLE hr_grants ENABLE ROW LEVEL SECURITY;
ALTER TABLE hr_audit ENABLE ROW LEVEL SECURITY;
ALTER TABLE hr_settings ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON hr_grants,hr_audit,hr_settings FROM anon,authenticated;
