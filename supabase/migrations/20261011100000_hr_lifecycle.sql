CREATE TABLE hr_reminders (
 owner text NOT NULL REFERENCES stores(owner) ON UPDATE CASCADE ON DELETE CASCADE,
 id text NOT NULL, recipient text NOT NULL, day text NOT NULL, sent_at text NOT NULL,
 PRIMARY KEY(owner,id,recipient,day)
);
ALTER TABLE hr_reminders ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON hr_reminders FROM anon,authenticated;

-- Durable attribution is solely for privacy cleanup after account unlinking, never authorization.
CREATE TABLE hr_actor_links (
 owner text NOT NULL REFERENCES stores(owner) ON UPDATE CASCADE ON DELETE CASCADE,
 employee_id text NOT NULL,user_id text NOT NULL,PRIMARY KEY(owner,employee_id,user_id)
);
ALTER TABLE hr_actor_links ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON hr_actor_links FROM anon,authenticated;

CREATE FUNCTION redact_hr_person(original jsonb,eid text,actors text[]) RETURNS jsonb LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE result jsonb := original; k text; entries jsonb;
BEGIN
 IF original->>'createdBy'=ANY(actors) THEN result:=result||jsonb_build_object('createdBy',''); END IF;
 IF original->>'checkedBy'=ANY(actors) THEN result:=result||jsonb_build_object('checkedBy',NULL,'note',''); END IF;
 IF original->>'reviewedBy'=ANY(actors) THEN result:=result||jsonb_build_object('reviewedBy',NULL,'reviewedAt',NULL,'reviewNote',''); END IF;
 IF original->>'privateNoteBy'=ANY(actors) OR original->>'privateNoteByEmployeeId'=eid OR (original ? 'privateNote' AND (original->>'createdBy'=ANY(actors) OR original->>'assigneeId'=eid)) THEN result:=result||jsonb_build_object('privateNote','','privateNoteBy',NULL,'privateNoteByEmployeeId',NULL); END IF;
 IF original->>'buddyId'=eid THEN result:=result||jsonb_build_object('buddyId',''); END IF;
 IF original->>'assigneeId'=eid THEN result:=result||jsonb_build_object('assigneeId',CASE WHEN original ? 'privateNote' THEN to_jsonb('owner'::text) ELSE 'null'::jsonb END); END IF;
 IF original->>'createdBy'=ANY(actors) AND original ? 'assignmentId' THEN result:=result||jsonb_build_object('note',''); END IF;
 IF original->>'createdBy'=ANY(actors) AND original ? 'meetingId' AND original ? 'text' THEN result:=result||jsonb_build_object('text','이전 약속 · 작성 내용 익명화'); END IF;
 IF original ? 'steps' THEN
  SELECT COALESCE(jsonb_agg(CASE WHEN v->>'noteBy'=ANY(actors) OR v->>'noteByEmployeeId'=eid OR (original->>'buddyId'=eid AND COALESCE(v->>'noteBy','')='') THEN v||jsonb_build_object('note','','noteBy',NULL,'noteByEmployeeId',NULL) ELSE v END ORDER BY ord),'[]'::jsonb) INTO entries FROM jsonb_array_elements(original->'steps') WITH ORDINALITY x(v,ord);
  result:=jsonb_set(result,'{steps}',entries);
 END IF;
 IF original ? 'employeeIds' THEN result:=jsonb_set(result,'{employeeIds}',COALESCE((SELECT jsonb_agg(v) FROM jsonb_array_elements(original->'employeeIds') x(v) WHERE v<>to_jsonb(eid)),'[]'::jsonb)); END IF;
 FOREACH k IN ARRAY ARRAY['changes','history'] LOOP
  IF original ? k THEN
   SELECT COALESCE(jsonb_agg(v ORDER BY ord),'[]'::jsonb) INTO entries FROM jsonb_array_elements(original->k) WITH ORDINALITY x(v,ord)
    WHERE NOT EXISTS(SELECT 1 FROM jsonb_path_query(v,'$.**') z(part) WHERE part=to_jsonb(eid) OR (jsonb_typeof(part)='string' AND part#>>'{}'=ANY(actors)));
   result:=jsonb_set(result,ARRAY[k],entries);
  END IF;
 END LOOP;
 RETURN result;
END $$;

CREATE FUNCTION reconcile_hr_people() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
 previous jsonb; current_person jsonb; eid text; actor_ids text[]; t text;
 old_data jsonb := OLD.data::jsonb; new_data jsonb := NEW.data::jsonb;
 stamp text := to_char(clock_timestamp() AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"');
 today_kst text := to_char(clock_timestamp() AT TIME ZONE 'Asia/Seoul','YYYY-MM-DD');
BEGIN
 INSERT INTO hr_actor_links(owner,employee_id,user_id)
  SELECT NEW.owner,m->>'employeeId',m->>'userId' FROM jsonb_array_elements(COALESCE(old_data->'_members','[]'::jsonb)) x(m)
  WHERE COALESCE(m->>'userId','')<>'' AND EXISTS(SELECT 1 FROM jsonb_array_elements(COALESCE(old_data->'employees','[]'::jsonb)) e(p) WHERE p->>'id'=m->>'employeeId' AND COALESCE(p->>'anonymizedAt','')='') ON CONFLICT DO NOTHING;
 FOR previous IN SELECT value FROM jsonb_array_elements(COALESCE(old_data->'employees','[]'::jsonb)) LOOP
  eid := previous->>'id';
  SELECT value INTO current_person FROM jsonb_array_elements(COALESCE(new_data->'employees','[]'::jsonb)) WHERE value->>'id'=eid;
  SELECT COALESCE(array_agg(value),ARRAY[]::text[]) INTO actor_ids FROM (SELECT user_id AS value FROM hr_actor_links WHERE owner=NEW.owner AND employee_id=eid) link;
  IF current_person IS NULL OR (COALESCE(current_person->>'anonymizedAt','')<>'' AND COALESCE(previous->>'anonymizedAt','')='') THEN
   UPDATE hr_cases SET data=jsonb_set(data,'{status}','"handover"'::jsonb) WHERE owner=NEW.owner AND data->>'assigneeId'=eid AND data->>'status'<>'closed';
   -- Delete the person's own records, not unrelated records made by this person.
   DELETE FROM hr_candidates WHERE owner=NEW.owner AND data->>'convertedEmployeeId'=eid;
   DELETE FROM hr_buddy_assignments WHERE owner=NEW.owner AND data->>'employeeId'=eid;
   DELETE FROM hr_skill_records WHERE owner=NEW.owner AND data->>'employeeId'=eid;
   DELETE FROM hr_work_preferences WHERE owner=NEW.owner AND data->>'employeeId'=eid;
   DELETE FROM hr_meetings WHERE owner=NEW.owner AND data->>'employeeId'=eid;
   DELETE FROM hr_meeting_actions WHERE owner=NEW.owner AND data->>'employeeId'=eid;
   DELETE FROM hr_meeting_comments WHERE owner=NEW.owner AND created_by=ANY(actor_ids);
   DELETE FROM hr_cases WHERE owner=NEW.owner AND data->>'employeeId'=eid;
   DELETE FROM hr_case_messages WHERE owner=NEW.owner AND (data->>'fromEmployeeId'=eid OR created_by=ANY(actor_ids));
   DELETE FROM hr_pulse_answers WHERE owner=NEW.owner AND data->>'employeeId'=eid;
   DELETE FROM hr_item_assignments WHERE owner=NEW.owner AND data->>'employeeId'=eid;
   FOREACH t IN ARRAY ARRAY['hr_candidates','hr_buddy_assignments','hr_skill_definitions','hr_skill_records','hr_work_preferences','hr_meetings','hr_meeting_actions','hr_meeting_comments','hr_cases','hr_case_messages','hr_pulse_campaigns','hr_pulse_answers','hr_item_assignments','hr_item_events'] LOOP
    EXECUTE format('UPDATE %I SET data=redact_hr_person(data,$2,$3),created_by=CASE WHEN created_by=ANY($3) THEN '''' ELSE created_by END,version=version+1,updated_at=$4 WHERE owner=$1 AND (data IS DISTINCT FROM redact_hr_person(data,$2,$3) OR created_by=ANY($3))',t) USING NEW.owner,eid,actor_ids,stamp;
   END LOOP;
   DELETE FROM hr_grants WHERE owner=NEW.owner AND employee_id=eid;
   UPDATE hr_grants SET created_by='',version=version+1,updated_at=stamp WHERE owner=NEW.owner AND created_by=ANY(actor_ids);
   DELETE FROM hr_actor_links WHERE owner=NEW.owner AND employee_id=eid;
   DELETE FROM hr_audit WHERE owner=NEW.owner AND actor=ANY(actor_ids);
   DELETE FROM hr_reminders WHERE owner=NEW.owner AND recipient=ANY(actor_ids);
   UPDATE hr_settings SET updated_by=NULL WHERE owner=NEW.owner AND updated_by=ANY(actor_ids);
  ELSE
   IF current_person->>'branchId' IS DISTINCT FROM previous->>'branchId'
    OR (current_person->>'status'='퇴사' AND (COALESCE(current_person->>'endDate','') !~ '^\d{4}-\d{2}-\d{2}$' OR current_person->>'endDate'<today_kst))
    OR EXISTS(SELECT 1 FROM jsonb_array_elements(COALESCE(old_data->'_members','[]'::jsonb)) old_member WHERE old_member->>'employeeId'=eid AND NOT EXISTS(SELECT 1 FROM jsonb_array_elements(COALESCE(new_data->'_members','[]'::jsonb)) m WHERE m->>'userId'=old_member->>'userId' AND m->>'employeeId'=eid)) THEN
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
