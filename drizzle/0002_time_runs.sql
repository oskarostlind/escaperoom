CREATE TABLE IF NOT EXISTS "time_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"team_name" text NOT NULL,
	"team_key" text NOT NULL,
	"participants" text,
	"target_sec" integer DEFAULT 60 NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"finished_at" timestamp with time zone,
	"elapsed_ms" integer,
	"diff_ms" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "time_runs_team_key_unique" UNIQUE("team_key")
);
