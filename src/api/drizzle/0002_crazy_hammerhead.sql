ALTER TABLE "debate_messages" DROP CONSTRAINT "debate_messages_bot_id_bots_id_fk";
--> statement-breakpoint
ALTER TABLE "debates" DROP CONSTRAINT "debates_pro_bot_id_bots_id_fk";
--> statement-breakpoint
ALTER TABLE "debates" DROP CONSTRAINT "debates_con_bot_id_bots_id_fk";
--> statement-breakpoint
ALTER TABLE "debate_messages" ADD CONSTRAINT "debate_messages_bot_id_bots_id_fk" FOREIGN KEY ("bot_id") REFERENCES "public"."bots"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "debates" ADD CONSTRAINT "debates_pro_bot_id_bots_id_fk" FOREIGN KEY ("pro_bot_id") REFERENCES "public"."bots"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "debates" ADD CONSTRAINT "debates_con_bot_id_bots_id_fk" FOREIGN KEY ("con_bot_id") REFERENCES "public"."bots"("id") ON DELETE cascade ON UPDATE no action;