import { useState, useEffect, useMemo } from "react";
import { useParams } from "react-router-dom";
import {
  ChevronLeft,
  ChevronRight,
  Clock,
  Loader2,
  Circle,
  CheckCircle2,
} from "lucide-react";
import {
  addDays,
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  format,
  isSameMonth,
  isToday,
  getDay,
} from "date-fns";
import { fr } from "date-fns/locale";

type CalendarMode = "week" | "month";

interface TaskData {
  id: string;
  title: string;
  description: string | null;
  priority: string;
  status: string;
  duration_hours: number;
  optional: boolean;
  phase_id: string;
  sort_order: number;
}

interface SubtaskData {
  id: string;
  title: string;
  status: string;
  duration_hours: number;
  task_id: string;
  sort_order: number;
}

interface ScheduledItem {
  task: TaskData;
  phaseName: string;
  startHour: number;
  durationHours: number;
  subtaskTitle?: string;
  isSubtask?: boolean;
}

const priorityConfig: Record<string, { label: string; class: string }> = {
  P0: { label: "Critique", class: "bg-amber-700/15 border-amber-700/30 text-amber-800" },
  P1: { label: "Haute", class: "bg-red-800/15 border-red-800/30 text-red-800" },
  P2: { label: "Normale", class: "bg-primary/15 border-primary/30 text-primary" },
};

const DAY_MAP: Record<string, number> = {
  Dimanche: 0, Lundi: 1, Mardi: 2, Mercredi: 3, Jeudi: 4, Vendredi: 5, Samedi: 6,
};

function parseTimeSlots(slots: string | null): { start: number; end: number }[] {
  if (!slots) return [{ start: 9, end: 12 }, { start: 14, end: 18 }];
  return slots.split(",").map((s) => {
    const parts = s.trim().match(/(\d+)h?-(\d+)h?/);
    if (!parts) return { start: 9, end: 12 };
    return { start: parseInt(parts[1]), end: parseInt(parts[2]) };
  });
}

function getAvailableHoursPerDay(slots: { start: number; end: number }[]): number {
  return slots.reduce((sum, s) => sum + (s.end - s.start), 0);
}

function dispatchItems(
  items: { task: TaskData; phaseName: string; duration: number; subtaskTitle?: string; isSubtask?: boolean }[],
  availableDays: Set<number>,
  timeSlots: { start: number; end: number }[],
  startDate: Date
): Map<string, ScheduledItem[]> {
  const hoursPerDay = getAvailableHoursPerDay(timeSlots);
  const schedule = new Map<string, ScheduledItem[]>();
  
  const findNextDay = (from: Date): Date => {
    let d = new Date(from);
    for (let i = 0; i < 365; i++) {
      if (availableDays.has(getDay(d))) return d;
      d = addDays(d, 1);
    }
    return d;
  };

  let currentDate = findNextDay(startDate);
  let remainingHoursToday = hoursPerDay;
  let currentSlotIdx = 0;
  let currentHourInSlot = timeSlots[0]?.start || 9;

  for (const { task, phaseName, duration, subtaskTitle, isSubtask } of items) {
    let remaining = duration;
    while (remaining > 0) {
      if (remainingHoursToday <= 0) {
        currentDate = findNextDay(addDays(currentDate, 1));
        remainingHoursToday = hoursPerDay;
        currentSlotIdx = 0;
        currentHourInSlot = timeSlots[0]?.start || 9;
      }
      const slot = timeSlots[currentSlotIdx];
      if (!slot) {
        currentDate = findNextDay(addDays(currentDate, 1));
        remainingHoursToday = hoursPerDay;
        currentSlotIdx = 0;
        currentHourInSlot = timeSlots[0]?.start || 9;
        continue;
      }
      const availableInSlot = slot.end - currentHourInSlot;
      const chunk = Math.min(remaining, availableInSlot);
      if (chunk > 0) {
        const key = format(currentDate, "yyyy-MM-dd");
        const existing = schedule.get(key) || [];
        existing.push({ task, phaseName, startHour: currentHourInSlot, durationHours: chunk, subtaskTitle, isSubtask });
        schedule.set(key, existing);
        remaining -= chunk;
        remainingHoursToday -= chunk;
        currentHourInSlot += chunk;
      }
      if (currentHourInSlot >= slot.end) {
        currentSlotIdx++;
        if (currentSlotIdx < timeSlots.length) currentHourInSlot = timeSlots[currentSlotIdx].start;
      }
    }
  }
  return schedule;
}

