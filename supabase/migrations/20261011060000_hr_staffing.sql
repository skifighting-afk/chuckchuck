CREATE TABLE hr_work_preferences (LIKE hr_buddy_assignments INCLUDING ALL);
ALTER TABLE hr_work_preferences ADD FOREIGN KEY(owner) REFERENCES stores(owner) ON UPDATE CASCADE ON DELETE CASCADE;
CREATE UNIQUE INDEX hr_preference_person_period ON hr_work_preferences(owner,(data->>'employeeId'),(data->>'period'),(data->>'periodKey'));
ALTER TABLE hr_work_preferences ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON hr_work_preferences FROM anon,authenticated;
