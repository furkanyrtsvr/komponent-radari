CREATE TABLE `catalog_snapshots` (
	`id` text PRIMARY KEY NOT NULL,
	`store_id` text NOT NULL,
	`url` text NOT NULL,
	`checked_at` text NOT NULL,
	`payload` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `snapshot_store_url` ON `catalog_snapshots` (`store_id`,`url`);--> statement-breakpoint
CREATE INDEX `snapshot_checked` ON `catalog_snapshots` (`checked_at`);