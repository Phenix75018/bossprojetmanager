import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function escapeICS(str: string): string {
  return String(str).replace(/[\\;,]/g, (m) => "\\" + m).replace(/\r?\n/g, "\\n");
}

// UTC timestamp (ends with Z)
function formatDateUTC(d: string | Date): string {
  return new Date(d).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

// Local floating time (no Z, no TZID) — wall-clock in every client
function formatDateLocalFloating(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return (
    d.getFullYear().toString() +
    pad(d.getMonth() + 1) +
    pad(d.getDate()) +
    "T" +
    pad(d.getHours()) +
    pad(d.getMinutes()) +
    "00"
  );
}

// Convert a Date whose wall-clock values (year/month/day/hours/minutes) should
// be interpreted in the given IANA timezone into the correct UTC instant, then
// format as UTC ICS timestamp.
function formatWallClockAsUTC(d: Date, tz: string): string {
  // Treat the Date's local getters as wall-clock in `tz`.
  // Compute the offset of `tz` at that wall-clock and shift accordingly.
  const asIfUTC = Date.UTC(
    d.getFullYear(),
    d.getMonth(),
    d.getDate(),
    d.getHours(),
    d.getMinutes(),
    0,
  );
  // Get the offset (minutes) that `tz` has at that instant.
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    hourCycle: "h23",
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
  });
  const parts = dtf.formatToParts(new Date(asIfUTC));
  const map: Record<string, string> = {};
  for (const p of parts) if (p.type !== "literal") map[p.type] = p.value;
  const tzWall = Date.UTC(
    Number(map.year), Number(map.month) - 1, Number(map.day),
    Number(map.hour), Number(map.minute), Number(map.second),
  );
  const offsetMs = tzWall - asIfUTC; // tz is ahead of UTC by this many ms
  const utcInstant = asIfUTC - offsetMs;
  return formatDateUTC(new Date(utcInstant));
}

const DAY_MAP: Record<string, number> = {
  Dimanche: 0, Lundi: 1, Mardi: 2, Mercredi: 3, Jeudi: 4, Vendredi: 5, Samedi: 6,
};

function parseTimeSlots(slots: string | null): { start: number; end: number }[] {
  if (!slots) return [{ start: 9, end: 12 }, { start: 14, end: 18 }];
  return slots
    .split(",")
    .map((s) => {
      const m = s.trim().match(/(\d+)h?-(\d+)h?/);
      return m ? { start: parseInt(m[1]), end: parseInt(m[2]) } : null;
    })
    .filter(Boolean) as { start: number; end: number }[];
}

interface DispatchItem {
  taskId: string;
  taskTitle: string;
  description?: string | null;
  priority: string;
  phaseName: string;
  projectTitle: string;
  duration: number;
  subtaskTitle?: string;
  isSubtask: boolean;
  sortOrder: number;
}

interface ScheduledChunk extends DispatchItem {
  date: Date;
  startHour: number;
  chunkHours: number;
}

