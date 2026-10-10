CREATE TABLE hr_buddy_assignments (
 owner text NOT NULL REFERENCES stores(owner) ON UPDATE CASCADE ON DELETE CASCADE,
 id text NOT NULL, branch_id text NOT NULL, data jsonb NOT NULL, version integer NOT NULL CHECK(version>0),
 created_by text NOT NULL, created_at text NOT NULL, updated_at text NOT NULL, PRIMARY KEY(owner,id)
);
CREATE TABLE hr_skill_definitions (LIKE hr_buddy_assignments INCLUDING ALL);
ALTER TABLE hr_skill_definitions ADD FOREIGN KEY(owner) REFERENCES stores(owner) ON UPDATE CASCADE ON DELETE CASCADE;
CREATE TABLE hr_skill_records (LIKE hr_buddy_assignments INCLUDING ALL);
ALTER TABLE hr_skill_records ADD FOREIGN KEY(owner) REFERENCES stores(owner) ON UPDATE CASCADE ON DELETE CASCADE;
ALTER TABLE hr_skill_records ADD skill_id text GENERATED ALWAYS AS (data->>'skillId') STORED;
ALTER TABLE hr_skill_records ADD FOREIGN KEY(owner,skill_id) REFERENCES hr_skill_definitions(owner,id) ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED;
CREATE UNIQUE INDEX hr_skill_record_person ON hr_skill_records(owner,(data->>'employeeId'),skill_id);
CREATE INDEX hr_buddy_branch ON hr_buddy_assignments(owner,branch_id);
CREATE INDEX hr_skill_branch ON hr_skill_definitions(owner,branch_id);
ALTER TABLE hr_buddy_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE hr_skill_definitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE hr_skill_records ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON hr_buddy_assignments,hr_skill_definitions,hr_skill_records FROM anon,authenticated;
