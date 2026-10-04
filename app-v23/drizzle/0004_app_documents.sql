CREATE TABLE document_activity (
 kind TEXT NOT NULL, document_id TEXT NOT NULL, viewed_at TEXT,
 download_requested_at TEXT, saved_at TEXT,
 PRIMARY KEY(kind,document_id)
);
CREATE TABLE payslip_documents (
 id TEXT PRIMARY KEY, owner_id TEXT NOT NULL, employee_id TEXT NOT NULL,
 employee_user_id TEXT NOT NULL, run_key TEXT NOT NULL, revision INTEGER NOT NULL,
 document_json TEXT NOT NULL, created_at TEXT NOT NULL,
 UNIQUE(owner_id,employee_id,run_key,revision)
);
CREATE INDEX payslip_recipient ON payslip_documents(employee_user_id,created_at);
CREATE TRIGGER immutable_payslip BEFORE UPDATE ON payslip_documents
 BEGIN SELECT RAISE(ABORT,'Sent payslip is immutable'); END;
