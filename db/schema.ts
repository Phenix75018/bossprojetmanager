import { sql } from "drizzle-orm";
import {
  pgTable,
  uuid,
  text,
  integer,
  numeric,
  boolean,
  date,
  timestamp,
  jsonb,
  unique,
  index,
  check,
} from "drizzle-orm/pg-core";

// Reproduces the schema previously hosted on Supabase (see supabase/migrations).
// Row Level Security policies and Postgres functions/triggers tied to Supabase's
// `auth.uid()` are Supabase-Auth-specific and are not reproduced here — see
// .netlify/results.md for details.

export const projects = pgTable(
  "projects",
  {
    id: uuid().primaryKey().defaultRandom(),
    userId: uuid("user_id").notNull(),
    title: text().notNull(),
    description: text().notNull(),
    status: text().notNull().default("planning"),
    hoursPerWeek: integer("hours_per_week").notNull().default(20),
    daysPerWeek: text("days_per_week")
      .array()
      .notNull()
      .default(sql`'{"Lundi","Mardi","Mercredi","Jeudi","Vendredi"}'`),
    timeSlots: text("time_slots").default("9h-12h, 14h-18h"),
    deadline: date(),
    completionPercent: integer("completion_percent").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    projectType: text("project_type").notNull().default("personal"),
    shareToken: text("share_token").unique(),
    sharePassword: text("share_password"),
    businessAssumptions: jsonb("business_assumptions").notNull().default({}),
    assumptionScenarios: jsonb("assumption_scenarios").notNull().default({}),
    activeScenario: text("active_scenario").notNull().default("base"),
  },
  (table) => [
    index("idx_projects_share_token")
      .on(table.shareToken)
      .where(sql`${table.shareToken} IS NOT NULL`),
  ],
);

