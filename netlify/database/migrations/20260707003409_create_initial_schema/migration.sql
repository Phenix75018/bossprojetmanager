CREATE TABLE "budget_lines" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"budget_id" uuid NOT NULL,
	"category" text NOT NULL,
	"subcategory" text DEFAULT '' NOT NULL,
	"label" text NOT NULL,
	"monthly_values" jsonb DEFAULT '[]' NOT NULL,
	"is_total" boolean DEFAULT false NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "budgets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"user_id" uuid NOT NULL,
	"project_id" uuid,
	"title" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"horizon_months" integer DEFAULT 12 NOT NULL,
	"share_token" text,
	"share_password" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "business_model_blocks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"business_model_id" uuid NOT NULL,
	"block_type" text NOT NULL,
	"title" text NOT NULL,
	"content" text DEFAULT '' NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"generated" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "business_models" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"user_id" uuid NOT NULL,
	"project_id" uuid,
	"title" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"framework" text DEFAULT 'bmc' NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"share_token" text,
	"share_password" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "business_plan_charts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"section_id" uuid NOT NULL,
	"chart_type" text DEFAULT 'bar' NOT NULL,
	"title" text DEFAULT '' NOT NULL,
	"chart_data" jsonb DEFAULT '[]' NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "business_plan_sections" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"business_plan_id" uuid NOT NULL,
	"section_type" text NOT NULL,
	"title" text NOT NULL,
	"content" text DEFAULT '' NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"generated" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "business_plans" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"user_id" uuid NOT NULL,
	"project_id" uuid,
	"title" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"share_token" text,
	"share_password" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "calendar_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"user_id" uuid NOT NULL,
	"project_id" uuid,
	"task_id" uuid,
	"title" text NOT NULL,
	"description" text,
	"start_time" timestamp with time zone NOT NULL,
	"end_time" timestamp with time zone NOT NULL,
	"all_day" boolean DEFAULT false NOT NULL,
	"color" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "calendar_integrations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"user_id" uuid NOT NULL,
	"provider" text NOT NULL,
	"enabled" boolean DEFAULT false NOT NULL,
	"ics_feed_token" text DEFAULT gen_random_uuid() NOT NULL,
	"sync_direction" text DEFAULT 'export' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"timezone" text DEFAULT 'floating' NOT NULL,
	CONSTRAINT "calendar_integrations_user_id_provider_unique" UNIQUE("user_id","provider")
);
--> statement-breakpoint
CREATE TABLE "calendar_shares" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"user_id" uuid NOT NULL UNIQUE,
	"share_token" text DEFAULT gen_random_uuid() NOT NULL UNIQUE,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"share_password" text
);
--> statement-breakpoint
CREATE TABLE "copilot_conversations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"user_id" uuid NOT NULL,
	"title" text DEFAULT 'Nouvelle conversation' NOT NULL,
	"context_route" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "copilot_messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"conversation_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"role" text NOT NULL,
	"content" text NOT NULL,
	"suggestions" jsonb DEFAULT '[]',
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "copilot_messages_role_check" CHECK ("role" IN ('user', 'assistant', 'system'))
);
--> statement-breakpoint
CREATE TABLE "document_versions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"user_id" uuid NOT NULL,
	"document_type" text NOT NULL,
	"document_id" uuid NOT NULL,
	"version_number" integer DEFAULT 1 NOT NULL,
	"label" text DEFAULT '' NOT NULL,
	"snapshot" jsonb DEFAULT '{}' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notification_preferences" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"user_id" uuid NOT NULL UNIQUE,
	"enabled" boolean DEFAULT false NOT NULL,
	"remind_12h" boolean DEFAULT true NOT NULL,
	"remind_5min" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"reminder_1_minutes" integer DEFAULT 720 NOT NULL,
	"reminder_2_minutes" integer DEFAULT 5 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "phases" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"project_id" uuid NOT NULL,
	"name" text NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "projects" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"user_id" uuid NOT NULL,
	"title" text NOT NULL,
	"description" text NOT NULL,
	"status" text DEFAULT 'planning' NOT NULL,
	"hours_per_week" integer DEFAULT 20 NOT NULL,
	"days_per_week" text[] DEFAULT '{"Lundi","Mardi","Mercredi","Jeudi","Vendredi"}'::text[] NOT NULL,
	"time_slots" text DEFAULT '9h-12h, 14h-18h',
	"deadline" date,
	"completion_percent" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"project_type" text DEFAULT 'personal' NOT NULL,
	"share_token" text UNIQUE,
	"share_password" text,
	"business_assumptions" jsonb DEFAULT '{}' NOT NULL,
	"assumption_scenarios" jsonb DEFAULT '{}' NOT NULL,
	"active_scenario" text DEFAULT 'base' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "recommendation_alternatives" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"recommendation_id" uuid NOT NULL,
	"type" text NOT NULL,
	"title" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"duration" text,
	"estimated_cost" text,
	"pros" text[] DEFAULT '{}'::text[] NOT NULL,
	"cons" text[] DEFAULT '{}'::text[] NOT NULL,
	"feasibility" text DEFAULT 'moyenne' NOT NULL,
	"chosen" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sent_notifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"user_id" uuid NOT NULL,
	"event_id" uuid NOT NULL,
	"reminder_type" text NOT NULL,
	"sent_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "sent_notifications_user_id_event_id_reminder_type_unique" UNIQUE("user_id","event_id","reminder_type")
);
--> statement-breakpoint
CREATE TABLE "subtasks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"task_id" uuid NOT NULL,
	"title" text NOT NULL,
	"status" text DEFAULT 'todo' NOT NULL,
	"duration_hours" numeric DEFAULT '1' NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "task_explanations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"task_id" uuid,
	"subtask_id" uuid,
	"explanation" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"user_id" uuid NOT NULL,
	CONSTRAINT "task_or_subtask" CHECK (("task_id" IS NOT NULL AND "subtask_id" IS NULL) OR ("task_id" IS NULL AND "subtask_id" IS NOT NULL))
);
--> statement-breakpoint
CREATE TABLE "tasks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"phase_id" uuid NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"priority" text DEFAULT 'P1' NOT NULL,
	"status" text DEFAULT 'todo' NOT NULL,
	"duration_hours" numeric DEFAULT '4' NOT NULL,
	"dependencies" uuid[] DEFAULT '{}'::uuid[],
	"tags" text[] DEFAULT '{}'::text[],
	"notes" text,
	"optional" boolean DEFAULT false NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "team_recommendations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"project_id" uuid NOT NULL,
	"role" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"importance" text DEFAULT 'recommandé' NOT NULL,
	"skills" text[] DEFAULT '{}'::text[] NOT NULL,
	"estimated_monthly_cost" text,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "idx_copilot_conv_user" ON "copilot_conversations" ("user_id","updated_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "idx_copilot_msg_conv" ON "copilot_messages" ("conversation_id","created_at");--> statement-breakpoint
CREATE INDEX "idx_document_versions_lookup" ON "document_versions" ("document_type","document_id","version_number" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "idx_projects_share_token" ON "projects" ("share_token") WHERE "share_token" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "idx_task_explanations_task_id" ON "task_explanations" ("task_id");--> statement-breakpoint
CREATE INDEX "idx_task_explanations_subtask_id" ON "task_explanations" ("subtask_id");--> statement-breakpoint
ALTER TABLE "budget_lines" ADD CONSTRAINT "budget_lines_budget_id_budgets_id_fkey" FOREIGN KEY ("budget_id") REFERENCES "budgets"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "budgets" ADD CONSTRAINT "budgets_project_id_projects_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "business_model_blocks" ADD CONSTRAINT "business_model_blocks_business_model_id_business_models_id_fkey" FOREIGN KEY ("business_model_id") REFERENCES "business_models"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "business_models" ADD CONSTRAINT "business_models_project_id_projects_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "business_plan_charts" ADD CONSTRAINT "business_plan_charts_section_id_business_plan_sections_id_fkey" FOREIGN KEY ("section_id") REFERENCES "business_plan_sections"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "business_plan_sections" ADD CONSTRAINT "business_plan_sections_business_plan_id_business_plans_id_fkey" FOREIGN KEY ("business_plan_id") REFERENCES "business_plans"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "business_plans" ADD CONSTRAINT "business_plans_project_id_projects_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "calendar_events" ADD CONSTRAINT "calendar_events_project_id_projects_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "calendar_events" ADD CONSTRAINT "calendar_events_task_id_tasks_id_fkey" FOREIGN KEY ("task_id") REFERENCES "tasks"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "copilot_messages" ADD CONSTRAINT "copilot_messages_conversation_id_copilot_conversations_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "copilot_conversations"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "phases" ADD CONSTRAINT "phases_project_id_projects_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "recommendation_alternatives" ADD CONSTRAINT "recommendation_alternatives_lgsYOcn3g4dn_fkey" FOREIGN KEY ("recommendation_id") REFERENCES "team_recommendations"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "sent_notifications" ADD CONSTRAINT "sent_notifications_event_id_calendar_events_id_fkey" FOREIGN KEY ("event_id") REFERENCES "calendar_events"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "subtasks" ADD CONSTRAINT "subtasks_task_id_tasks_id_fkey" FOREIGN KEY ("task_id") REFERENCES "tasks"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "task_explanations" ADD CONSTRAINT "task_explanations_task_id_tasks_id_fkey" FOREIGN KEY ("task_id") REFERENCES "tasks"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "task_explanations" ADD CONSTRAINT "task_explanations_subtask_id_subtasks_id_fkey" FOREIGN KEY ("subtask_id") REFERENCES "subtasks"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_phase_id_phases_id_fkey" FOREIGN KEY ("phase_id") REFERENCES "phases"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "team_recommendations" ADD CONSTRAINT "team_recommendations_project_id_projects_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE;