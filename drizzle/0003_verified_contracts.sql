CREATE TABLE auth_verifications (
 token_hash TEXT PRIMARY KEY NOT NULL,
 user_id TEXT NOT NULL REFERENCES auth_users(id),
 email TEXT NOT NULL,
 expires_at INTEGER NOT NULL,
 created_at INTEGER NOT NULL
);
CREATE INDEX auth_verifications_user ON auth_verifications(user_id);
CREATE TABLE contract_envelopes (
 id TEXT PRIMARY KEY NOT NULL,
 owner_id TEXT NOT NULL,
 employee_id TEXT NOT NULL,
 employee_user_id TEXT NOT NULL,
 document_json TEXT NOT NULL,
 document_hash TEXT NOT NULL,
 owner_signature TEXT NOT NULL,
 employee_signature TEXT,
 status TEXT NOT NULL CHECK(status IN ('waiting','signed','declined','withdrawn')),
 version INTEGER NOT NULL DEFAULT 1,
 created_at TEXT NOT NULL,
 completed_at TEXT,
 reason TEXT NOT NULL DEFAULT '',
 delivery_method TEXT,
 delivery_status TEXT NOT NULL DEFAULT 'not_ready',
 delivery_provider_id TEXT,
 delivery_at TEXT,
 received_at TEXT,
 received_by TEXT
);
CREATE INDEX contract_owner ON contract_envelopes(owner_id,created_at);
CREATE INDEX contract_employee ON contract_envelopes(employee_user_id,created_at);
CREATE UNIQUE INDEX contract_waiting ON contract_envelopes(owner_id,employee_id) WHERE status='waiting';
CREATE TABLE contract_events (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 envelope_id TEXT NOT NULL,
 version INTEGER NOT NULL,
 status TEXT NOT NULL,
 recorded_at TEXT NOT NULL,
 record_json TEXT NOT NULL
);
CREATE TRIGGER contract_immutable BEFORE UPDATE OF owner_id,employee_id,employee_user_id,document_json,document_hash,owner_signature,created_at ON contract_envelopes
BEGIN SELECT RAISE(ABORT,'Contract snapshot is immutable'); END;
CREATE TRIGGER contract_signed_immutable BEFORE UPDATE OF employee_signature,status,completed_at,delivery_method ON contract_envelopes WHEN OLD.status='signed'
BEGIN SELECT RAISE(ABORT,'Completed signatures are immutable'); END;
CREATE TRIGGER contract_event_insert AFTER INSERT ON contract_envelopes
BEGIN INSERT INTO contract_events(envelope_id,version,status,recorded_at,record_json) VALUES(NEW.id,NEW.version,NEW.status,NEW.created_at,json_object('hash',NEW.document_hash,'ownerSignature',NEW.owner_signature)); END;
CREATE TRIGGER contract_event_update AFTER UPDATE ON contract_envelopes
BEGIN INSERT INTO contract_events(envelope_id,version,status,recorded_at,record_json) VALUES(NEW.id,NEW.version,NEW.status,strftime('%Y-%m-%dT%H:%M:%fZ','now'),json_object('hash',NEW.document_hash,'employeeSignature',NEW.employee_signature,'reason',NEW.reason,'deliveryMethod',NEW.delivery_method,'deliveryStatus',NEW.delivery_status,'providerId',NEW.delivery_provider_id,'deliveryAt',NEW.delivery_at,'receivedAt',NEW.received_at,'receivedBy',NEW.received_by)); END;
