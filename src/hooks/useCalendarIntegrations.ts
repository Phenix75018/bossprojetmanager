import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export interface CalendarIntegration {
  id: string;
  provider: string;
  enabled: boolean;
  ics_feed_token: string;
  sync_direction: string;
  timezone: string;
}

export function useCalendarIntegrations() {
  const { user } = useAuth();
  const [integrations, setIntegrations] = useState<CalendarIntegration[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchIntegrations = async () => {
    if (!user) return;
    const { data } = await supabase
      .from("calendar_integrations")
      .select("*")
      .eq("user_id", user.id);
    setIntegrations((data as CalendarIntegration[]) || []);
    setLoading(false);
  };

  useEffect(() => {
    fetchIntegrations();
  }, [user]);

  const toggleIntegration = async (provider: string) => {
    if (!user) return;
    const existing = integrations.find((i) => i.provider === provider);

    if (existing) {
      await supabase
        .from("calendar_integrations")
        .update({ enabled: !existing.enabled })
        .eq("id", existing.id);
    } else {
      // Inherit any previously chosen timezone so a new provider matches the others
      const tz = integrations[0]?.timezone ?? "floating";
      await supabase.from("calendar_integrations").insert({
        user_id: user.id,
        provider,
        enabled: true,
        timezone: tz,
      } as never);
    }
    await fetchIntegrations();
  };

  const getICSUrl = (provider: string): string | null => {
    if (!user) return null;
    const integration = integrations.find(
      (i) => i.provider === provider && i.enabled
    );
    if (!integration) return null;
    const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
    return `https://${projectId}.supabase.co/functions/v1/calendar-ics?token=${integration.ics_feed_token}&user_id=${user.id}`;
  };

  const timezone: string = integrations[0]?.timezone ?? "floating";

  const updateTimezone = async (tz: string) => {
    if (!user) return;
    // Optimistic UI
    setIntegrations((prev) => prev.map((i) => ({ ...i, timezone: tz })));
    if (integrations.length > 0) {
      await supabase
        .from("calendar_integrations")
        .update({ timezone: tz } as never)
        .eq("user_id", user.id);
    } else {
      // Create a placeholder row so the setting is stored even before any provider is enabled
      await supabase.from("calendar_integrations").insert({
        user_id: user.id,
        provider: "_settings",
        enabled: false,
        timezone: tz,
      } as never);
      await fetchIntegrations();
    }
  };

  return {
    integrations,
    loading,
    toggleIntegration,
    getICSUrl,
    refetch: fetchIntegrations,
    timezone,
    updateTimezone,
  };
}
