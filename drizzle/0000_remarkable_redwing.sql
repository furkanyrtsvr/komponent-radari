CREATE TABLE `canonical_products` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`category` text NOT NULL,
	`manufacturer` text NOT NULL,
	`mpn` text NOT NULL,
	`model` text NOT NULL,
	`description` text NOT NULL,
	`image` text,
	`specifications` text NOT NULL,
	`unit_type` text NOT NULL,
	`package_quantity` integer NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `products_mpn` ON `canonical_products` (`mpn`);--> statement-breakpoint
CREATE INDEX `products_category` ON `canonical_products` (`category`);--> statement-breakpoint
CREATE TABLE `cart_items` (
	`id` text PRIMARY KEY NOT NULL,
	`cart_id` text NOT NULL,
	`canonical_product_id` text NOT NULL,
	`quantity` integer NOT NULL,
	`added_by` text NOT NULL,
	`notes` text DEFAULT '' NOT NULL,
	`allow_alternative` integer DEFAULT 0 NOT NULL,
	`preferred_manufacturer` text DEFAULT '' NOT NULL,
	`maximum_unit_price` integer,
	`created_at` text NOT NULL,
	FOREIGN KEY (`cart_id`) REFERENCES `carts`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`canonical_product_id`) REFERENCES `canonical_products`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`added_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `cart_items_cart` ON `cart_items` (`cart_id`);--> statement-breakpoint
CREATE TABLE `cart_members` (
	`id` text PRIMARY KEY NOT NULL,
	`cart_id` text NOT NULL,
	`user_id` text NOT NULL,
	`role` text NOT NULL,
	FOREIGN KEY (`cart_id`) REFERENCES `carts`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `cart_members_unique` ON `cart_members` (`cart_id`,`user_id`);--> statement-breakpoint
CREATE INDEX `cart_members_user` ON `cart_members` (`user_id`);--> statement-breakpoint
CREATE TABLE `cart_shares` (
	`id` text PRIMARY KEY NOT NULL,
	`cart_id` text NOT NULL,
	`role` text NOT NULL,
	`created_at` text NOT NULL,
	`expires_at` text NOT NULL,
	FOREIGN KEY (`cart_id`) REFERENCES `carts`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `shares_cart` ON `cart_shares` (`cart_id`);--> statement-breakpoint
CREATE TABLE `cart_snapshots` (
	`id` text PRIMARY KEY NOT NULL,
	`cart_id` text NOT NULL,
	`created_at` text NOT NULL,
	`total` integer NOT NULL,
	`payload` text NOT NULL,
	FOREIGN KEY (`cart_id`) REFERENCES `carts`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `snapshots_cart` ON `cart_snapshots` (`cart_id`);--> statement-breakpoint
CREATE TABLE `carts` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_id` text NOT NULL,
	`name` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`owner_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `carts_owner` ON `carts` (`owner_id`);--> statement-breakpoint
CREATE TABLE `favorites` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`canonical_product_id` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`canonical_product_id`) REFERENCES `canonical_products`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `favorite_user_product` ON `favorites` (`user_id`,`canonical_product_id`);--> statement-breakpoint
CREATE TABLE `price_alerts` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`canonical_product_id` text NOT NULL,
	`target_price` integer NOT NULL,
	`enabled` integer DEFAULT 1 NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`canonical_product_id`) REFERENCES `canonical_products`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `price_history` (
	`id` text PRIMARY KEY NOT NULL,
	`offer_id` text NOT NULL,
	`price_gross` integer NOT NULL,
	`stock_status` text NOT NULL,
	`checked_at` text NOT NULL,
	FOREIGN KEY (`offer_id`) REFERENCES `store_offers`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `history_offer_time` ON `price_history` (`offer_id`,`checked_at`);--> statement-breakpoint
CREATE TABLE `product_match_candidates` (
	`id` text PRIMARY KEY NOT NULL,
	`store_product_id` text NOT NULL,
	`canonical_product_id` text NOT NULL,
	`confidence` integer NOT NULL,
	`reason` text NOT NULL,
	`status` text NOT NULL,
	FOREIGN KEY (`store_product_id`) REFERENCES `store_products`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`canonical_product_id`) REFERENCES `canonical_products`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `product_specs` (
	`id` text PRIMARY KEY NOT NULL,
	`canonical_product_id` text NOT NULL,
	`name` text NOT NULL,
	`value` text NOT NULL,
	`unit` text,
	FOREIGN KEY (`canonical_product_id`) REFERENCES `canonical_products`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `rate_limits` (
	`id` text PRIMARY KEY NOT NULL,
	`count` integer NOT NULL,
	`expires_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `saved_optimizations` (
	`id` text PRIMARY KEY NOT NULL,
	`cart_id` text NOT NULL,
	`created_at` text NOT NULL,
	`payload` text NOT NULL,
	FOREIGN KEY (`cart_id`) REFERENCES `carts`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `scrape_jobs` (
	`id` text PRIMARY KEY NOT NULL,
	`store_id` text NOT NULL,
	`url` text NOT NULL,
	`status` text NOT NULL,
	`error` text,
	`created_at` text NOT NULL,
	`finished_at` text,
	FOREIGN KEY (`store_id`) REFERENCES `stores`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`expires_at` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `sessions_user` ON `sessions` (`user_id`);--> statement-breakpoint
CREATE TABLE `stock_alerts` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`canonical_product_id` text NOT NULL,
	`enabled` integer DEFAULT 1 NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`canonical_product_id`) REFERENCES `canonical_products`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `store_health` (
	`id` text PRIMARY KEY NOT NULL,
	`store_id` text NOT NULL,
	`success` integer NOT NULL,
	`message` text NOT NULL,
	`checked_at` text NOT NULL,
	FOREIGN KEY (`store_id`) REFERENCES `stores`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `health_store` ON `store_health` (`store_id`);--> statement-breakpoint
CREATE TABLE `store_offers` (
	`id` text PRIMARY KEY NOT NULL,
	`canonical_product_id` text NOT NULL,
	`store_id` text NOT NULL,
	`store_product_id` text NOT NULL,
	`title` text NOT NULL,
	`product_url` text NOT NULL,
	`image_url` text,
	`manufacturer` text NOT NULL,
	`mpn` text NOT NULL,
	`price_net` integer NOT NULL,
	`vat_rate` real NOT NULL,
	`price_gross` integer NOT NULL,
	`package_quantity` integer NOT NULL,
	`unit_price` integer NOT NULL,
	`currency` text NOT NULL,
	`vat_included` integer NOT NULL,
	`stock_status` text NOT NULL,
	`stock_quantity` integer,
	`match_confidence` integer NOT NULL,
	`match_type` text NOT NULL,
	`last_checked_at` text NOT NULL,
	`source` text NOT NULL,
	FOREIGN KEY (`canonical_product_id`) REFERENCES `canonical_products`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`store_id`) REFERENCES `stores`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`store_product_id`) REFERENCES `store_products`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `offers_product` ON `store_offers` (`canonical_product_id`);--> statement-breakpoint
CREATE INDEX `offers_store` ON `store_offers` (`store_id`);--> statement-breakpoint
CREATE TABLE `store_products` (
	`id` text PRIMARY KEY NOT NULL,
	`store_id` text NOT NULL,
	`url` text NOT NULL,
	`title` text NOT NULL,
	`mpn` text,
	`raw_data` text NOT NULL,
	FOREIGN KEY (`store_id`) REFERENCES `stores`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `store_products_store` ON `store_products` (`store_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `store_product_url` ON `store_products` (`store_id`,`url`);--> statement-breakpoint
CREATE TABLE `store_shipping_rules` (
	`id` text PRIMARY KEY NOT NULL,
	`store_id` text NOT NULL,
	`rules` text NOT NULL,
	`estimated` integer DEFAULT 1 NOT NULL,
	`source_url` text,
	`last_updated` text NOT NULL,
	FOREIGN KEY (`store_id`) REFERENCES `stores`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `stores` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`domain` text NOT NULL,
	`color` text NOT NULL,
	`enabled` integer DEFAULT 1 NOT NULL,
	`adapter_type` text NOT NULL,
	`supports_search` integer NOT NULL,
	`supports_live_price` integer NOT NULL,
	`supports_stock` integer NOT NULL,
	`shipping_base_price` integer NOT NULL,
	`free_shipping_threshold` integer,
	`price_includes_vat` integer NOT NULL,
	`last_successful_sync` text,
	`status` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`display_name` text NOT NULL,
	`email` text DEFAULT '' NOT NULL,
	`created_at` text NOT NULL
);
