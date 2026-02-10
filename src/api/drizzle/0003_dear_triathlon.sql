CREATE TABLE "pending_bot_responses" (
	"id" serial PRIMARY KEY NOT NULL,
	"session_key" varchar(100) NOT NULL,
	"debate_id" integer NOT NULL,
	"bot_id" integer NOT NULL,
	"round_index" integer NOT NULL,
	"position" varchar(3) NOT NULL,
	"response" text,
	"status" varchar(20) DEFAULT 'pending' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"received_at" timestamp with time zone,
	CONSTRAINT "pending_bot_responses_session_key_unique" UNIQUE("session_key")
);
--> statement-breakpoint
ALTER TABLE "bots" ADD COLUMN "type" varchar(20) DEFAULT 'http' NOT NULL;--> statement-breakpoint
ALTER TABLE "pending_bot_responses" ADD CONSTRAINT "pending_bot_responses_debate_id_debates_id_fk" FOREIGN KEY ("debate_id") REFERENCES "public"."debates"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pending_bot_responses" ADD CONSTRAINT "pending_bot_responses_bot_id_bots_id_fk" FOREIGN KEY ("bot_id") REFERENCES "public"."bots"("id") ON DELETE cascade ON UPDATE no action;