export default function SharedCalendar() {
  const { token } = useParams<{ token: string }>();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<CalendarMode>("week");
  const [currentDate, setCurrentDate] = useState(new Date());
  const [needsPassword, setNeedsPassword] = useState(false);
  const [passwordInput, setPasswordInput] = useState("");
  const [passwordError, setPasswordError] = useState(false);

  const fetchCalendar = (pwd?: string) => {
    if (!token) return;
    setLoading(true);
    const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
    const params = new URLSearchParams({ token });
    if (pwd) params.set("password", pwd);
    fetch(`https://${projectId}.supabase.co/functions/v1/get-shared-calendar?${params}`)
      .then((res) => res.json())
      .then((d) => {
        if (d.needs_password) {
          setNeedsPassword(true);
          if (pwd) setPasswordError(true);
        } else if (d.error) {
          setError(d.error);
        } else {
          setData(d);
          setNeedsPassword(false);
        }
        setLoading(false);
      })
      .catch(() => { setError("Impossible de charger le calendrier"); setLoading(false); });
  };

  useEffect(() => { fetchCalendar(); }, [token]);

  const handlePasswordSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError(false);
    fetchCalendar(passwordInput);
  };

  // Build schedule from data
  const { schedule, timeSlots, availableDayNums, hours } = useMemo(() => {
    if (!data || !data.projects?.length) {
      return { schedule: new Map(), timeSlots: [{ start: 9, end: 12 }, { start: 14, end: 18 }], availableDayNums: new Set<number>(), hours: [] as number[] };
    }

    // Use first project's config for time slots and days
    const mainProject = data.projects[0];
    const ts = parseTimeSlots(mainProject.time_slots);
    const daysArr: string[] = mainProject.days_per_week || ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi"];
    const availDays = new Set<number>(daysArr.map((d: string) => DAY_MAP[d] ?? -1).filter((d: number) => d >= 0));

    // Build phase map
    const phaseMap: Record<string, string> = {};
    (data.phases || []).forEach((p: any) => { phaseMap[p.id] = p.name; });

    // Group subtasks by task
    const subtasksByTask: Record<string, SubtaskData[]> = {};
    (data.subtasks || []).forEach((st: SubtaskData) => {
      if (!subtasksByTask[st.task_id]) subtasksByTask[st.task_id] = [];
      subtasksByTask[st.task_id].push(st);
    });

    // Build items
    const priorityOrder: Record<string, number> = { P0: 0, P1: 1, P2: 2 };
    const items: { task: TaskData; phaseName: string; duration: number; subtaskTitle?: string; isSubtask?: boolean }[] = [];

    for (const task of data.tasks || []) {
      if (task.status === "done") continue;
      const subs = (subtasksByTask[task.id] || []).filter((s) => s.status !== "done");
      if (subs.length > 0) {
        for (const st of subs) {
          items.push({ task, phaseName: phaseMap[task.phase_id] || "", duration: st.duration_hours || 1, subtaskTitle: st.title, isSubtask: true });
        }
      } else {
        items.push({ task, phaseName: phaseMap[task.phase_id] || "", duration: task.duration_hours });
      }
    }

    items.sort((a, b) => (priorityOrder[a.task.priority] ?? 1) - (priorityOrder[b.task.priority] ?? 1) || a.task.sort_order - b.task.sort_order);

    const sched = dispatchItems(items, availDays, ts, new Date());
    const minH = Math.min(...ts.map((s) => s.start));
    const maxH = Math.max(...ts.map((s) => s.end));
    const hrs: number[] = [];
    for (let h = minH; h < maxH; h++) hrs.push(h);

    return { schedule: sched, timeSlots: ts, availableDayNums: availDays, hours: hrs };
  }, [data]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (needsPassword) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="glass-card rounded-2xl p-8 max-w-sm w-full mx-4 text-center">
          <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
            <Clock className="w-6 h-6 text-primary" />
          </div>
          <h1 className="text-xl font-display font-bold mb-2">Calendrier protégé</h1>
          <p className="text-sm text-muted-foreground mb-6">Ce calendrier est protégé par un mot de passe.</p>
          <form onSubmit={handlePasswordSubmit} className="space-y-3">
            <input
              type="password"
              placeholder="Mot de passe"
              value={passwordInput}
              onChange={(e) => { setPasswordInput(e.target.value); setPasswordError(false); }}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              autoFocus
            />
            {passwordError && <p className="text-xs text-destructive">Mot de passe incorrect</p>}
            <button type="submit" disabled={!passwordInput} className="w-full gradient-bg text-primary-foreground rounded-lg py-2.5 text-sm font-semibold disabled:opacity-50">
              Accéder au calendrier
            </button>
          </form>
        </div>
      </div>
    );
  }


    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-display font-bold mb-2">Calendrier introuvable</h1>
          <p className="text-muted-foreground">{error || "Ce lien n'est pas valide."}</p>
        </div>
      </div>
    );
  }

  const hoursPerDay = getAvailableHoursPerDay(timeSlots);

  const days = (() => {
    if (mode === "week") {
      const start = startOfWeek(currentDate, { locale: fr });
      return eachDayOfInterval({ start, end: endOfWeek(currentDate, { locale: fr }) });
    }
    const start = startOfWeek(startOfMonth(currentDate), { locale: fr });
    const end = endOfWeek(endOfMonth(currentDate), { locale: fr });
    return eachDayOfInterval({ start, end });
  })();

  const navigate = (dir: -1 | 1) => {
    setCurrentDate((prev) => addDays(prev, dir * (mode === "week" ? 7 : 30)));
  };

  const getTasksForDay = (date: Date): ScheduledItem[] => schedule.get(format(date, "yyyy-MM-dd")) || [];

  const getDayLoad = (date: Date) => {
    const tasks = getTasksForDay(date);
    const used = tasks.reduce((sum, t) => sum + t.durationHours, 0);
    const isAvailable = availableDayNums.has(getDay(date));
    const total = isAvailable ? hoursPerDay : 0;
    const percent = total > 0 ? Math.min(Math.round((used / total) * 100), 100) : 0;
    return { used, total, percent };
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="border-b border-border bg-card/50 backdrop-blur-xl sticky top-0 z-10">
        <div className="container py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-xl">📅</span>
            <span className="font-display font-bold text-lg">Boss PM</span>
          </div>
          <span className="text-xs text-muted-foreground">Calendrier partagé en lecture seule</span>
        </div>
      </div>

      <div className="container pt-8 pb-12 max-w-6xl">
        <h1 className="text-2xl font-display font-black mb-6">Calendrier partagé</h1>

        {/* Controls */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            {(["week", "month"] as CalendarMode[]).map((m) => (
              <button key={m} onClick={() => setMode(m)} className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${mode === m ? "gradient-bg text-primary-foreground" : "bg-muted text-muted-foreground hover:text-foreground"}`}>
                {m === "week" ? "Semaine" : "Mois"}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-3">
            <button onClick={() => navigate(-1)} className="p-1.5 rounded-lg hover:bg-muted transition-colors">
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="font-display font-bold text-sm min-w-[160px] text-center">
              {mode === "week"
                ? `${format(days[0], "d MMM", { locale: fr })} — ${format(days[days.length - 1], "d MMM yyyy", { locale: fr })}`
                : format(currentDate, "MMMM yyyy", { locale: fr })}
            </span>
            <button onClick={() => navigate(1)} className="p-1.5 rounded-lg hover:bg-muted transition-colors">
              <ChevronRight className="w-4 h-4" />
            </button>
            <button onClick={() => setCurrentDate(new Date())} className="px-3 py-1.5 rounded-lg text-xs font-medium bg-muted text-muted-foreground hover:text-foreground transition-all">
              Aujourd'hui
            </button>
          </div>
        </div>

        {/* Week view */}
        {mode === "week" && (
          <div className="glass-card rounded-2xl overflow-hidden">
            <div className="grid grid-cols-[60px_repeat(7,1fr)] border-b border-border">
              <div className="p-2" />
              {days.map((day) => {
                const isAvailable = availableDayNums.has(getDay(day));
                const load = getDayLoad(day);
                return (
                  <div key={day.toISOString()} className={`p-3 text-center border-l border-border ${!isAvailable ? "bg-muted/30" : ""}`}>
                    <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{format(day, "EEE", { locale: fr })}</div>
                    <div className={`text-lg font-bold mt-0.5 ${isToday(day) ? "w-8 h-8 rounded-full gradient-bg text-primary-foreground flex items-center justify-center mx-auto" : ""}`}>
                      {format(day, "d")}
                    </div>
                    {isAvailable && load.total > 0 && (
                      <div className="mt-1.5 mx-auto max-w-[80%]">
                        <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden">
                          <div className={`h-full rounded-full transition-all ${load.percent >= 100 ? "bg-teal-600" : load.percent >= 70 ? "bg-amber-600" : "bg-primary"}`} style={{ width: `${load.percent}%` }} />
                        </div>
                        <div className="text-[9px] text-muted-foreground mt-0.5 font-mono">{load.used}h/{load.total}h</div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
            <div className="grid grid-cols-[60px_repeat(7,1fr)]">
              {hours.map((hour) => (
                <div key={hour} className="contents">
                  <div className="p-2 text-[10px] font-mono text-muted-foreground text-right pr-3 border-t border-border h-16 flex items-start justify-end pt-1">{hour}h</div>
                  {days.map((day) => {
                    const isAvailable = availableDayNums.has(getDay(day));
                    const dayTasks = getTasksForDay(day);
                    const tasksInHour = dayTasks.filter((st) => st.startHour <= hour && st.startHour + st.durationHours > hour);
                    const isInSlot = timeSlots.some((s) => hour >= s.start && hour < s.end);
                    return (
                      <div key={day.toISOString() + hour} className={`border-l border-t border-border h-16 relative ${!isAvailable || !isInSlot ? "bg-muted/20" : "bg-background"}`}>
                        {tasksInHour.map((st, idx) => {
                          if (st.startHour !== hour) return null;
                          const pCfg = priorityConfig[st.task.priority] || priorityConfig.P1;
                          const heightPx = Math.min(st.durationHours * 64, 64 * 4);
                          return (
                            <div
                              key={st.task.id + idx}
                              className={`absolute inset-x-0.5 top-0.5 rounded-md border px-1.5 py-0.5 overflow-hidden z-10 ${pCfg.class}`}
                              style={{ height: `${heightPx - 4}px` }}
                              title={`${st.isSubtask ? `↳ ${st.subtaskTitle}` : st.task.title} — ${st.durationHours}h (${st.phaseName})`}
                            >
                              <div className="text-[10px] font-semibold leading-tight truncate">{st.isSubtask ? st.subtaskTitle : st.task.title}</div>
                              {st.durationHours > 1 && <div className="text-[9px] opacity-70 truncate mt-0.5">{st.isSubtask ? st.task.title : st.phaseName} · {st.durationHours}h</div>}
                            </div>
                          );
                        })}
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Month view */}
        {mode === "month" && (
          <div className="glass-card rounded-2xl overflow-hidden">
            <div className="grid grid-cols-7">
              {["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"].map((d) => (
                <div key={d} className="p-2 text-center text-[10px] uppercase tracking-wider text-muted-foreground font-medium border-b border-border">{d}</div>
              ))}
              {days.map((day) => {
                const dayTasks = getTasksForDay(day);
                const isAvailable = availableDayNums.has(getDay(day));
                const inMonth = isSameMonth(day, currentDate);
                const load = getDayLoad(day);
                return (
                  <div key={day.toISOString()} className={`min-h-[100px] border-b border-r border-border p-1.5 ${!inMonth ? "opacity-30" : ""} ${!isAvailable ? "bg-muted/20" : ""}`}>
                    <div className="flex items-center gap-1 mb-1">
                      <div className={`text-xs font-medium ${isToday(day) ? "w-6 h-6 rounded-full gradient-bg text-primary-foreground flex items-center justify-center" : "text-muted-foreground"}`}>
                        {format(day, "d")}
                      </div>
                      {isAvailable && inMonth && load.total > 0 && (
                        <div className="flex-1 ml-0.5" title={`${load.used}h / ${load.total}h`}>
                          <div className="w-full h-1 bg-muted rounded-full overflow-hidden">
                            <div className={`h-full rounded-full transition-all ${load.percent >= 100 ? "bg-teal-600" : load.percent >= 70 ? "bg-amber-600" : "bg-primary"}`} style={{ width: `${load.percent}%` }} />
                          </div>
                        </div>
                      )}
                    </div>
                    <div className="space-y-0.5">
                      {dayTasks.slice(0, 3).map((st, idx) => {
                        const pCfg = priorityConfig[st.task.priority] || priorityConfig.P1;
                        return (
                          <div key={st.task.id + idx} className={`text-[9px] leading-tight px-1 py-0.5 rounded border truncate ${pCfg.class}`} title={st.isSubtask ? `↳ ${st.subtaskTitle} (${st.task.title})` : st.task.title}>
                            {st.isSubtask ? `↳ ${st.subtaskTitle}` : st.task.title}
                          </div>
                        );
                      })}
                      {dayTasks.length > 3 && <div className="text-[9px] text-muted-foreground pl-1">+{dayTasks.length - 3} autres</div>}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <div className="mt-8 text-center text-xs text-muted-foreground">
          Généré par <span className="font-semibold">Boss Project Manager</span>
        </div>
      </div>
    </div>
  );
}
