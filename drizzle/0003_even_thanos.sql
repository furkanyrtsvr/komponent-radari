CREATE TABLE `cart_shipping_settings` (
	`id` text PRIMARY KEY NOT NULL,
	`cart_id` text NOT NULL,
	`store_id` text NOT NULL,
	`shipping_price` integer NOT NULL,
	`free_shipping_threshold` integer,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`cart_id`) REFERENCES `carts`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`store_id`) REFERENCES `stores`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `cart_shipping_unique` ON `cart_shipping_settings` (`cart_id`,`store_id`);