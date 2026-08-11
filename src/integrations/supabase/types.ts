export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      budget_lines: {
        Row: {
          budget_id: string
          category: string
          created_at: string
          id: string
          is_total: boolean
          label: string
          monthly_values: Json
          sort_order: number
          subcategory: string
          updated_at: string
        }
        Insert: {
          budget_id: string
          category: string
          created_at?: string
          id?: string
          is_total?: boolean
          label: string
          monthly_values?: Json
          sort_order?: number
          subcategory?: string
          updated_at?: string
        }
        Update: {
          budget_id?: string
          category?: string
          created_at?: string
          id?: string
          is_total?: boolean
          label?: string
          monthly_values?: Json
          sort_order?: number
          subcategory?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "budget_lines_budget_id_fkey"
            columns: ["budget_id"]
            isOneToOne: false
            referencedRelation: "budgets"
            referencedColumns: ["id"]
          },
        ]
      }
      budgets: {
        Row: {
          created_at: string
          description: string
          horizon_months: number
          id: string
          project_id: string | null
          share_password: string | null
          share_token: string | null
          status: string
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          description?: string
          horizon_months?: number
          id?: string
          project_id?: string | null
          share_password?: string | null
          share_token?: string | null
          status?: string
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          description?: string
          horizon_months?: number
          id?: string
          project_id?: string | null
          share_password?: string | null
          share_token?: string | null
          status?: string
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "budgets_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      business_model_blocks: {
        Row: {
          block_type: string
          business_model_id: string
          content: string
          created_at: string
          generated: boolean
          id: string
          sort_order: number
          title: string
          updated_at: string
        }
        Insert: {
          block_type: string
          business_model_id: string
          content?: string
          created_at?: string
          generated?: boolean
          id?: string
          sort_order?: number
          title: string
          updated_at?: string
        }
        Update: {
          block_type?: string
          business_model_id?: string
          content?: string
          created_at?: string
          generated?: boolean
          id?: string
          sort_order?: number
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "business_model_blocks_business_model_id_fkey"
            columns: ["business_model_id"]
            isOneToOne: false
            referencedRelation: "business_models"
            referencedColumns: ["id"]
          },
        ]
      }
      business_models: {
        Row: {
          created_at: string
          description: string
          framework: string
          id: string
          project_id: string | null
          share_password: string | null
          share_token: string | null
          status: string
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          description?: string
          framework?: string
          id?: string
          project_id?: string | null
          share_password?: string | null
          share_token?: string | null
          status?: string
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          description?: string
          framework?: string
          id?: string
          project_id?: string | null
          share_password?: string | null
          share_token?: string | null
          status?: string
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "business_models_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      business_plan_charts: {
        Row: {
          chart_data: Json
          chart_type: string
          created_at: string
          id: string
          section_id: string
          sort_order: number
          title: string
        }
        Insert: {
          chart_data?: Json
          chart_type?: string
          created_at?: string
          id?: string
          section_id: string
          sort_order?: number
          title?: string
        }
        Update: {
          chart_data?: Json
          chart_type?: string
          created_at?: string
          id?: string
          section_id?: string
          sort_order?: number
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "business_plan_charts_section_id_fkey"
            columns: ["section_id"]
            isOneToOne: false
            referencedRelation: "business_plan_sections"
            referencedColumns: ["id"]
          },
        ]
      }
      business_plan_sections: {
        Row: {
          business_plan_id: string
          content: string
          created_at: string
          generated: boolean
          id: string
          section_type: string
          sort_order: number
          title: string
          updated_at: string
        }
        Insert: {
          business_plan_id: string
          content?: string
          created_at?: string
          generated?: boolean
          id?: string
          section_type: string
          sort_order?: number
          title: string
          updated_at?: string
        }
        Update: {
          business_plan_id?: string
          content?: string
          created_at?: string
          generated?: boolean
          id?: string
          section_type?: string
          sort_order?: number
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "business_plan_sections_business_plan_id_fkey"
            columns: ["business_plan_id"]
            isOneToOne: false
            referencedRelation: "business_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      business_plans: {
        Row: {
          created_at: string
          description: string
          id: string
          project_id: string | null
          share_password: string | null
          share_token: string | null
          status: string
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          description?: string
          id?: string
          project_id?: string | null
          share_password?: string | null
          share_token?: string | null
          status?: string
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          description?: string
          id?: string
          project_id?: string | null
          share_password?: string | null
          share_token?: string | null
          status?: string
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "business_plans_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      calendar_events: {
        Row: {
          all_day: boolean
          color: string | null
          created_at: string
          description: string | null
          end_time: string
          id: string
          project_id: string | null
          start_time: string
          task_id: string | null
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          all_day?: boolean
          color?: string | null
          created_at?: string
          description?: string | null
          end_time: string
          id?: string
          project_id?: string | null
          start_time: string
          task_id?: string | null
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          all_day?: boolean
          color?: string | null
          created_at?: string
          description?: string | null
          end_time?: string
          id?: string
          project_id?: string | null
          start_time?: string
          task_id?: string | null
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "calendar_events_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "calendar_events_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      calendar_integrations: {
        Row: {
          created_at: string
          enabled: boolean
          ics_feed_token: string
          id: string
          provider: string
          sync_direction: string
          timezone: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          enabled?: boolean
          ics_feed_token?: string
          id?: string
          provider: string
          sync_direction?: string
          timezone?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          enabled?: boolean
          ics_feed_token?: string
          id?: string
          provider?: string
          sync_direction?: string
          timezone?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      calendar_shares: {
        Row: {
          created_at: string
          id: string
          share_password: string | null
          share_token: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          share_password?: string | null
          share_token?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          share_password?: string | null
          share_token?: string
          user_id?: string
        }
        Relationships: []
      }
      copilot_conversations: {
        Row: {
          context_route: string | null
          created_at: string
          id: string
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          context_route?: string | null
          created_at?: string
          id?: string
          title?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          context_route?: string | null
          created_at?: string
          id?: string
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      copilot_messages: {
        Row: {
          content: string
          conversation_id: string
          created_at: string
          id: string
          role: string
          suggestions: Json | null
          user_id: string
        }
        Insert: {
          content: string
          conversation_id: string
          created_at?: string
          id?: string
          role: string
          suggestions?: Json | null
          user_id: string
        }
        Update: {
          content?: string
          conversation_id?: string
          created_at?: string
          id?: string
          role?: string
          suggestions?: Json | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "copilot_messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "copilot_conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      document_versions: {
        Row: {
          created_at: string
          document_id: string
          document_type: string
          id: string
          label: string
          snapshot: Json
          user_id: string
          version_number: number
        }
        Insert: {
          created_at?: string
          document_id: string
          document_type: string
          id?: string
          label?: string
          snapshot?: Json
          user_id: string
          version_number?: number
        }
        Update: {
          created_at?: string
          document_id?: string
          document_type?: string
          id?: string
          label?: string
          snapshot?: Json
          user_id?: string
          version_number?: number
        }
        Relationships: []
      }
      notification_preferences: {
        Row: {
          created_at: string
          enabled: boolean
          id: string
          remind_12h: boolean
          remind_5min: boolean
          reminder_1_minutes: number
          reminder_2_minutes: number
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          enabled?: boolean
          id?: string
          remind_12h?: boolean
          remind_5min?: boolean
          reminder_1_minutes?: number
          reminder_2_minutes?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          enabled?: boolean
          id?: string
          remind_12h?: boolean
          remind_5min?: boolean
          reminder_1_minutes?: number
          reminder_2_minutes?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      phases: {
        Row: {
          created_at: string
          id: string
          name: string
          project_id: string
          sort_order: number
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          project_id: string
          sort_order?: number
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          project_id?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "phases_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          email: string | null
          full_name: string | null
          id: string
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id: string
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      projects: {
        Row: {
          active_scenario: string
          assumption_scenarios: Json
          business_assumptions: Json
          completion_percent: number
          created_at: string
          days_per_week: string[]
          deadline: string | null
          description: string
          hours_per_week: number
          id: string
          project_type: string
          share_password: string | null
          share_token: string | null
          status: string
          time_slots: string | null
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          active_scenario?: string
          assumption_scenarios?: Json
          business_assumptions?: Json
          completion_percent?: number
          created_at?: string
          days_per_week?: string[]
          deadline?: string | null
          description: string
          hours_per_week?: number
          id?: string
          project_type?: string
          share_password?: string | null
          share_token?: string | null
          status?: string
          time_slots?: string | null
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          active_scenario?: string
          assumption_scenarios?: Json
          business_assumptions?: Json
          completion_percent?: number
          created_at?: string
          days_per_week?: string[]
          deadline?: string | null
          description?: string
          hours_per_week?: number
          id?: string
          project_type?: string
          share_password?: string | null
          share_token?: string | null
          status?: string
          time_slots?: string | null
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      recommendation_alternatives: {
        Row: {
          chosen: boolean
          cons: string[]
          created_at: string
          description: string
          duration: string | null
          estimated_cost: string | null
          feasibility: string
          id: string
          pros: string[]
          recommendation_id: string
          title: string
          type: string
        }
        Insert: {
          chosen?: boolean
          cons?: string[]
          created_at?: string
          description?: string
          duration?: string | null
          estimated_cost?: string | null
          feasibility?: string
          id?: string
          pros?: string[]
          recommendation_id: string
          title: string
          type: string
        }
        Update: {
          chosen?: boolean
          cons?: string[]
          created_at?: string
          description?: string
          duration?: string | null
          estimated_cost?: string | null
          feasibility?: string
          id?: string
          pros?: string[]
          recommendation_id?: string
          title?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "recommendation_alternatives_recommendation_id_fkey"
            columns: ["recommendation_id"]
            isOneToOne: false
            referencedRelation: "team_recommendations"
            referencedColumns: ["id"]
          },
        ]
      }
      sent_notifications: {
        Row: {
          event_id: string
          id: string
          reminder_type: string
          sent_at: string
          user_id: string
        }
        Insert: {
          event_id: string
          id?: string
          reminder_type: string
          sent_at?: string
          user_id: string
        }
        Update: {
          event_id?: string
          id?: string
          reminder_type?: string
          sent_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sent_notifications_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "calendar_events"
            referencedColumns: ["id"]
          },
        ]
      }
      subtasks: {
        Row: {
          created_at: string
          duration_hours: number
          id: string
          sort_order: number
          status: string
          task_id: string
          title: string
        }
        Insert: {
          created_at?: string
          duration_hours?: number
          id?: string
          sort_order?: number
          status?: string
          task_id: string
          title: string
        }
        Update: {
          created_at?: string
          duration_hours?: number
          id?: string
          sort_order?: number
          status?: string
          task_id?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "subtasks_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      task_explanations: {
        Row: {
          created_at: string
          explanation: string
          id: string
          subtask_id: string | null
          task_id: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          explanation: string
          id?: string
          subtask_id?: string | null
          task_id?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          explanation?: string
          id?: string
          subtask_id?: string | null
          task_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_explanations_subtask_id_fkey"
            columns: ["subtask_id"]
            isOneToOne: false
            referencedRelation: "subtasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_explanations_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      tasks: {
        Row: {
          created_at: string
          dependencies: string[] | null
          description: string | null
          duration_hours: number
          id: string
          notes: string | null
          optional: boolean
          phase_id: string
          priority: string
          sort_order: number
          status: string
          tags: string[] | null
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          dependencies?: string[] | null
          description?: string | null
          duration_hours?: number
          id?: string
          notes?: string | null
          optional?: boolean
          phase_id: string
          priority?: string
          sort_order?: number
          status?: string
          tags?: string[] | null
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          dependencies?: string[] | null
          description?: string | null
          duration_hours?: number
          id?: string
          notes?: string | null
          optional?: boolean
          phase_id?: string
          priority?: string
          sort_order?: number
          status?: string
          tags?: string[] | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tasks_phase_id_fkey"
            columns: ["phase_id"]
            isOneToOne: false
            referencedRelation: "phases"
            referencedColumns: ["id"]
          },
        ]
      }
      team_recommendations: {
        Row: {
          created_at: string
          description: string
          estimated_monthly_cost: string | null
          id: string
          importance: string
          project_id: string
          role: string
          skills: string[]
          sort_order: number
        }
        Insert: {
          created_at?: string
          description?: string
          estimated_monthly_cost?: string | null
          id?: string
          importance?: string
          project_id: string
          role: string
          skills?: string[]
          sort_order?: number
        }
        Update: {
          created_at?: string
          description?: string
          estimated_monthly_cost?: string | null
          id?: string
          importance?: string
          project_id?: string
          role?: string
          skills?: string[]
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "team_recommendations_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      verify_share_password: {
        Args: { hashed_password: string; plain_password: string }
        Returns: boolean
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
