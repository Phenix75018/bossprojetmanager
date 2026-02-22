import { useState, useMemo } from "react";
import { motion } from "framer-motion";
import {
  ChevronLeft,
  ChevronRight,
  Clock,
  CalendarDays,
} from "lucide-react";
import { ProjectWithDetails, TaskRow } from "@/hooks/useProjectsDB";
import {
  addDays,
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  format,
  isSameDay,
  isSameMonth,
  isToday,
  getDay,
} from "date-fns";
import { fr } from "date-fns/locale";

type CalendarMode = "week" | "month";

interface ScheduledTask {
  task: TaskRow & { subtasks: any[] };
  phaseName: string;
  startHour: number;
  durationHours: number;
  subtaskTitle?: string;
  isSubtask?: boolean;
}

interface DaySchedule {
  date: Date;
  tasks: ScheduledTask[];
  totalHours: number;
}

const priorityConfig: Record<string, { label: string; class: string }> = {
  P0: { label: "Critique", class: "bg-amber-700/15 border-amber-700/30 text-amber-800" },
  P1: { label: "Haute", class: "bg-red-800/15 border-red-800/30 text-red-800" },
  P2: { label: "Normale", class: "bg-primary/15 border-primary/30 text-primary" },
};

const DAY_MAP: Record<string, number> = {
  Dimanche: 0,
  Lundi: 1,
  Mardi: 2,
  Mercredi: 3,
  Jeudi: 4,
  Vendredi: 5,
  Samedi: 6,
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

function dispatchTasks(
  project: ProjectWithDetails,
  startDate: Date
): Map<string, ScheduledTask[]> {
  const availableDays = new Set(
    project.days_per_week.map((d) => DAY_MAP[d] ?? -1).filter((d) => d >= 0)
  );
  const timeSlots = parseTimeSlots(project.time_slots);
  const hoursPerDay = getAvailableHoursPerDay(timeSlots);

  // Collect all non-done items: expand subtasks when available
  interface DispatchItem {
    task: TaskRow & { subtasks: any[] };
    phaseName: string;
    duration: number;
    subtaskTitle?: string;
    isSubtask?: boolean;
  }
  const items: DispatchItem[] = [];
  for (const phase of project.phases) {
    for (const task of phase.tasks) {
      if (task.status === "done") continue;
      const activeSubtasks = (task.subtasks || []).filter((st: any) => st.status !== "done");
      if (activeSubtasks.length > 0) {
        // Schedule each subtask individually
        for (const st of activeSubtasks) {
          items.push({
            task,
            phaseName: phase.name,
            duration: st.duration_hours || 1,
            subtaskTitle: st.title,
            isSubtask: true,
          });
        }
      } else {
        // No subtasks: schedule the task as a whole
        items.push({ task, phaseName: phase.name, duration: task.duration_hours });
      }
    }
  }

  // Sort: P0 first, then P1, then P2, then by sort_order
  const priorityOrder: Record<string, number> = { P0: 0, P1: 1, P2: 2 };
  items.sort(
    (a, b) =>
      (priorityOrder[a.task.priority] ?? 1) - (priorityOrder[b.task.priority] ?? 1) ||
      a.task.sort_order - b.task.sort_order
  );

  const schedule = new Map<string, ScheduledTask[]>();
  let currentDate = new Date(startDate);
  let remainingHoursToday = 0;
  let currentSlotIdx = 0;
  let currentHourInSlot = 0;

  // Find next available day
  const findNextAvailableDay = (from: Date): Date => {
    let d = new Date(from);
    for (let i = 0; i < 365; i++) {
      if (availableDays.has(getDay(d))) return d;
      d = addDays(d, 1);
    }
    return d;
  };

  currentDate = findNextAvailableDay(startDate);
  remainingHoursToday = hoursPerDay;
  currentSlotIdx = 0;
  currentHourInSlot = timeSlots[0]?.start || 9;

  for (const { task, phaseName, duration, subtaskTitle, isSubtask } of items) {
    let remaining = duration;

    while (remaining > 0) {
      if (remainingHoursToday <= 0) {
        currentDate = findNextAvailableDay(addDays(currentDate, 1));
        remainingHoursToday = hoursPerDay;
        currentSlotIdx = 0;
        currentHourInSlot = timeSlots[0]?.start || 9;
      }

      const slot = timeSlots[currentSlotIdx];
      if (!slot) {
        currentDate = findNextAvailableDay(addDays(currentDate, 1));
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
        existing.push({
          task,
          phaseName,
          startHour: currentHourInSlot,
          durationHours: chunk,
          subtaskTitle,
          isSubtask,
        });
        schedule.set(key, existing);

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

  return schedule;
}

interface CalendarViewProps {
  project: ProjectWithDetails;
  onCycleStatus: (taskId: string, currentStatus: string) => void;
}

export default function CalendarView({ project, onCycleStatus }: CalendarViewProps) {
  const [mode, setMode] = useState<CalendarMode>("week");
  const [currentDate, setCurrentDate] = useState(new Date());

  const schedule = useMemo(() => dispatchTasks(project, new Date()), [project]);

  const timeSlots = useMemo(() => parseTimeSlots(project.time_slots), [project.time_slots]);
  const hours = useMemo(() => {
    const minH = Math.min(...timeSlots.map((s) => s.start));
    const maxH = Math.max(...timeSlots.map((s) => s.end));
    const arr: number[] = [];
    for (let h = minH; h < maxH; h++) arr.push(h);
    return arr;
  }, [timeSlots]);

  const availableDayNums = useMemo(
    () => new Set(project.days_per_week.map((d) => DAY_MAP[d] ?? -1).filter((d) => d >= 0)),
    [project.days_per_week]
  );

  const days = useMemo(() => {
    if (mode === "week") {
      const start = startOfWeek(currentDate, { locale: fr });
      return eachDayOfInterval({ start, end: endOfWeek(currentDate, { locale: fr }) });
    }
    const start = startOfWeek(startOfMonth(currentDate), { locale: fr });
    const end = endOfWeek(endOfMonth(currentDate), { locale: fr });
    return eachDayOfInterval({ start, end });
  }, [currentDate, mode]);

  const navigate = (dir: -1 | 1) => {
    setCurrentDate((prev) => addDays(prev, dir * (mode === "week" ? 7 : 30)));
  };

  const hoursPerDay = useMemo(() => getAvailableHoursPerDay(timeSlots), [timeSlots]);

  const getTasksForDay = (date: Date): ScheduledTask[] => {
    return schedule.get(format(date, "yyyy-MM-dd")) || [];
  };

  const getDayLoad = (date: Date): { used: number; total: number; percent: number } => {
    const tasks = getTasksForDay(date);
    const used = tasks.reduce((sum, t) => sum + t.durationHours, 0);
    const isAvailable = availableDayNums.has(getDay(date));
    const total = isAvailable ? hoursPerDay : 0;
    const percent = total > 0 ? Math.min(Math.round((used / total) * 100), 100) : 0;
    return { used, total, percent };
  };

  return (
    <div className="space-y-4">
      {/* Controls */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {(["week", "month"] as CalendarMode[]).map((m) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                mode === m
                  ? "gradient-bg text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:text-foreground"
              }`}
            >
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
          <button
            onClick={() => setCurrentDate(new Date())}
            className="px-3 py-1.5 rounded-lg text-xs font-medium bg-muted text-muted-foreground hover:text-foreground transition-all"
          >
            Aujourd'hui
          </button>
        </div>
      </div>

      {/* Week view */}
      {mode === "week" && (
        <div className="glass-card rounded-2xl overflow-hidden">
          {/* Header */}
          <div className="grid grid-cols-[60px_repeat(7,1fr)] border-b border-border">
            <div className="p-2" />
            {days.map((day) => {
              const isAvailable = availableDayNums.has(getDay(day));
              const load = getDayLoad(day);
              return (
                <div
                  key={day.toISOString()}
                  className={`p-3 text-center border-l border-border ${
                    !isAvailable ? "bg-muted/30" : ""
                  }`}
                >
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                    {format(day, "EEE", { locale: fr })}
                  </div>
                  <div
                    className={`text-lg font-bold mt-0.5 ${
                      isToday(day)
                        ? "w-8 h-8 rounded-full gradient-bg text-primary-foreground flex items-center justify-center mx-auto"
                        : ""
                    }`}
                  >
                    {format(day, "d")}
                  </div>
                  {isAvailable && load.total > 0 && (
                    <div className="mt-1.5 mx-auto max-w-[80%]">
                      <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-300 ${
                            load.percent >= 100 ? "bg-teal-600" : load.percent >= 70 ? "bg-amber-600" : "bg-primary"
                          }`}
                          style={{ width: `${load.percent}%` }}
                        />
                      </div>
                      <div className="text-[9px] text-muted-foreground mt-0.5 font-mono">{load.used}h/{load.total}h</div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Time grid */}
          <div className="grid grid-cols-[60px_repeat(7,1fr)]">
            {hours.map((hour) => (
              <div key={hour} className="contents">
                <div className="p-2 text-[10px] font-mono text-muted-foreground text-right pr-3 border-t border-border h-16 flex items-start justify-end pt-1">
                  {hour}h
                </div>
                {days.map((day) => {
                  const isAvailable = availableDayNums.has(getDay(day));
                  const dayTasks = getTasksForDay(day);
                  const tasksInHour = dayTasks.filter(
                    (st) => st.startHour <= hour && st.startHour + st.durationHours > hour
                  );

                  const isInSlot = timeSlots.some((s) => hour >= s.start && hour < s.end);

                  return (
                    <div
                      key={day.toISOString() + hour}
                      className={`border-l border-t border-border h-16 relative ${
                        !isAvailable || !isInSlot ? "bg-muted/20" : "bg-background"
                      }`}
                    >
                      {tasksInHour.map((st, idx) => {
                        if (st.startHour !== hour) return null;
                        const pCfg = priorityConfig[st.task.priority] || priorityConfig.P1;
                        const heightPx = Math.min(st.durationHours * 64, 64 * 4);
                        return (
                          <motion.div
                            key={st.task.id + idx}
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            className={`absolute inset-x-0.5 top-0.5 rounded-md border px-1.5 py-0.5 cursor-pointer overflow-hidden z-10 ${pCfg.class}`}
                            style={{ height: `${heightPx - 4}px` }}
                            onClick={() => onCycleStatus(st.task.id, st.task.status)}
                            title={`${st.isSubtask ? `↳ ${st.subtaskTitle}` : st.task.title} — ${st.durationHours}h (${st.phaseName})`}
                          >
                            <div className="text-[10px] font-semibold leading-tight truncate">
                              {st.isSubtask ? st.subtaskTitle : st.task.title}
                            </div>
                            {st.durationHours > 1 && (
                              <div className="text-[9px] opacity-70 truncate mt-0.5">
                                {st.isSubtask ? st.task.title : st.phaseName} · {st.durationHours}h
                              </div>
                            )}
                          </motion.div>
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
              <div key={d} className="p-2 text-center text-[10px] uppercase tracking-wider text-muted-foreground font-medium border-b border-border">
                {d}
              </div>
            ))}
            {days.map((day) => {
              const dayTasks = getTasksForDay(day);
              const isAvailable = availableDayNums.has(getDay(day));
              const inMonth = isSameMonth(day, currentDate);
              const load = getDayLoad(day);

              return (
                <div
                  key={day.toISOString()}
                  className={`min-h-[100px] border-b border-r border-border p-1.5 ${
                    !inMonth ? "opacity-30" : ""
                  } ${!isAvailable ? "bg-muted/20" : ""}`}
                >
                  <div className="flex items-center gap-1 mb-1">
                    <div
                      className={`text-xs font-medium ${
                        isToday(day)
                          ? "w-6 h-6 rounded-full gradient-bg text-primary-foreground flex items-center justify-center"
                          : "text-muted-foreground"
                      }`}
                    >
                      {format(day, "d")}
                    </div>
                    {isAvailable && inMonth && load.total > 0 && (
                      <div className="flex-1 ml-0.5" title={`${load.used}h / ${load.total}h`}>
                        <div className="w-full h-1 bg-muted rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all duration-300 ${
                              load.percent >= 100 ? "bg-teal-600" : load.percent >= 70 ? "bg-amber-600" : "bg-primary"
                            }`}
                            style={{ width: `${load.percent}%` }}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                  <div className="space-y-0.5">
                    {dayTasks.slice(0, 3).map((st, idx) => {
                      const pCfg = priorityConfig[st.task.priority] || priorityConfig.P1;
                      return (
                        <div
                          key={st.task.id + idx}
                          className={`text-[9px] leading-tight px-1 py-0.5 rounded border truncate cursor-pointer ${pCfg.class}`}
                          onClick={() => onCycleStatus(st.task.id, st.task.status)}
                          title={st.isSubtask ? `↳ ${st.subtaskTitle} (${st.task.title})` : st.task.title}
                        >
                          {st.isSubtask ? `↳ ${st.subtaskTitle}` : st.task.title}
                        </div>
                      );
                    })}
                    {dayTasks.length > 3 && (
                      <div className="text-[9px] text-muted-foreground pl-1">
                        +{dayTasks.length - 3} autres
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Legend */}
      <div className="flex items-center gap-4 text-xs text-muted-foreground">
        <div className="flex items-center gap-1.5">
          <CalendarDays className="w-3.5 h-3.5" />
          Disponible : {project.days_per_week.join(", ")}
        </div>
        <div className="flex items-center gap-1.5">
          <Clock className="w-3.5 h-3.5" />
          {project.time_slots || "9h-12h, 14h-18h"} · {project.hours_per_week}h/sem
        </div>
      </div>
    </div>
  );
}
