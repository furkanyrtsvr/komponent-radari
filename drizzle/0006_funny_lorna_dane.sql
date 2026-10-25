CREATE TABLE `archive_batch_rows` (
	`id` text PRIMARY KEY NOT NULL,
	`batch_id` text NOT NULL,
	`source_id` text NOT NULL,
	`store_id` text NOT NULL,
	`url` text NOT NULL,
	`checked_at` text NOT NULL,
	`payload` text NOT NULL,
	`ready` integer DEFAULT 0 NOT NULL,
	`image_key` text
);
--> statement-breakpoint
CREATE INDEX `archive_batch_source` ON `archive_batch_rows` (`batch_id`,`source_id`);--> statement-breakpoint
CREATE INDEX `archive_batch_url` ON `archive_batch_rows` (`batch_id`,`url`);--> statement-breakpoint
CREATE TABLE `archive_batches` (
	`id` text PRIMARY KEY NOT NULL,
	`state` text DEFAULT 'building' NOT NULL,
	`created_at` text NOT NULL,
	`cutoff` text NOT NULL,
	`published_at` text,
	`manifest` text
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `catalog_collection_runs` (
	`id` text PRIMARY KEY NOT NULL,
	`updated_at` text NOT NULL,
	`payload` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `feedback_messages` (
	`id` text PRIMARY KEY NOT NULL,
	`report_id` text NOT NULL,
	`author_id` text NOT NULL,
	`author_role` text NOT NULL,
	`body` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`report_id`) REFERENCES `feedback_reports`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`author_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `feedback_conversation` ON `feedback_messages` (`report_id`,`created_at`);--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `feedback_reports` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`title` text NOT NULL,
	`kind` text NOT NULL,
	`status` text NOT NULL,
	`context` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `feedback_owner_updated` ON `feedback_reports` (`user_id`,`updated_at`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `feedback_updated` ON `feedback_reports` (`updated_at`);