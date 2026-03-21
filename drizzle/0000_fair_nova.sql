CREATE TABLE `comment` (
	`id` text PRIMARY KEY NOT NULL,
	`paper_id` text NOT NULL,
	`content` text NOT NULL,
	`author` text DEFAULT 'You' NOT NULL,
	`is_generated` integer DEFAULT false NOT NULL,
	`relationship` text,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`paper_id`) REFERENCES `paper`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `paper` (
	`id` text PRIMARY KEY NOT NULL,
	`scroll_id` text NOT NULL,
	`external_id` text,
	`title` text NOT NULL,
	`authors` text NOT NULL,
	`journal` text NOT NULL,
	`year` integer NOT NULL,
	`doi` text NOT NULL,
	`peer_reviewed` integer NOT NULL,
	`synthesis` text NOT NULL,
	`credibility_score` integer NOT NULL,
	`citation_count` integer NOT NULL,
	`comment_count` integer DEFAULT 0 NOT NULL,
	`apa_citation` text NOT NULL,
	FOREIGN KEY (`scroll_id`) REFERENCES `scroll`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `poll_response` (
	`id` text PRIMARY KEY NOT NULL,
	`poll_id` text NOT NULL,
	`answer` text NOT NULL,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`poll_id`) REFERENCES `poll`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `poll_response_poll_id_unique` ON `poll_response` (`poll_id`);--> statement-breakpoint
CREATE TABLE `poll` (
	`id` text PRIMARY KEY NOT NULL,
	`scroll_id` text NOT NULL,
	`type` text NOT NULL,
	`question` text NOT NULL,
	`options` text,
	FOREIGN KEY (`scroll_id`) REFERENCES `scroll`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `scroll` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`description` text NOT NULL,
	`mode` text NOT NULL,
	`date` text NOT NULL,
	`paper_count` integer NOT NULL,
	`export_data` text,
	`created_at` text DEFAULT (datetime('now')) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `user` (
	`id` text PRIMARY KEY NOT NULL
);
--> statement-breakpoint
CREATE TABLE `vote` (
	`id` text PRIMARY KEY NOT NULL,
	`paper_id` text NOT NULL,
	`value` integer DEFAULT 1 NOT NULL,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`paper_id`) REFERENCES `paper`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `vote_paper_id_unique` ON `vote` (`paper_id`);