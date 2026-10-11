CREATE TABLE IF NOT EXISTS start_guide_preferences (
 user_id TEXT NOT NULL,
 owner TEXT NOT NULL REFERENCES stores(owner) ON UPDATE CASCADE ON DELETE CASCADE,
 branch_id TEXT NOT NULL,
 role TEXT NOT NULL CHECK(role IN ('owner','manager','employee')),
 guide_kind TEXT NOT NULL CHECK(guide_kind IN ('personal','management')),
 guide_version TEXT NOT NULL,
 preferences JSONB NOT NULL DEFAULT '{}',
 revision INTEGER NOT NULL DEFAULT 0 CHECK(revision>=0),
 last_request_id TEXT,
 last_request_hash TEXT,
 updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 PRIMARY KEY(user_id,owner,branch_id,role,guide_kind,guide_version)
);
ALTER TABLE start_guide_preferences ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON start_guide_preferences FROM PUBLIC,anon,authenticated;
