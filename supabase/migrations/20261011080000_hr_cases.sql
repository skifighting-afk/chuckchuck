CREATE TABLE hr_cases (LIKE hr_buddy_assignments INCLUDING ALL);
CREATE TABLE hr_case_messages (LIKE hr_buddy_assignments INCLUDING ALL);
ALTER TABLE hr_cases ADD FOREIGN KEY(owner) REFERENCES stores(owner) ON UPDATE CASCADE ON DELETE CASCADE;
ALTER TABLE hr_case_messages ADD FOREIGN KEY(owner) REFERENCES stores(owner) ON UPDATE CASCADE ON DELETE CASCADE;
ALTER TABLE hr_case_messages ADD case_id text GENERATED ALWAYS AS (data->>'caseId') STORED;
ALTER TABLE hr_case_messages ADD FOREIGN KEY(owner,case_id) REFERENCES hr_cases(owner,id) ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE hr_cases ENABLE ROW LEVEL SECURITY;
ALTER TABLE hr_case_messages ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON hr_cases,hr_case_messages FROM anon,authenticated;
