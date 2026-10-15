CREATE TABLE `cart_offer_selections` (
	`id` text PRIMARY KEY NOT NULL,
	`cart_id` text NOT NULL,
	`canonical_product_id` text NOT NULL,
	`offer_id` text NOT NULL,
	`excluded` integer DEFAULT 0 NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`cart_id`) REFERENCES `carts`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`canonical_product_id`) REFERENCES `canonical_products`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`offer_id`) REFERENCES `store_offers`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `cart_offer_selection_unique` ON `cart_offer_selections` (`cart_id`,`canonical_product_id`,`offer_id`);