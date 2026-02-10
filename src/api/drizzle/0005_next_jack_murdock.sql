ALTER TABLE "bots" ADD COLUMN "connection_token" varchar(64);--> statement-breakpoint
ALTER TABLE "bots" ADD CONSTRAINT "bots_connection_token_unique" UNIQUE("connection_token");