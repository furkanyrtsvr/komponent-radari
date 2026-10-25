CREATE TABLE `archive_image_cache` (
	`url` text PRIMARY KEY NOT NULL,
	`image_key` text NOT NULL,
	`bytes` integer DEFAULT 0 NOT NULL,
	`original_bytes` integer DEFAULT 0 NOT NULL
);

--> statement-breakpoint
INSERT OR IGNORE INTO archive_image_cache(url,image_key,bytes,original_bytes)
SELECT json_extract(payload,'$.product.image'),image_key,COALESCE(json_extract(payload,'$.preparedImage.bytes'),0),COALESCE(json_extract(payload,'$.preparedImage.originalBytes'),0)
FROM archive_batch_rows WHERE ready=1 AND image_key IS NOT NULL AND json_extract(payload,'$.product.image') IS NOT NULL;
