import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function escapeICS(str: string): string {
  return str.replace(/[\\;,]/g, (m) => "\\" + m).replace(/\n/g, "\\n");
}

function formatDate(d: string): string {
  return new Date(d).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const token = url.searchParams.get("token");
    const userId = url.searchParams.get("user_id");

    if (!token || !userId) {
      return new Response("Missing token or user_id", { status: 400 });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Verify the token belongs to this user
    const { data: integration } = await supabase
      .from("calendar_integrations")
      .select("*")
      .eq("user_id", userId)
      .eq("ics_feed_token", token)
      .eq("enabled", true)
      .maybeSingle();

    if (!integration) {
      return new Response("Invalid or disabled feed", { status: 403 });
    }

    // Fetch events
    const { data: events } = await supabase
      .from("calendar_events")
      .select("*")
      .eq("user_id", userId);

    // Also fetch tasks as events
    const { data: projects } = await supabase
      .from("projects")
      .select("id, title")
      .eq("user_id", userId);

    const projectIds = (projects || []).map((p: any) => p.id);

    let tasks: any[] = [];
    if (projectIds.length > 0) {
      const { data: phases } = await supabase
        .from("phases")
        .select("id, name, project_id")
        .in("project_id", projectIds);

      const phaseIds = (phases || []).map((p: any) => p.id);
      if (phaseIds.length > 0) {
        const { data: t } = await supabase
          .from("tasks")
          .select("*")
          .in("phase_id", phaseIds);
        tasks = t || [];
      }
    }

    // Build ICS
    let ics = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//BossPM//Calendar//FR",
      "CALSCALE:GREGORIAN",
      "METHOD:PUBLISH",
      "X-WR-CALNAME:BossPM",
    ];

    for (const ev of events || []) {
      ics.push("BEGIN:VEVENT");
      ics.push(`UID:${ev.id}@bosspm`);
      ics.push(`DTSTART:${formatDate(ev.start_time)}`);
      ics.push(`DTEND:${formatDate(ev.end_time)}`);
      ics.push(`SUMMARY:${escapeICS(ev.title)}`);
      if (ev.description) ics.push(`DESCRIPTION:${escapeICS(ev.description)}`);
      ics.push(`DTSTAMP:${formatDate(ev.created_at)}`);
      ics.push("END:VEVENT");
    }

    // Add tasks with deadlines as events (duration-based)
    for (const task of tasks) {
      const start = new Date(task.created_at);
      const end = new Date(start.getTime() + task.duration_hours * 3600000);
      ics.push("BEGIN:VEVENT");
      ics.push(`UID:task-${task.id}@bosspm`);
      ics.push(`DTSTART:${formatDate(start.toISOString())}`);
      ics.push(`DTEND:${formatDate(end.toISOString())}`);
      ics.push(`SUMMARY:[Tâche] ${escapeICS(task.title)}`);
      if (task.description) ics.push(`DESCRIPTION:${escapeICS(task.description)}`);
      ics.push(`DTSTAMP:${formatDate(task.created_at)}`);
      ics.push("END:VEVENT");
    }

    ics.push("END:VCALENDAR");

    return new Response(ics.join("\r\n"), {
      headers: {
        ...corsHeaders,
        "Content-Type": "text/calendar; charset=utf-8",
        "Content-Disposition": 'attachment; filename="bosspm.ics"',
      },
    });
  } catch (error) {
    console.error("ICS generation error:", error);
    return new Response(JSON.stringify({ error: "Internal error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
