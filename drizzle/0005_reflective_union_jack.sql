DROP INDEX "bookmark_paper_id_unique";--> statement-breakpoint
DROP INDEX "poll_response_poll_id_unique";--> statement-breakpoint
DROP INDEX "vote_paper_id_unique";--> statement-breakpoint
ALTER TABLE `paper` ALTER COLUMN "is_user_upload" TO "is_user_upload" integer NOT NULL DEFAULT 0;--> statement-breakpoint
CREATE UNIQUE INDEX `bookmark_paper_id_unique` ON `bookmark` (`paper_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `poll_response_poll_id_unique` ON `poll_response` (`poll_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `vote_paper_id_unique` ON `vote` (`paper_id`);