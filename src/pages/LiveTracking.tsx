import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Activity, CalendarDays, CheckCircle2, Clock, DollarSign, Radio } from "lucide-react";
import Navbar from "@/components/layout/Navbar";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";

type Project = { id: string; title: string; deadline: string | null; completion_percent: number };
type Phase = { id: string; name: string; project_id: string; sort_order: number };
type Task = { id: string; phase_id: string; title: string; status: string; priority: string; duration_hours: number };
type Subtask = { id: string; task_id: string; status: string };
type Event = { id: string; task_id: string | null; project_id: string | null; start_time: string; end_time: string };
type Line = { budget_id: string; category: string; monthly_values: any; is_total: boolean };

const sumVals = (v: any) => (Array.isArray(v) ? v : Object.values(v ?? {})).reduce((a: number, x: any) => a + (Number(x) || 0), 0);
const fmtDate = (d?: string | null) => (d ? new Date(d).toLocaleDateString("fr-FR", { day: "2-digit", month: "short" }) : "—");
const eur = (n: number) => n.toLocaleString("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });
const done = (s: string) => s === "done" || s === "completed";

export default function LiveTracking() {
  const { user } = useAuth();
  const [projects, setProjects] = useState<Project[]>([]);
  const [projectId, setProjectId] = useState<string>("");
  const [phases, setPhases] = useState<Phase[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [subtasks, setSubtasks] = useState<Subtask[]>([]);
  const [events, setEvents] = useState<Event[]>([]);
  const [lines, setLines] = useState<Line[]>([]);
  const [lastSync, setLastSync] = useState<Date | null>(null);
  const [live, setLive] = useState(false);

  useEffect(() => {
    if (!user) return;
    supabase.from("projects").select("id,title,deadline,completion_percent").order("updated_at", { ascending: false }).then(({ data }) => {
      setProjects((data as Project[]) ?? []);
      if (data?.[0] && !projectId) setProjectId(data[0].id);
    });
  }, [user]);

  const load = useCallback(async () => {
    if (!projectId) return;
    const { data: ph } = await supabase.from("phases").select("id,name,project_id,sort_order").eq("project_id", projectId).order("sort_order");
    const phaseIds = (ph ?? []).map((p) => p.id);
    const { data: tk } = phaseIds.length
      ? await supabase.from("tasks").select("id,phase_id,title,status,priority,duration_hours").in("phase_id", phaseIds).order("sort_order")
      : { data: [] as Task[] };
    const taskIds = (tk ?? []).map((t) => t.id);
    const [st, ev, bd] = await Promise.all([
      taskIds.length ? supabase.from("subtasks").select("id,task_id,status").in("task_id", taskIds) : Promise.resolve({ data: [] }),
      supabase.from("calendar_events").select("id,task_id,project_id,start_time,end_time").eq("project_id", projectId).order("start_time"),
      supabase.from("budgets").select("id").eq("project_id", projectId),
    ]);
    const budgetIds = (bd.data ?? []).map((b: any) => b.id);
    const { data: bl } = budgetIds.length
      ? await supabase.from("budget_lines").select("budget_id,category,monthly_values,is_total").in("budget_id", budgetIds)
      : { data: [] as Line[] };
    setPhases((ph as Phase[]) ?? []);
    setTasks((tk as Task[]) ?? []);
    setSubtasks((st.data as Subtask[]) ?? []);
    setEvents((ev.data as Event[]) ?? []);
    setLines((bl as Line[]) ?? []);
    setLastSync(new Date());
  }, [projectId]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!projectId) return;
    let t: ReturnType<typeof setTimeout>;
    const refresh = () => { clearTimeout(t); t = setTimeout(load, 400); };
    const ch = supabase.channel(`live-${projectId}`);
    ["tasks", "subtasks", "calendar_events", "phases", "budget_lines", "projects"].forEach((table) =>
      ch.on("postgres_changes", { event: "*", schema: "public", table }, refresh));
    ch.subscribe((s) => setLive(s === "SUBSCRIBED"));
    return () => { clearTimeout(t); supabase.removeChannel(ch); };
  }, [projectId, load]);

  const toggleTask = async (task: Task) => {
    const status = done(task.status) ? "todo" : "done";
    setTasks((ts) => ts.map((x) => (x.id === task.id ? { ...x, status } : x)));
    const { error } = await supabase.from("tasks").update({ status }).eq("id", task.id);
    if (error) { toast.error("Mise à jour impossible"); load(); }
  };

  const stats = useMemo(() => {
    const doneT = tasks.filter((t) => done(t.status));
    const totalH = tasks.reduce((a, t) => a + Number(t.duration_hours || 0), 0);
    const doneH = doneT.reduce((a, t) => a + Number(t.duration_hours || 0), 0);
    const detail = lines.filter((l) => !l.is_total);
    const rev = detail.filter((l) => /revenu|recette|chiffre|vente/i.test(l.category)).reduce((a, l) => a + sumVals(l.monthly_values), 0);
    const cost = detail.filter((l) => !/revenu|recette|chiffre|vente/i.test(l.category)).reduce((a, l) => a + sumVals(l.monthly_values), 0);
    const now = Date.now();
    const next = events.find((e) => new Date(e.start_time).getTime() >= now);
    const last = events[events.length - 1];
    return { pct: totalH ? Math.round((doneH / totalH) * 100) : 0, doneCount: doneT.length, totalH, doneH, rev, cost, consumed: totalH ? cost * (doneH / totalH) : 0, next, last };
  }, [tasks, lines, events]);

  const eventsByTask = useMemo(() => {
    const m = new Map<string, Event[]>();
    events.forEach((e) => e.task_id && m.set(e.task_id, [...(m.get(e.task_id) ?? []), e]));
    return m;
  }, [events]);

  const project = projects.find((p) => p.id === projectId);

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="container mx-auto px-4 py-8 space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="font-display text-3xl text-foreground flex items-center gap-2"><Activity className="h-7 w-7 text-primary" /> Suivi en temps réel</h1>
            <p className="text-sm text-muted-foreground flex items-center gap-2 mt-1">
              <Radio className={`h-3.5 w-3.5 ${live ? "text-primary animate-pulse" : "text-muted-foreground"}`} />
              {live ? "Synchronisé en direct" : "Connexion…"} {lastSync && `· ${lastSync.toLocaleTimeString("fr-FR")}`}
            </p>
          </div>
          <Select value={projectId} onValueChange={setProjectId}>
            <SelectTrigger className="w-72"><SelectValue placeholder="Choisir un projet" /></SelectTrigger>
            <SelectContent>{projects.map((p) => <SelectItem key={p.id} value={p.id}>{p.title}</SelectItem>)}</SelectContent>
          </Select>
        </div>

        {!project ? <p className="text-muted-foreground">Aucun projet.</p> : <>
          <div className="grid gap-4 md:grid-cols-4">
            <Card><CardHeader className="pb-2"><CardTitle className="text-sm flex gap-2"><CheckCircle2 className="h-4 w-4 text-primary" />Avancement</CardTitle></CardHeader>
              <CardContent><div className="text-3xl font-bold">{stats.pct}%</div><Progress value={stats.pct} className="mt-2" />
                <p className="text-xs text-muted-foreground mt-2">{stats.doneCount}/{tasks.length} tâches · {stats.doneH}/{stats.totalH} h</p></CardContent></Card>
            <Card><CardHeader className="pb-2"><CardTitle className="text-sm flex gap-2"><DollarSign className="h-4 w-4 text-primary" />Budget</CardTitle></CardHeader>
              <CardContent><div className="text-2xl font-bold">{eur(stats.consumed)}</div>
                <p className="text-xs text-muted-foreground mt-1">consommé estimé / {eur(stats.cost)} de charges</p>
                <p className="text-xs text-muted-foreground">Revenus prévus : {eur(stats.rev)}</p></CardContent></Card>
            <Card><CardHeader className="pb-2"><CardTitle className="text-sm flex gap-2"><Clock className="h-4 w-4 text-primary" />Prochain créneau</CardTitle></CardHeader>
              <CardContent><div className="text-2xl font-bold">{stats.next ? new Date(stats.next.start_time).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" }) : "—"}</div>
                <p className="text-xs text-muted-foreground mt-1">{events.length} créneaux au calendrier</p></CardContent></Card>
            <Card><CardHeader className="pb-2"><CardTitle className="text-sm flex gap-2"><CalendarDays className="h-4 w-4 text-primary" />Dates</CardTitle></CardHeader>
              <CardContent><div className="text-sm">Fin prévue : <b>{fmtDate(stats.last?.end_time)}</b></div>
                <div className="text-sm">Échéance : <b>{fmtDate(project.deadline)}</b></div>
                {project.deadline && stats.last && new Date(stats.last.end_time) > new Date(project.deadline) &&
                  <Badge variant="destructive" className="mt-2">En retard sur l'échéance</Badge>}</CardContent></Card>
          </div>

          {phases.map((ph) => {
            const pt = tasks.filter((t) => t.phase_id === ph.id);
            const pd = pt.filter((t) => done(t.status)).length;
            return (
              <Card key={ph.id}>
                <CardHeader className="pb-2 flex-row items-center justify-between space-y-0">
                  <CardTitle className="font-display text-lg">{ph.name}</CardTitle>
                  <div className="flex items-center gap-3 w-48"><Progress value={pt.length ? (pd / pt.length) * 100 : 0} /><span className="text-xs text-muted-foreground">{pd}/{pt.length}</span></div>
                </CardHeader>
                <CardContent className="divide-y divide-border">
                  {pt.map((t) => {
                    const ev = eventsByTask.get(t.id) ?? [];
                    const st = subtasks.filter((s) => s.task_id === t.id);
                    const sd = st.filter((s) => done(s.status)).length;
                    return (
                      <div key={t.id} className="py-2 flex flex-wrap items-center gap-3">
                        <input type="checkbox" checked={done(t.status)} onChange={() => toggleTask(t)} className="h-4 w-4 accent-primary" aria-label={`Terminer ${t.title}`} />
                        <span className={`flex-1 min-w-[200px] text-sm ${done(t.status) ? "line-through text-muted-foreground" : "text-foreground"}`}>{t.title}</span>
                        <Badge variant="outline">{t.priority}</Badge>
                        {st.length > 0 && <span className="text-xs text-muted-foreground">{sd}/{st.length} sous-tâches</span>}
                        <span className="text-xs text-muted-foreground w-12 text-right">{t.duration_hours} h</span>
                        <span className="text-xs text-muted-foreground w-40 text-right">
                          {ev.length ? `${fmtDate(ev[0].start_time)} → ${fmtDate(ev[ev.length - 1].end_time)}` : "Non planifiée"}
                        </span>
                      </div>
                    );
                  })}
                </CardContent>
              </Card>
            );
          })}
          <p className="text-xs text-muted-foreground">Les modifications (ici, dans le plan ou le <Link to="/calendar" className="underline">calendrier</Link>) apparaissent instantanément.</p>
        </>}
      </main>
    </div>
  );
}
