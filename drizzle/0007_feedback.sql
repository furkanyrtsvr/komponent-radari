CREATE TABLE IF NOT EXISTS feedback_reports (
 id TEXT PRIMARY KEY NOT NULL,
 user_id TEXT NOT NULL REFERENCES users(id),
 title TEXT NOT NULL, kind TEXT NOT NULL, status TEXT NOT NULL,
 context TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS feedback_owner_updated ON feedback_reports(user_id,updated_at);
CREATE INDEX IF NOT EXISTS feedback_updated ON feedback_reports(updated_at);
CREATE TABLE IF NOT EXISTS feedback_messages (
 id TEXT PRIMARY KEY NOT NULL,
 report_id TEXT NOT NULL REFERENCES feedback_reports(id),
 author_id TEXT NOT NULL REFERENCES users(id),
 author_role TEXT NOT NULL, body TEXT NOT NULL, created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS feedback_conversation ON feedback_messages(report_id,created_at);
