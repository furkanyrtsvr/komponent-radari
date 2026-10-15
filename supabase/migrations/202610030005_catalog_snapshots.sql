BEGIN;
CREATE TABLE catalog_snapshots (id text PRIMARY KEY,store_id text NOT NULL,url text NOT NULL,checked_at text NOT NULL,payload text NOT NULL);
CREATE UNIQUE INDEX snapshot_store_url ON catalog_snapshots(store_id,url);
CREATE INDEX snapshot_checked ON catalog_snapshots(checked_at);
ALTER TABLE catalog_snapshots ENABLE ROW LEVEL SECURITY;
COMMIT;