export const phases = pgTable("phases", {
  id: uuid().primaryKey().defaultRandom(),
  projectId: uuid("project_id")
    .notNull()
    .references(() => projects.id, { onDelete: "cascade" }),
  name: text().notNull(),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const tasks = pgTable("tasks", {
  id: uuid().primaryKey().defaultRandom(),
  phaseId: uuid("phase_id")
    .notNull()
    .references(() => phases.id, { onDelete: "cascade" }),
  title: text().notNull(),
  description: text(),
  priority: text().notNull().default("P1"),
  status: text().notNull().default("todo"),
  durationHours: numeric("duration_hours").notNull().default("4"),
  dependencies: uuid().array().default([]),
  tags: text().array().default([]),
  notes: text(),
  optional: boolean().notNull().default(false),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const subtasks = pgTable("subtasks", {
  id: uuid().primaryKey().defaultRandom(),
  taskId: uuid("task_id")
    .notNull()
    .references(() => tasks.id, { onDelete: "cascade" }),
  title: text().notNull(),
  status: text().notNull().default("todo"),
  durationHours: numeric("duration_hours").notNull().default("1"),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const calendarEvents = pgTable("calendar_events", {
  id: uuid().primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull(),
  projectId: uuid("project_id").references(() => projects.id, { onDelete: "cascade" }),
  taskId: uuid("task_id").references(() => tasks.id, { onDelete: "cascade" }),
  title: text().notNull(),
  description: text(),
  startTime: timestamp("start_time", { withTimezone: true }).notNull(),
  endTime: timestamp("end_time", { withTimezone: true }).notNull(),
  allDay: boolean("all_day").notNull().default(false),
  color: text(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const calendarIntegrations = pgTable(
  "calendar_integrations",
  {
    id: uuid().primaryKey().defaultRandom(),
    userId: uuid("user_id").notNull(),
    provider: text().notNull(),
    enabled: boolean().notNull().default(false),
    icsFeedToken: text("ics_feed_token")
      .notNull()
      .default(sql`gen_random_uuid()::text`),
    syncDirection: text("sync_direction").notNull().default("export"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    timezone: text().notNull().default("floating"),
  },
  (table) => [unique().on(table.userId, table.provider)],
);

export const notificationPreferences = pgTable("notification_preferences", {
  id: uuid().primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().unique(),
  enabled: boolean().notNull().default(false),
  remind12h: boolean("remind_12h").notNull().default(true),
  remind5min: boolean("remind_5min").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  reminder1Minutes: integer("reminder_1_minutes").notNull().default(720),
  reminder2Minutes: integer("reminder_2_minutes").notNull().default(5),
});

export const sentNotifications = pgTable(
  "sent_notifications",
  {
    id: uuid().primaryKey().defaultRandom(),
    userId: uuid("user_id").notNull(),
    eventId: uuid("event_id")
      .notNull()
      .references(() => calendarEvents.id, { onDelete: "cascade" }),
    reminderType: text("reminder_type").notNull(),
    sentAt: timestamp("sent_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [unique().on(table.userId, table.eventId, table.reminderType)],
);

export const teamRecommendations = pgTable("team_recommendations", {
  id: uuid().primaryKey().defaultRandom(),
  projectId: uuid("project_id")
    .notNull()
    .references(() => projects.id, { onDelete: "cascade" }),
  role: text().notNull(),
  description: text().notNull().default(""),
  importance: text().notNull().default("recommandé"),
  skills: text().array().notNull().default([]),
  estimatedMonthlyCost: text("estimated_monthly_cost"),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const recommendationAlternatives = pgTable("recommendation_alternatives", {
  id: uuid().primaryKey().defaultRandom(),
  recommendationId: uuid("recommendation_id")
    .notNull()
    .references(() => teamRecommendations.id, { onDelete: "cascade" }),
  type: text().notNull(),
  title: text().notNull(),
  description: text().notNull().default(""),
  duration: text(),
  estimatedCost: text("estimated_cost"),
  pros: text().array().notNull().default([]),
  cons: text().array().notNull().default([]),
  feasibility: text().notNull().default("moyenne"),
  chosen: boolean().notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const taskExplanations = pgTable(
  "task_explanations",
  {
    id: uuid().primaryKey().defaultRandom(),
    taskId: uuid("task_id").references(() => tasks.id, { onDelete: "cascade" }),
    subtaskId: uuid("subtask_id").references(() => subtasks.id, { onDelete: "cascade" }),
    explanation: text().notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    userId: uuid("user_id").notNull(),
  },
  (table) => [
    index("idx_task_explanations_task_id").on(table.taskId),
    index("idx_task_explanations_subtask_id").on(table.subtaskId),
    check(
      "task_or_subtask",
      sql`(${table.taskId} IS NOT NULL AND ${table.subtaskId} IS NULL) OR (${table.taskId} IS NULL AND ${table.subtaskId} IS NOT NULL)`,
    ),
  ],
);

export const calendarShares = pgTable("calendar_shares", {
  id: uuid().primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().unique(),
  shareToken: text("share_token")
    .notNull()
    .unique()
    .default(sql`gen_random_uuid()::text`),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  sharePassword: text("share_password"),
});

export const businessPlans = pgTable("business_plans", {
  id: uuid().primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull(),
  projectId: uuid("project_id").references(() => projects.id, { onDelete: "set null" }),
  title: text().notNull(),
  description: text().notNull().default(""),
  status: text().notNull().default("draft"),
  shareToken: text("share_token"),
  sharePassword: text("share_password"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const businessPlanSections = pgTable("business_plan_sections", {
  id: uuid().primaryKey().defaultRandom(),
  businessPlanId: uuid("business_plan_id")
    .notNull()
    .references(() => businessPlans.id, { onDelete: "cascade" }),
  sectionType: text("section_type").notNull(),
  title: text().notNull(),
  content: text().notNull().default(""),
  sortOrder: integer("sort_order").notNull().default(0),
  generated: boolean().notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const businessPlanCharts = pgTable("business_plan_charts", {
  id: uuid().primaryKey().defaultRandom(),
  sectionId: uuid("section_id")
    .notNull()
    .references(() => businessPlanSections.id, { onDelete: "cascade" }),
  chartType: text("chart_type").notNull().default("bar"),
  title: text().notNull().default(""),
  chartData: jsonb("chart_data").notNull().default([]),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const businessModels = pgTable("business_models", {
  id: uuid().primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull(),
  projectId: uuid("project_id").references(() => projects.id, { onDelete: "set null" }),
  title: text().notNull(),
  description: text().notNull().default(""),
  framework: text().notNull().default("bmc"),
  status: text().notNull().default("draft"),
  shareToken: text("share_token"),
  sharePassword: text("share_password"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const businessModelBlocks = pgTable("business_model_blocks", {
  id: uuid().primaryKey().defaultRandom(),
  businessModelId: uuid("business_model_id")
    .notNull()
    .references(() => businessModels.id, { onDelete: "cascade" }),
  blockType: text("block_type").notNull(),
  title: text().notNull(),
  content: text().notNull().default(""),
  sortOrder: integer("sort_order").notNull().default(0),
  generated: boolean().notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const budgets = pgTable("budgets", {
  id: uuid().primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull(),
  projectId: uuid("project_id").references(() => projects.id, { onDelete: "set null" }),
  title: text().notNull(),
  description: text().notNull().default(""),
  status: text().notNull().default("draft"),
  horizonMonths: integer("horizon_months").notNull().default(12),
  shareToken: text("share_token"),
  sharePassword: text("share_password"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const budgetLines = pgTable("budget_lines", {
  id: uuid().primaryKey().defaultRandom(),
  budgetId: uuid("budget_id")
    .notNull()
    .references(() => budgets.id, { onDelete: "cascade" }),
  category: text().notNull(),
  subcategory: text().notNull().default(""),
  label: text().notNull(),
  monthlyValues: jsonb("monthly_values").notNull().default([]),
  isTotal: boolean("is_total").notNull().default(false),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const documentVersions = pgTable(
  "document_versions",
  {
    id: uuid().primaryKey().defaultRandom(),
    userId: uuid("user_id").notNull(),
    documentType: text("document_type").notNull(),
    documentId: uuid("document_id").notNull(),
    versionNumber: integer("version_number").notNull().default(1),
    label: text().notNull().default(""),
    snapshot: jsonb().notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("idx_document_versions_lookup").on(
      table.documentType,
      table.documentId,
      table.versionNumber.desc(),
    ),
  ],
);

export const copilotConversations = pgTable(
  "copilot_conversations",
  {
    id: uuid().primaryKey().defaultRandom(),
    userId: uuid("user_id").notNull(),
    title: text().notNull().default("Nouvelle conversation"),
    contextRoute: text("context_route"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("idx_copilot_conv_user").on(table.userId, table.updatedAt.desc()),
  ],
);

export const copilotMessages = pgTable(
  "copilot_messages",
  {
    id: uuid().primaryKey().defaultRandom(),
    conversationId: uuid("conversation_id")
      .notNull()
      .references(() => copilotConversations.id, { onDelete: "cascade" }),
    userId: uuid("user_id").notNull(),
    role: text().notNull(),
    content: text().notNull(),
    suggestions: jsonb().default([]),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("idx_copilot_msg_conv").on(table.conversationId, table.createdAt),
    check("copilot_messages_role_check", sql`${table.role} IN ('user', 'assistant', 'system')`),
  ],
);
