CREATE TABLE hr_reminders (
 owner text NOT NULL REFERENCES stores(owner) ON UPDATE CASCADE ON DELETE CASCADE,
 id text NOT NULL, recipient text NOT NULL, day text NOT NULL, sent_at text NOT NULL,
 PRIMARY KEY(owner,id,recipient,day)
);
ALTER TABLE hr_reminders ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON hr_reminders FROM anon,authenticated;

CREATE FUNCTION reconcile_hr_people() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
 previous jsonb; current_person jsonb; eid text; actor_ids text[]; t text;
 old_data jsonb := OLD.data::jsonb; new_data jsonb := NEW.data::jsonb;
 stamp text := to_char(clock_timestamp() AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"');
 today_kst text := to_char(clock_timestamp() AT TIME ZONE 'Asia/Seoul','YYYY-MM-DD');
BEGIN
 FOR previous IN SELECT value FROM jsonb_array_elements(COALESCE(old_data->'employees','[]'::jsonb)) LOOP
  eid := previous->>'id';
  SELECT value INTO current_person FROM jsonb_array_elements(COALESCE(new_data->'employees','[]'::jsonb)) WHERE value->>'id'=eid;
  SELECT COALESCE(array_agg(value->>'userId'),ARRAY[]::text[]) INTO actor_ids FROM jsonb_array_elements(COALESCE(old_data->'_members','[]'::jsonb)) WHERE value->>'employeeId'=eid;
  IF current_person IS NULL OR (COALESCE(current_person->>'anonymizedAt','')<>'' AND COALESCE(previous->>'anonymizedAt','')='') THEN
   FOREACH t IN ARRAY ARRAY['hr_candidates','hr_buddy_assignments','hr_skill_definitions','hr_skill_records','hr_work_preferences','hr_meetings','hr_meeting_actions','hr_meeting_comments','hr_cases','hr_case_messages','hr_pulse_campaigns','hr_pulse_answers','hr_item_assignments','hr_item_events'] LOOP
    EXECUTE format('DELETE FROM %I WHERE owner=$1 AND (data->>''employeeId''=$2 OR data->>''buddyId''=$2 OR data->>''assigneeId''=$2 OR data->>''convertedEmployeeId''=$2 OR created_by=ANY($3) OR data->>''checkedBy''=ANY($3))',t) USING NEW.owner,eid,actor_ids;
   END LOOP;
   UPDATE hr_pulse_campaigns SET data=jsonb_set(data,'{employeeIds}',COALESCE((SELECT jsonb_agg(value) FROM jsonb_array_elements(data->'employeeIds') WHERE value<>to_jsonb(eid)),'[]'::jsonb)),version=version+1,updated_at=stamp WHERE owner=NEW.owner AND data->'employeeIds' @> jsonb_build_array(eid);
   DELETE FROM hr_grants WHERE owner=NEW.owner AND (employee_id=eid OR created_by=ANY(actor_ids));
   DELETE FROM hr_audit WHERE owner=NEW.owner AND actor=ANY(actor_ids);
   DELETE FROM hr_reminders WHERE owner=NEW.owner AND recipient=ANY(actor_ids);
   UPDATE hr_settings SET updated_by=NULL WHERE owner=NEW.owner AND updated_by=ANY(actor_ids);
  ELSE
   IF current_person->>'branchId' IS DISTINCT FROM previous->>'branchId'
    OR (current_person->>'status'='퇴사' AND (COALESCE(current_person->>'endDate','') !~ '^\d{4}-\d{2}-\d{2}$' OR current_person->>'endDate'<today_kst))
    OR EXISTS(SELECT 1 FROM unnest(actor_ids) a WHERE NOT EXISTS(SELECT 1 FROM jsonb_array_elements(COALESCE(new_data->'_members','[]'::jsonb)) m WHERE m->>'userId'=a AND m->>'employeeId'=eid)) THEN
    UPDATE hr_grants SET revoked_at=stamp,updated_at=stamp,version=version+1 WHERE owner=NEW.owner AND employee_id=eid AND revoked_at IS NULL;
    UPDATE hr_cases SET data=jsonb_set(data,'{status}','"handover"'::jsonb),version=version+1,updated_at=stamp WHERE owner=NEW.owner AND data->>'assigneeId'=eid AND data->>'status'<>'closed';
   END IF;
   -- Desired work belongs to the same person after a branch move. Review must start again.
   IF current_person->>'branchId' IS DISTINCT FROM previous->>'branchId' THEN
    UPDATE hr_work_preferences SET branch_id=current_person->>'branchId',data=data||jsonb_build_object('reviewedAt',NULL,'reviewedBy',NULL,'reviewNote',''),version=version+1,updated_at=stamp WHERE owner=NEW.owner AND data->>'employeeId'=eid;
   END IF;
  END IF;
 END LOOP;
 RETURN NEW;
END $$;
CREATE TRIGGER reconcile_hr_people AFTER UPDATE OF data ON stores FOR EACH ROW EXECUTE FUNCTION reconcile_hr_people();
