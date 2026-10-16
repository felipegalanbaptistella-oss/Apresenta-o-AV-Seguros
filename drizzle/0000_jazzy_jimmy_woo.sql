CREATE TABLE `risk_studies` (
	`id` text PRIMARY KEY NOT NULL,
	`client_first_name` text NOT NULL,
	`client_last_name` text NOT NULL,
	`spouse_name` text,
	`marital_regime` text,
	`family_mode` text NOT NULL,
	`consultant_key` text NOT NULL,
	`total_assets_cents` integer DEFAULT 0 NOT NULL,
	`coverage_gap_cents` integer DEFAULT 0 NOT NULL,
	`payload_json` text NOT NULL,
	`revision` integer DEFAULT 1 NOT NULL,
	`created_by` text NOT NULL,
	`updated_by` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_risk_studies_client_name` ON `risk_studies` (`client_last_name`,`client_first_name`);--> statement-breakpoint
CREATE INDEX `idx_risk_studies_updated_at` ON `risk_studies` (`updated_at`);--> statement-breakpoint
CREATE INDEX `idx_risk_studies_consultant` ON `risk_studies` (`consultant_key`);--> statement-breakpoint
CREATE TABLE `risk_study_revisions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`study_id` text NOT NULL,
	`revision` integer NOT NULL,
	`payload_json` text NOT NULL,
	`changed_by` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`study_id`) REFERENCES `risk_studies`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uidx_risk_study_revisions_study_revision` ON `risk_study_revisions` (`study_id`,`revision`);--> statement-breakpoint
CREATE INDEX `idx_risk_study_revisions_study` ON `risk_study_revisions` (`study_id`);--> statement-breakpoint
PRAGMA optimize;
