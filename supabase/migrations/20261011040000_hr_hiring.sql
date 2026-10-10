CREATE TABLE hr_candidates (
 owner text NOT NULL REFERENCES stores(owner) ON UPDATE CASCADE ON DELETE CASCADE,
 id text NOT NULL, branch_id text NOT NULL, data jsonb NOT NULL CHECK(jsonb_typeof(data)='object'),
 version integer NOT NULL CHECK(version>0), created_by text NOT NULL,
 created_at text NOT NULL, updated_at text NOT NULL, PRIMARY KEY(owner,id)
);
CREATE INDEX hr_candidates_branch ON hr_candidates(owner,branch_id,updated_at);
ALTER TABLE hr_candidates ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON hr_candidates FROM anon,authenticated;
