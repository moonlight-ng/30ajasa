CREATE TABLE `bookings` (
	`id` text PRIMARY KEY NOT NULL,
	`class_slug` text NOT NULL,
	`session_date` text NOT NULL,
	`session_period` text NOT NULL,
	`customer_name` text NOT NULL,
	`customer_email` text NOT NULL,
	`status` text DEFAULT 'reserved' NOT NULL,
	`created_at` text DEFAULT (datetime('now')) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_bookings_session_status` ON `bookings` (`session_date`,`session_period`,`status`);
--> statement-breakpoint
PRAGMA optimize;