function dispatchProject(
  project: any,
  phases: any[],
  tasks: any[],
  subtasks: any[],
  startDate: Date,
): ScheduledChunk[] {
  const availableDays = new Set(
    (project.days_per_week || []).map((d: string) => DAY_MAP[d] ?? -1).filter((d: number) => d >= 0),
  );
  if (availableDays.size === 0) return [];
  const timeSlots = parseTimeSlots(project.time_slots);
  const hoursPerDay = timeSlots.reduce((s, t) => s + (t.end - t.start), 0);
  if (hoursPerDay <= 0) return [];

  const phasesById = new Map(phases.map((p) => [p.id, p]));
  const subtasksByTask = new Map<string, any[]>();
  for (const st of subtasks) {
    const arr = subtasksByTask.get(st.task_id) || [];
    arr.push(st);
    subtasksByTask.set(st.task_id, arr);
  }

  const items: DispatchItem[] = [];
  const projectTasks = tasks
    .filter((t) => phasesById.has(t.phase_id))
    .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));

  for (const task of projectTasks) {
    if (task.status === "done") continue;
    const phase = phasesById.get(task.phase_id);
    const phaseName = phase?.name || "";
    const sts = (subtasksByTask.get(task.id) || []).filter((s) => s.status !== "done");
    if (sts.length > 0) {
      for (const st of sts) {
        items.push({
          taskId: task.id, taskTitle: task.title, description: task.description,
          priority: task.priority, phaseName, projectTitle: project.title,
          duration: st.duration_hours || 1, subtaskTitle: st.title,
          isSubtask: true, sortOrder: task.sort_order ?? 0,
        });
      }
    } else {
      items.push({
        taskId: task.id, taskTitle: task.title, description: task.description,
        priority: task.priority, phaseName, projectTitle: project.title,
        duration: task.duration_hours || 1, isSubtask: false,
        sortOrder: task.sort_order ?? 0,
      });
    }
  }

  const priorityOrder: Record<string, number> = { P0: 0, P1: 1, P2: 2 };
  items.sort(
    (a, b) =>
      (priorityOrder[a.priority] ?? 1) - (priorityOrder[b.priority] ?? 1) ||
      a.sortOrder - b.sortOrder,
  );

  const findNextAvailableDay = (from: Date): Date => {
    const d = new Date(from);
    for (let i = 0; i < 365; i++) {
      if (availableDays.has(d.getDay())) return d;
      d.setDate(d.getDate() + 1);
    }
    return d;
  };

  const out: ScheduledChunk[] = [];
  let currentDate = findNextAvailableDay(startDate);
  let remainingHoursToday = hoursPerDay;
  let currentSlotIdx = 0;
  let currentHourInSlot = timeSlots[0].start;

  for (const item of items) {
    let remaining = item.duration;
    let guard = 0;
    while (remaining > 0 && guard++ < 5000) {
      if (remainingHoursToday <= 0) {
        currentDate = findNextAvailableDay(new Date(currentDate.getTime() + 86400000));
        remainingHoursToday = hoursPerDay;
        currentSlotIdx = 0;
        currentHourInSlot = timeSlots[0].start;
      }
      const slot = timeSlots[currentSlotIdx];
      if (!slot) {
        currentDate = findNextAvailableDay(new Date(currentDate.getTime() + 86400000));
        remainingHoursToday = hoursPerDay;
        currentSlotIdx = 0;
        currentHourInSlot = timeSlots[0].start;
        continue;
      }
      const availableInSlot = slot.end - currentHourInSlot;
      const chunk = Math.min(remaining, availableInSlot);
      if (chunk > 0) {
        out.push({
          ...item,
          date: new Date(currentDate),
          startHour: currentHourInSlot,
          chunkHours: chunk,
        });
        remaining -= chunk;
        remainingHoursToday -= chunk;
        currentHourInSlot += chunk;
      }
      if (currentHourInSlot >= slot.end) {
        currentSlotIdx++;
        if (currentSlotIdx < timeSlots.length) {
          currentHourInSlot = timeSlots[currentSlotIdx].start;
        }
      }
    }
  }

  return out;
}

