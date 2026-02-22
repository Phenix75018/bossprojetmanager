import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export interface NotificationPrefs {
  enabled: boolean;
  remind_12h: boolean;
  remind_5min: boolean;
  reminder_1_minutes: number;
  reminder_2_minutes: number;
}

const CHECK_INTERVAL_MS = 60 * 1000;

export const REMINDER_OPTIONS = [
  { value: 5, label: "5 minutes" },
  { value: 10, label: "10 minutes" },
  { value: 15, label: "15 minutes" },
  { value: 30, label: "30 minutes" },
  { value: 60, label: "1 heure" },
  { value: 120, label: "2 heures" },
  { value: 360, label: "6 heures" },
  { value: 720, label: "12 heures" },
  { value: 1440, label: "24 heures" },
];

export function useNotifications() {
  const { user } = useAuth();
  const [prefs, setPrefs] = useState<NotificationPrefs>({
    enabled: false, remind_12h: true, remind_5min: true,
    reminder_1_minutes: 720, reminder_2_minutes: 5,
  });
  const [loading, setLoading] = useState(true);
  const [permissionState, setPermissionState] = useState<NotificationPermission>("default");
  const notifiedRef = useRef<Set<string>>(new Set());

  const fetchPrefs = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from("notification_preferences")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle();
    if (data) {
      setPrefs({
        enabled: data.enabled,
        remind_12h: data.remind_12h,
        remind_5min: data.remind_5min,
        reminder_1_minutes: (data as any).reminder_1_minutes ?? 720,
        reminder_2_minutes: (data as any).reminder_2_minutes ?? 5,
      });
    }
    setLoading(false);
  }, [user]);

  useEffect(() => {
    fetchPrefs();
    if ("Notification" in window) {
      setPermissionState(Notification.permission);
    }
  }, [fetchPrefs]);

  const requestPermission = async (): Promise<boolean> => {
    if (!("Notification" in window)) return false;
    const result = await Notification.requestPermission();
    setPermissionState(result);
    return result === "granted";
  };

  const upsertPrefs = async (updates: Partial<NotificationPrefs>) => {
    if (!user) return;
    const newPrefs = { ...prefs, ...updates };

    const { data: existing } = await supabase
      .from("notification_preferences")
      .select("id")
      .eq("user_id", user.id)
      .maybeSingle();

    const dbUpdates: any = {};
    if ("enabled" in updates) dbUpdates.enabled = updates.enabled;
    if ("reminder_1_minutes" in updates) dbUpdates.reminder_1_minutes = updates.reminder_1_minutes;
    if ("reminder_2_minutes" in updates) dbUpdates.reminder_2_minutes = updates.reminder_2_minutes;

    if (existing) {
      await supabase.from("notification_preferences").update(dbUpdates).eq("id", existing.id);
    } else {
      await supabase.from("notification_preferences").insert({ user_id: user.id, ...dbUpdates, enabled: newPrefs.enabled });
    }
    setPrefs(newPrefs);
  };

  const toggleEnabled = async () => {
    if (!prefs.enabled) {
      const granted = await requestPermission();
      if (!granted) return;
    }
    await upsertPrefs({ enabled: !prefs.enabled });
  };

  const updateReminder1 = async (minutes: number) => {
    await upsertPrefs({ reminder_1_minutes: minutes });
  };

  const updateReminder2 = async (minutes: number) => {
    await upsertPrefs({ reminder_2_minutes: minutes });
  };

  // Check upcoming events and fire browser notifications
  useEffect(() => {
    if (!prefs.enabled || !user || permissionState !== "granted") return;

    const checkUpcoming = async () => {
      const now = new Date();
      const maxMs = Math.max(prefs.reminder_1_minutes, prefs.reminder_2_minutes) * 60 * 1000 + CHECK_INTERVAL_MS;
      const horizon = new Date(now.getTime() + maxMs);

      const { data: events } = await supabase
        .from("calendar_events")
        .select("id, title, start_time")
        .eq("user_id", user.id)
        .gte("start_time", now.toISOString())
        .lte("start_time", horizon.toISOString());

      if (!events) return;

      for (const event of events) {
        const startTime = new Date(event.start_time).getTime();
        const diff = startTime - now.getTime();

        // Reminder 1
        const r1Ms = prefs.reminder_1_minutes * 60 * 1000;
        if (diff <= r1Ms && diff > r1Ms - CHECK_INTERVAL_MS) {
          const key = `r1-${event.id}`;
          if (!notifiedRef.current.has(key)) {
            notifiedRef.current.add(key);
            const label = REMINDER_OPTIONS.find(o => o.value === prefs.reminder_1_minutes)?.label || `${prefs.reminder_1_minutes}min`;
            new Notification(`⏰ Rappel - ${label} avant`, {
              body: `"${event.title}" commence dans ${label}`,
              icon: "/favicon.ico",
              tag: key,
            });
          }
        }

        // Reminder 2
        const r2Ms = prefs.reminder_2_minutes * 60 * 1000;
        if (diff <= r2Ms && diff > r2Ms - CHECK_INTERVAL_MS) {
          const key = `r2-${event.id}`;
          if (!notifiedRef.current.has(key)) {
            notifiedRef.current.add(key);
            const label = REMINDER_OPTIONS.find(o => o.value === prefs.reminder_2_minutes)?.label || `${prefs.reminder_2_minutes}min`;
            new Notification(`🔔 Rappel - ${label}`, {
              body: `"${event.title}" commence dans ${label} !`,
              icon: "/favicon.ico",
              tag: key,
            });
          }
        }
      }
    };

    checkUpcoming();
    const interval = setInterval(checkUpcoming, CHECK_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [prefs, user, permissionState]);

  return { prefs, loading, toggleEnabled, updateReminder1, updateReminder2, permissionState };
}
