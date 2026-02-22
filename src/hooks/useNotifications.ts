import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

interface NotificationPrefs {
  enabled: boolean;
  remind_12h: boolean;
  remind_5min: boolean;
}

const TWELVE_HOURS_MS = 12 * 60 * 60 * 1000;
const FIVE_MIN_MS = 5 * 60 * 1000;
const CHECK_INTERVAL_MS = 60 * 1000; // check every minute

export function useNotifications() {
  const { user } = useAuth();
  const [prefs, setPrefs] = useState<NotificationPrefs>({ enabled: false, remind_12h: true, remind_5min: true });
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
      setPrefs({ enabled: data.enabled, remind_12h: data.remind_12h, remind_5min: data.remind_5min });
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

  const toggleEnabled = async () => {
    if (!user) return;
    const newEnabled = !prefs.enabled;

    if (newEnabled) {
      const granted = await requestPermission();
      if (!granted) return;
    }

    const { data: existing } = await supabase
      .from("notification_preferences")
      .select("id")
      .eq("user_id", user.id)
      .maybeSingle();

    if (existing) {
      await supabase
        .from("notification_preferences")
        .update({ enabled: newEnabled })
        .eq("user_id", existing.id);
    } else {
      await supabase.from("notification_preferences").insert({
        user_id: user.id,
        enabled: newEnabled,
      });
    }
    setPrefs((p) => ({ ...p, enabled: newEnabled }));
  };

  // Check upcoming events and fire notifications
  useEffect(() => {
    if (!prefs.enabled || !user || permissionState !== "granted") return;

    const checkUpcoming = async () => {
      const now = new Date();
      const in12h = new Date(now.getTime() + TWELVE_HOURS_MS + CHECK_INTERVAL_MS);

      const { data: events } = await supabase
        .from("calendar_events")
        .select("id, title, start_time")
        .eq("user_id", user.id)
        .gte("start_time", now.toISOString())
        .lte("start_time", in12h.toISOString());

      if (!events) return;

      for (const event of events) {
        const startTime = new Date(event.start_time).getTime();
        const diff = startTime - now.getTime();

        // 12h reminder (between 11h59m and 12h01m window)
        if (prefs.remind_12h && diff <= TWELVE_HOURS_MS && diff > TWELVE_HOURS_MS - CHECK_INTERVAL_MS) {
          const key = `12h-${event.id}`;
          if (!notifiedRef.current.has(key)) {
            notifiedRef.current.add(key);
            new Notification("⏰ Rappel - 12h avant", {
              body: `"${event.title}" commence dans 12 heures`,
              icon: "/favicon.ico",
              tag: key,
            });
          }
        }

        // 5min reminder (between 4m and 6m window)
        if (prefs.remind_5min && diff <= FIVE_MIN_MS && diff > FIVE_MIN_MS - CHECK_INTERVAL_MS) {
          const key = `5m-${event.id}`;
          if (!notifiedRef.current.has(key)) {
            notifiedRef.current.add(key);
            new Notification("🔔 Rappel - 5 minutes", {
              body: `"${event.title}" commence dans 5 minutes !`,
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
  }, [prefs.enabled, prefs.remind_12h, prefs.remind_5min, user, permissionState]);

  return { prefs, loading, toggleEnabled, permissionState, requestPermission };
}
