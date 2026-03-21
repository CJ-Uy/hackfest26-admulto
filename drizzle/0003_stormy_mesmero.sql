ALTER TABLE `comment` ADD `user_post_id` text REFERENCES user_post(id);--> statement-breakpoint
ALTER TABLE `user_post` ADD `comment_count` integer DEFAULT 0 NOT NULL;