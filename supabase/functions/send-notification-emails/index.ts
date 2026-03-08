import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // Validate the request comes from an authorized source (cron job via apikey)
  const apikey = req.headers.get("apikey") || req.headers.get("x-api-key");
  const authHeader = req.headers.get("Authorization");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  
  const isAuthorized = 
    (apikey && apikey === anonKey) || 
    (authHeader && authHeader === `Bearer ${anonKey}`);
  
  if (!isAuthorized) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
    if (!RESEND_API_KEY) throw new Error("RESEND_API_KEY not configured");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const now = new Date();

    // Fetch users with notifications enabled + their custom delays
    const { data: enabledUsers } = await supabase
      .from("notification_preferences")
      .select("user_id, reminder_1_minutes, reminder_2_minutes")
      .eq("enabled", true);

    if (!enabledUsers || enabledUsers.length === 0) {
      return new Response(JSON.stringify({ sent: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let totalSent = 0;

    for (const userPref of enabledUsers) {
      const userId = userPref.user_id;
      const r1Min = userPref.reminder_1_minutes ?? 720;
      const r2Min = userPref.reminder_2_minutes ?? 5;

      // Get user email
      const { data: userData } = await supabase.auth.admin.getUserById(userId);
      if (!userData?.user?.email) continue;
      const userEmail = userData.user.email;

      // Check events for reminder 1
      const r1Start = new Date(now.getTime() + (r1Min - 1) * 60 * 1000);
      const r1End = new Date(now.getTime() + (r1Min + 1) * 60 * 1000);

      const { data: eventsR1 } = await supabase
        .from("calendar_events")
        .select("id, title, start_time, description")
        .eq("user_id", userId)
        .gte("start_time", r1Start.toISOString())
        .lte("start_time", r1End.toISOString());

      // Check events for reminder 2
      const r2Start = new Date(now.getTime() + (r2Min - 1) * 60 * 1000);
      const r2End = new Date(now.getTime() + (r2Min + 1) * 60 * 1000);

      const { data: eventsR2 } = await supabase
        .from("calendar_events")
        .select("id, title, start_time, description")
        .eq("user_id", userId)
        .gte("start_time", r2Start.toISOString())
        .lte("start_time", r2End.toISOString());

      const r1Label = formatDelay(r1Min);
      const r2Label = formatDelay(r2Min);

      // Send reminder 1
      for (const event of (eventsR1 || [])) {
        const { data: existing } = await supabase
          .from("sent_notifications")
          .select("id")
          .eq("user_id", userId)
          .eq("event_id", event.id)
          .eq("reminder_type", "reminder_1")
          .maybeSingle();
        if (existing) continue;

        const startDate = new Date(event.start_time);
        const formattedDate = startDate.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" });
        const formattedTime = startDate.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });

        await sendEmail(RESEND_API_KEY, userEmail,
          `⏰ Rappel : "${event.title}" dans ${r1Label}`,
          buildEmailHtml(`⏰ Rappel - ${r1Label} avant`, event.title, `${formattedDate} à ${formattedTime}`, event.description)
        );

        await supabase.from("sent_notifications").insert({ user_id: userId, event_id: event.id, reminder_type: "reminder_1" });
        totalSent++;
      }

      // Send reminder 2
      for (const event of (eventsR2 || [])) {
        const { data: existing } = await supabase
          .from("sent_notifications")
          .select("id")
          .eq("user_id", userId)
          .eq("event_id", event.id)
          .eq("reminder_type", "reminder_2")
          .maybeSingle();
        if (existing) continue;

        const startDate = new Date(event.start_time);
        const formattedTime = startDate.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });

        await sendEmail(RESEND_API_KEY, userEmail,
          `🔔 "${event.title}" dans ${r2Label} !`,
          buildEmailHtml(`🔔 C'est bientôt l'heure !`, event.title, `à ${formattedTime} (dans ${r2Label})`, event.description)
        );

        await supabase.from("sent_notifications").insert({ user_id: userId, event_id: event.id, reminder_type: "reminder_2" });
        totalSent++;
      }
    }

    return new Response(JSON.stringify({ sent: totalSent }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Notification error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

function formatDelay(minutes: number): string {
  if (minutes >= 1440) return `${Math.round(minutes / 1440)}j`;
  if (minutes >= 60) return `${Math.round(minutes / 60)}h`;
  return `${minutes} min`;
}

function escapeHtml(str: string): string {
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function buildEmailHtml(heading: string, title: string, when: string, description: string | null): string {
  const safeTitle = escapeHtml(title);
  const safeWhen = escapeHtml(when);
  const safeDesc = description ? escapeHtml(description) : null;
  return `<div style="font-family:sans-serif;max-width:500px;margin:0 auto;padding:20px;">
    <h2 style="color:#7c2d12;">${heading}</h2>
    <p>Votre tâche <strong>"${safeTitle}"</strong> est prévue :</p>
    <p style="font-size:18px;font-weight:bold;color:#9a3412;">${safeWhen}</p>
    ${safeDesc ? `<p style="color:#666;">${safeDesc}</p>` : ""}
    <hr style="border:none;border-top:1px solid #eee;margin:20px 0;">
    <p style="color:#999;font-size:12px;">Boss Project Manager</p>
  </div>`;
}

async function sendEmail(apiKey: string, to: string, subject: string, html: string) {
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: "Boss PM <onboarding@resend.dev>",
      to: [to],
      subject,
      html,
    }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Resend API error [${res.status}]: ${body}`);
  }
  return res.json();
}
