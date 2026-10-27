CREATE TABLE `catalog_archive_changes` (
	`seq` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`source_id` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `archive_change_source` ON `catalog_archive_changes` (`source_id`);
--> statement-breakpoint
CREATE TRIGGER archive_snapshot_insert AFTER INSERT ON catalog_snapshots BEGIN
 INSERT INTO catalog_archive_changes(source_id) VALUES(NEW.id);
END;
--> statement-breakpoint
CREATE TRIGGER archive_snapshot_update AFTER UPDATE OF payload,checked_at ON catalog_snapshots WHEN NEW.payload<>OLD.payload OR NEW.checked_at<>OLD.checked_at BEGIN
 INSERT INTO catalog_archive_changes(source_id) VALUES(NEW.id);
END;
