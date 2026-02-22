import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
    if (!RESEND_API_KEY) throw new Error("RESEND_API_KEY not configured");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const now = new Date();
    
    // Window for 12h reminder: events starting between 11h55m and 12h05m from now
    const h12Start = new Date(now.getTime() + 11 * 60 * 60 * 1000 + 55 * 60 * 1000);
    const h12End = new Date(now.getTime() + 12 * 60 * 60 * 1000 + 5 * 60 * 1000);

    // Window for 5min reminder: events starting between 4m and 6m from now
    const m5Start = new Date(now.getTime() + 4 * 60 * 1000);
    const m5End = new Date(now.getTime() + 6 * 60 * 1000);

    // Fetch users with notifications enabled
    const { data: enabledUsers } = await supabase
      .from("notification_preferences")
      .select("user_id")
      .eq("enabled", true);

    if (!enabledUsers || enabledUsers.length === 0) {
      return new Response(JSON.stringify({ sent: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userIds = enabledUsers.map((u: any) => u.user_id);
    let totalSent = 0;

    for (const userId of userIds) {
      // Get user email
      const { data: userData } = await supabase.auth.admin.getUserById(userId);
      if (!userData?.user?.email) continue;
      const userEmail = userData.user.email;

      // Check 12h events
      const { data: events12h } = await supabase
        .from("calendar_events")
        .select("id, title, start_time, description")
        .eq("user_id", userId)
        .gte("start_time", h12Start.toISOString())
        .lte("start_time", h12End.toISOString());

      // Check 5min events
      const { data: events5min } = await supabase
        .from("calendar_events")
        .select("id, title, start_time, description")
        .eq("user_id", userId)
        .gte("start_time", m5Start.toISOString())
        .lte("start_time", m5End.toISOString());

      // Send 12h reminders
      for (const event of (events12h || [])) {
        // Check if already sent
        const { data: existing } = await supabase
          .from("sent_notifications")
          .select("id")
          .eq("user_id", userId)
          .eq("event_id", event.id)
          .eq("reminder_type", "12h")
          .maybeSingle();

        if (existing) continue;

        const startDate = new Date(event.start_time);
        const formattedDate = startDate.toLocaleDateString("fr-FR", {
          weekday: "long", day: "numeric", month: "long",
        });
        const formattedTime = startDate.toLocaleTimeString("fr-FR", {
          hour: "2-digit", minute: "2-digit",
        });

        await sendEmail(RESEND_API_KEY, userEmail, 
          `⏰ Rappel : "${event.title}" dans 12 heures`,
          `<div style="font-family:sans-serif;max-width:500px;margin:0 auto;padding:20px;">
            <h2 style="color:#7c2d12;">⏰ Rappel - 12h avant</h2>
            <p>Votre tâche <strong>"${event.title}"</strong> est prévue pour :</p>
            <p style="font-size:18px;font-weight:bold;color:#9a3412;">${formattedDate} à ${formattedTime}</p>
            ${event.description ? `<p style="color:#666;">${event.description}</p>` : ""}
            <hr style="border:none;border-top:1px solid #eee;margin:20px 0;">
            <p style="color:#999;font-size:12px;">Boss Project Manager</p>
          </div>`
        );

        await supabase.from("sent_notifications").insert({
          user_id: userId, event_id: event.id, reminder_type: "12h",
        });
        totalSent++;
      }

      // Send 5min reminders
      for (const event of (events5min || [])) {
        const { data: existing } = await supabase
          .from("sent_notifications")
          .select("id")
          .eq("user_id", userId)
          .eq("event_id", event.id)
          .eq("reminder_type", "5min")
          .maybeSingle();

        if (existing) continue;

        const startDate = new Date(event.start_time);
        const formattedTime = startDate.toLocaleTimeString("fr-FR", {
          hour: "2-digit", minute: "2-digit",
        });

        await sendEmail(RESEND_API_KEY, userEmail,
          `🔔 "${event.title}" commence dans 5 minutes !`,
          `<div style="font-family:sans-serif;max-width:500px;margin:0 auto;padding:20px;">
            <h2 style="color:#dc2626;">🔔 C'est bientôt l'heure !</h2>
            <p>Votre tâche <strong>"${event.title}"</strong> commence dans <strong>5 minutes</strong> (à ${formattedTime}).</p>
            ${event.description ? `<p style="color:#666;">${event.description}</p>` : ""}
            <hr style="border:none;border-top:1px solid #eee;margin:20px 0;">
            <p style="color:#999;font-size:12px;">Boss Project Manager</p>
          </div>`
        );

        await supabase.from("sent_notifications").insert({
          user_id: userId, event_id: event.id, reminder_type: "5min",
        });
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
