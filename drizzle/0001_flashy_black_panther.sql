ALTER TABLE `carts` ADD `data_source` text DEFAULT 'demo' NOT NULL;--> statement-breakpoint
ALTER TABLE `store_offers` ADD `minimum_order_quantity` integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE `store_offers` ADD `order_step` integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE `store_offers` ADD `price_tiers` text DEFAULT '[]' NOT NULL;--> statement-breakpoint
ALTER TABLE `store_offers` ADD `last_error` text;