// Minimal VTIMEZONE using X-LIC-LOCATION — Google & Apple resolve DST from
// their own IANA DB when only the location is supplied, so no rrule needed.
function buildVTimezone(tz: string): string[] {
  return [
    "BEGIN:VTIMEZONE",
    `TZID:${tz}`,
    `X-LIC-LOCATION:${tz}`,
    "END:VTIMEZONE",
  ];
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

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

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

    // Timezone strategy — 'floating' (default), 'UTC', or IANA (e.g. 'Europe/Paris')
    const rawTz = (integration.timezone as string | null) || "floating";
    const tzMode: "floating" | "utc" | "iana" =
      rawTz === "floating" ? "floating" : rawTz === "UTC" ? "utc" : "iana";
    const ianaTz = tzMode === "iana" ? rawTz : null;

    const { data: events } = await supabase
      .from("calendar_events").select("*").eq("user_id", userId);

    const { data: projects } = await supabase
      .from("projects").select("*").eq("user_id", userId);

    const projectIds = (projects || []).map((p: any) => p.id);
    let phases: any[] = [];
    let tasks: any[] = [];
    let subtasks: any[] = [];

    if (projectIds.length > 0) {
      const { data: p } = await supabase.from("phases").select("*").in("project_id", projectIds);
      phases = p || [];
      const phaseIds = phases.map((x) => x.id);
      if (phaseIds.length > 0) {
        const { data: t } = await supabase.from("tasks").select("*").in("phase_id", phaseIds);
        tasks = t || [];
        const taskIds = tasks.map((x) => x.id);
        if (taskIds.length > 0) {
          const { data: s } = await supabase.from("subtasks").select("*").in("task_id", taskIds);
          subtasks = s || [];
        }
      }
    }

    const startDate = new Date();
    startDate.setHours(0, 0, 0, 0);
    const allChunks: ScheduledChunk[] = [];
    for (const project of projects || []) {
      const projectPhases = phases.filter((p) => p.project_id === project.id);
      allChunks.push(...dispatchProject(project, projectPhases, tasks, subtasks, startDate));
    }

    const ics: string[] = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//BossPM//Calendar//FR",
      "CALSCALE:GREGORIAN",
      "METHOD:PUBLISH",
      "X-WR-CALNAME:BossPM",
      "X-PUBLISHED-TTL:PT1H",
      "REFRESH-INTERVAL;VALUE=DURATION:PT1H",
    ];
    if (ianaTz) {
      ics.push(`X-WR-TIMEZONE:${ianaTz}`);
      ics.push(...buildVTimezone(ianaTz));
    } else if (tzMode === "utc") {
      ics.push("X-WR-TIMEZONE:UTC");
    }

    const dtstamp = formatDateUTC(new Date().toISOString());

    // Custom events (stored as absolute UTC timestamps already)
    for (const ev of events || []) {
      ics.push("BEGIN:VEVENT");
      ics.push(`UID:event-${ev.id}@bosspm`);
      ics.push(`DTSTAMP:${dtstamp}`);
      ics.push(`DTSTART:${formatDateUTC(ev.start_time)}`);
      ics.push(`DTEND:${formatDateUTC(ev.end_time)}`);
      ics.push(`SUMMARY:${escapeICS(ev.title)}`);
      if (ev.description) ics.push(`DESCRIPTION:${escapeICS(ev.description)}`);
      ics.push("END:VEVENT");
    }

    // Scheduled task chunks — emit with the chosen TZ strategy
    let chunkIdx = 0;
    for (const c of allChunks) {
      const start = new Date(c.date);
      const startWholeHour = Math.floor(c.startHour);
      const startMinutes = Math.round((c.startHour - startWholeHour) * 60);
      start.setHours(startWholeHour, startMinutes, 0, 0);
      const end = new Date(start.getTime() + c.chunkHours * 3600000);

      const title = c.isSubtask ? `${c.taskTitle} — ${c.subtaskTitle}` : c.taskTitle;
      const descParts = [
        `Projet : ${c.projectTitle}`,
        `Phase : ${c.phaseName}`,
        `Priorité : ${c.priority}`,
      ];
      if (c.description) descParts.push("", c.description);

      let dtstart: string;
      let dtend: string;
      if (ianaTz) {
        // Wall-clock in the user's IANA zone, no offset math needed
        dtstart = `DTSTART;TZID=${ianaTz}:${formatDateLocalFloating(start)}`;
        dtend = `DTEND;TZID=${ianaTz}:${formatDateLocalFloating(end)}`;
      } else if (tzMode === "utc") {
        // Treat dispatch wall-clock as UTC hours
        dtstart = `DTSTART:${formatWallClockAsUTC(start, "UTC")}`;
        dtend = `DTEND:${formatWallClockAsUTC(end, "UTC")}`;
      } else {
        // Floating (current behavior)
        dtstart = `DTSTART:${formatDateLocalFloating(start)}`;
        dtend = `DTEND:${formatDateLocalFloating(end)}`;
      }

      ics.push("BEGIN:VEVENT");
      ics.push(`UID:task-${c.taskId}-${chunkIdx++}@bosspm`);
      ics.push(`DTSTAMP:${dtstamp}`);
      ics.push(dtstart);
      ics.push(dtend);
      ics.push(`SUMMARY:${escapeICS(title)}`);
      ics.push(`DESCRIPTION:${escapeICS(descParts.join("\n"))}`);
      ics.push("END:VEVENT");
    }

    ics.push("END:VCALENDAR");

    return new Response(ics.join("\r\n"), {
      headers: {
        ...corsHeaders,
        "Content-Type": "text/calendar; charset=utf-8",
        "Cache-Control": "no-cache, max-age=0",
        "Content-Disposition": 'inline; filename="bosspm.ics"',
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
