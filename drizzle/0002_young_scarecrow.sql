CREATE TABLE `bookmark` (
	`id` text PRIMARY KEY NOT NULL,
	`paper_id` text NOT NULL,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`paper_id`) REFERENCES `paper`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `bookmark_paper_id_unique` ON `bookmark` (`paper_id`);--> statement-breakpoint
CREATE TABLE `user_post` (
	`id` text PRIMARY KEY NOT NULL,
	`scroll_id` text NOT NULL,
	`title` text,
	`content` text NOT NULL,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`scroll_id`) REFERENCES `scroll`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
ALTER TABLE `comment` ADD `parent_id` text;--> statement-breakpoint
ALTER TABLE `poll` ADD `category` text DEFAULT 'poll' NOT NULL;