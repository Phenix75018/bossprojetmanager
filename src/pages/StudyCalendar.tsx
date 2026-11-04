import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Activity, ArrowLeft, CalendarDays, CalendarRange, CheckCircle2, DollarSign,
  Loader2, Telescope, Wallet,
} from "lucide-react";
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import Navbar from "@/components/layout/Navbar";
import { supabase } from "@/integrations/supabase/client";
import { useProjectsDB, type ProjectWithDetails } from "@/hooks/useProjectsDB";
import CalendarView, { dispatchTasks } from "@/components/CalendarView";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import {
  buildTimeline, mergeStudyProjects, studyMonthly, type StudyRow, type StudyTimeline,
} from "@/lib/studyCalendar";

const dayNum = (k: string) => {
  const [y, m, d] = k.split("-").map(Number);
  return Math.floor(Date.UTC(y, m - 1, d) / 86400000);
};
const fmtDay = (k?: string | null) =>
  k ? new Date(`${k}T00:00:00`).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" }) : "—";
const money = (n: number, currency = "EUR") => `${Math.round(n).toLocaleString("fr-FR")} ${currency}`;
const STATUS: Record<string, string> = { draft: "Brouillon", in_progress: "En cours", completed: "Terminée" };

export default function StudyCalendar() {
  const navigate = useNavigate();
  const { fetchProjectWithDetails, updateTaskStatus } = useProjectsDB();
  const [studies, setStudies] = useState<StudyRow[]>([]);
  const [projects, setProjects] = useState<Record<string, ProjectWithDetails>>({});
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>("all");

  const load = useCallback(async () => {
    const { data } = await supabase.from("market_studies").select("*").order("created_at", { ascending: false });
    const rows = (data as unknown as StudyRow[]) ?? [];
    setStudies(rows);
    const ids = [...new Set(rows.map((r) => r.project_id).filter(Boolean))] as string[];
    const detailed = await Promise.all(ids.map((id) => fetchProjectWithDetails(id)));
    const map: Record<string, ProjectWithDetails> = {};
    detailed.forEach((p, i) => { if (p) map[ids[i]] = p; });
    setProjects(map);
    setLoading(false);
  }, [fetchProjectWithDetails]);

  useEffect(() => { load(); }, [load]);

  const timelines = useMemo<StudyTimeline[]>(
    () =>
      studies.map((s) => {
        const proj = s.project_id ? projects[s.project_id] : null;
        const keys = proj ? [...dispatchTasks(proj, new Date()).keys()] : [];
        return buildTimeline(s, keys);
      }),
    [studies, projects],
  );

  const filtered = filter === "all" ? timelines : timelines.filter((t) => t.study.id === filter);
  const currency = filtered[0]?.cfg.currency ?? "EUR";

  const kpis = useMemo(() => {
    const budget = filtered.reduce((a, t) => a + t.budget, 0);
    const spent = filtered.reduce((a, t) => a + t.spent, 0);
    const pct = filtered.length ? Math.round(filtered.reduce((a, t) => a + t.pct, 0) / filtered.length) : 0;
    const ends = filtered.map((t) => t.end).filter(Boolean) as string[];
    const nexts = filtered.map((t) => t.nextDate).filter(Boolean) as string[];
    return {
      budget, spent, pct,
      remaining: budget - spent,
      hours: filtered.reduce((a, t) => a + t.hours, 0),
      pendingHours: filtered.reduce((a, t) => a + t.pendingHours, 0),
      lastEnd: ends.length ? ends.reduce((a, b) => (a > b ? a : b)) : null,
      next: nexts.length ? nexts.reduce((a, b) => (a < b ? a : b)) : null,
    };
  }, [filtered]);

  // One calendar holding every study's sections, or just the selected study.
  const calendarProject = useMemo(() => {
    if (filter !== "all") {
      const t = timelines.find((x) => x.study.id === filter);
      return t?.study.project_id ? projects[t.study.project_id] ?? null : null;
    }
    return mergeStudyProjects(
      timelines
        .filter((t) => t.study.project_id && projects[t.study.project_id!])
        .map((t) => ({ project: projects[t.study.project_id!] as ProjectWithDetails, studyTitle: t.study.title })),
    );
  }, [filter, timelines, projects]);

  // Clicking a section in the calendar opens that section of the study.
  const openTask = useCallback(
    async (taskId: string, current: string) => {
      for (const t of timelines) {
        const proj = t.study.project_id ? projects[t.study.project_id] : null;
        if (!proj) continue;
        for (const phase of proj.phases) {
          const task = phase.tasks.find((x) => x.id === taskId);
          if (!task) continue;
          const key = (task.tags ?? []).find((x) => x.startsWith("market-study:"))?.slice(13);
          if (key) navigate(`/market-study/${t.study.id}?section=${key}`);
          else if (task.status !== "done") {
            const next = current === "done" ? "todo" : "done";
            await updateTaskStatus(taskId, next);
            toast.success(next === "done" ? "Section terminée" : "Section à reprendre");
          }
          return;
        }
      }
    },
    [timelines, projects, navigate, updateTaskStatus],
  );

  const span = useMemo(() => {
    const keys = filtered.flatMap((t) => [t.start, t.end].filter(Boolean) as string[]);
    if (keys.length === 0) return null;
    const min = keys.reduce((a, b) => (a < b ? a : b));
    const max = keys.reduce((a, b) => (a > b ? a : b));
    return { min, max, days: Math.max(1, dayNum(max) - dayNum(min) + 1) };
  }, [filtered]);

  const ticks = useMemo(() => {
    if (!span) return [];
    const out: { label: string; left: number }[] = [];
    let cur = `${span.min.slice(0, 7)}-01`;
    let guard = 0;
    while (cur <= span.max && guard++ < 130) {
      if (cur > span.min) out.push({ label: new Date(`${cur}T00:00:00`).toLocaleDateString("fr-FR", { month: "short" }), left: ((dayNum(cur) - dayNum(span.min)) / span.days) * 100 });
      const [y, m] = cur.split("-").map(Number);
      cur = m === 12 ? `${y + 1}-01-01` : `${y}-${String(m + 1).padStart(2, "0")}-01`;
    }
    return out;
  }, [span]);

  const monthly = useMemo(() => {
    const planned = Array(12).fill(0);
    const spent = Array(12).fill(0);
    filtered.forEach((t) => {
      const m = studyMonthly(t.study);
      m.planned.forEach((v, i) => (planned[i] += v));
      m.spent.forEach((v, i) => (spent[i] += v));
    });
    const single = filter !== "all" ? new Date(filtered[0]?.study.created_at ?? Date.now()) : null;
    return planned.map((v, i) => ({
      name: single
        ? new Date(single.getFullYear(), single.getMonth() + i, 1).toLocaleDateString("fr-FR", { month: "short", year: "2-digit" })
        : `Mois ${i + 1}`,
      Budget: v,
      Engagé: spent[i],
    }));
  }, [filtered, filter]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="flex items-center justify-center pt-32"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="container pt-24 pb-16 space-y-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <Link to="/market-studies" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-2">
              <ArrowLeft className="w-4 h-4" /> Toutes les études
            </Link>
            <h1 className="text-3xl font-display font-black flex items-center gap-2">
              <CalendarRange className="w-7 h-7 text-primary" /> Calendrier des études
            </h1>
            <p className="text-muted-foreground mt-1 text-sm">
              {filtered.length} étude{filtered.length > 1 ? "s" : ""} de marché, avec leurs dates et leur budget.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Select value={filter} onValueChange={setFilter}>
              <SelectTrigger className="w-64"><SelectValue placeholder="Choisir une étude" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Toutes les études</SelectItem>
                {timelines.map((t) => <SelectItem key={t.study.id} value={t.study.id}>{t.study.title}</SelectItem>)}
              </SelectContent>
            </Select>
            <button onClick={() => load()} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium border border-border hover:border-primary/30 hover:text-primary transition-all">
              Actualiser
            </button>
          </div>
        </div>

        {filtered.length === 0 ? (
          <div className="text-center py-20">
            <Telescope className="w-16 h-16 text-muted-foreground/30 mx-auto mb-4" />
            <h2 className="text-xl font-semibold mb-2">Aucune étude de marché</h2>
            <p className="text-muted-foreground text-sm mb-4">Créez une étude pour la voir apparaître ici avec ses dates et son budget.</p>
            <Link to="/market-studies" className="inline-block px-4 py-2 rounded-xl gradient-bg text-primary-foreground font-medium text-sm">Lancer une étude</Link>
          </div>
        ) : (
          <>
            <div className="grid gap-4 md:grid-cols-4">
              <Card><CardHeader className="pb-2"><CardTitle className="text-sm flex gap-2"><CheckCircle2 className="h-4 w-4 text-primary" />Avancement</CardTitle></CardHeader>
                <CardContent><div className="text-3xl font-bold">{kpis.pct}%</div><Progress value={kpis.pct} className="mt-2" />
                  <p className="text-xs text-muted-foreground mt-2">{filtered.reduce((a, t) => a + t.sectionsWritten, 0)}/{filtered.reduce((a, t) => a + t.sectionsWanted, 0)} sections rédigées</p></CardContent></Card>
              <Card><CardHeader className="pb-2"><CardTitle className="text-sm flex gap-2"><Wallet className="h-4 w-4 text-primary" />Budget prévu</CardTitle></CardHeader>
                <CardContent><div className="text-2xl font-bold">{money(kpis.budget, currency)}</div>
                  <p className="text-xs text-muted-foreground mt-1">dont {money(kpis.spent, currency)} engagés · {kpis.hours} h d'analyse</p></CardContent></Card>
              <Card><CardHeader className="pb-2"><CardTitle className="text-sm flex gap-2"><DollarSign className="h-4 w-4 text-primary" />Reste à engager</CardTitle></CardHeader>
                <CardContent><div className="text-2xl font-bold">{money(kpis.remaining, currency)}</div>
                  <p className="text-xs text-muted-foreground mt-1">{kpis.pendingHours} h encore à réaliser</p></CardContent></Card>
              <Card><CardHeader className="pb-2"><CardTitle className="text-sm flex gap-2"><CalendarDays className="h-4 w-4 text-primary" />Échéances</CardTitle></CardHeader>
                <CardContent><div className="text-xl font-bold">{fmtDay(kpis.next)}</div>
                  <p className="text-xs text-muted-foreground mt-1">prochaine section · fin au {fmtDay(kpis.lastEnd)}</p></CardContent></Card>
            </div>

            {span && (
              <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Planning des études</CardTitle></CardHeader>
                <CardContent className="space-y-3">
                  <div className="relative h-4 text-[10px] text-muted-foreground">
                    {ticks.map((t) => <span key={t.label + t.left} className="absolute -translate-x-1/2 uppercase" style={{ left: `${t.left}%` }}>{t.label}</span>)}
                  </div>
                  {filtered.map((t) => {
                    const end = t.end ?? t.start;
                    const left = ((dayNum(t.start) - dayNum(span.min)) / span.days) * 100;
                    const width = Math.max(1.5, ((dayNum(end) - dayNum(t.start) + 1) / span.days) * 100);
                    return (
                      <div key={t.study.id} className="flex items-center gap-3">
                        <Link to={`/market-study/${t.study.id}`} className="w-56 shrink-0 truncate text-sm hover:text-primary">{t.study.title}</Link>
                        <div className="relative h-6 flex-1 rounded-md bg-muted/40 overflow-hidden">
                          <div className="absolute inset-y-1 rounded-md gradient-bg opacity-80" style={{ left: `${left}%`, width: `${width}%` }} title={`${fmtDay(t.start)} → ${fmtDay(end)}`} />
                          <div className="absolute inset-y-1 rounded-md bg-teal-600/60" style={{ left: `${left}%`, width: `${(width * t.pct) / 100}%` }} />
                        </div>
                        <span className="w-14 shrink-0 text-right text-xs text-muted-foreground">{t.pct}%</span>
                      </div>
                    );
                  })}
                </CardContent></Card>
            )}

            <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Études, dates et budgets</CardTitle></CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-xs text-muted-foreground border-b border-border">
                        <th className="py-2 pr-3 font-medium">Étude</th>
                        <th className="py-2 pr-3 font-medium">Secteur</th>
                        <th className="py-2 pr-3 font-medium">Début</th>
                        <th className="py-2 pr-3 font-medium">Fin prévue</th>
                        <th className="py-2 pr-3 font-medium">Avancement</th>
                        <th className="py-2 pr-3 font-medium text-right">Budget</th>
                        <th className="py-2 pr-3 font-medium text-right">Engagé</th>
                        <th className="py-2 font-medium"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {filtered.map((t) => (
                        <tr key={t.study.id} className="border-b border-border/50 hover:bg-muted/30">
                          <td className="py-2.5 pr-3">
                            <Link to={`/market-study/${t.study.id}`} className="font-medium hover:text-primary line-clamp-1">{t.study.title}</Link>
                            <div className="text-[11px] text-muted-foreground">{t.sectionsWritten}/{t.sectionsWanted} sections · {t.hours} h · <Badge variant="outline" className="text-[10px] px-1.5 py-0">{STATUS[t.study.status] ?? t.study.status}</Badge></div>
                          </td>
                          <td className="py-2.5 pr-3 text-muted-foreground text-xs">{t.cfg.sector || "—"}<br />{t.cfg.geography}</td>
                          <td className="py-2.5 pr-3 whitespace-nowrap">{fmtDay(t.start)}</td>
                          <td className="py-2.5 pr-3 whitespace-nowrap">{fmtDay(t.end)}</td>
                          <td className="py-2.5 pr-3 w-32"><Progress value={t.pct} /></td>
                          <td className="py-2.5 pr-3 text-right whitespace-nowrap">{money(t.budget, currency)}</td>
                          <td className="py-2.5 pr-3 text-right whitespace-nowrap text-muted-foreground">{money(t.spent, currency)}</td>
                          <td className="py-2.5 text-right whitespace-nowrap">
                            {t.study.project_id && (
                              <Link to={`/tracking?project=${t.study.project_id}`} className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-primary"><Activity className="w-3.5 h-3.5" /> Suivi</Link>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent></Card>

            {kpis.budget > 0 && (
              <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Budget par mois</CardTitle></CardHeader>
                <CardContent className="h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={monthly}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis dataKey="name" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                      <YAxis tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                      <Tooltip formatter={(v: any) => money(Number(v), currency)} contentStyle={{ background: "hsl(var(--background))", border: "1px solid hsl(var(--border))", borderRadius: 12 }} />
                      <Legend wrapperStyle={{ fontSize: 12 }} />
                      <Bar dataKey="Budget" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="Engagé" fill="hsl(152, 60%, 45%)" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent></Card>
            )}

            <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Calendrier des sections</CardTitle></CardHeader>
              <CardContent>
                {calendarProject ? (
                  <CalendarView project={calendarProject} onCycleStatus={openTask} />
                ) : (
                  <p className="text-sm text-muted-foreground py-8 text-center">
                    Cette étude n'est pas encore planifiée. Ouvrez-la pour créer son calendrier.
                  </p>
                )}
              </CardContent></Card>
          </>
        )}
      </div>
    </div>
  );
}
