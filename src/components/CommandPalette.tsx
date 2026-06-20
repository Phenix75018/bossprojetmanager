import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import {
  CommandDialog,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
} from "@/components/ui/command";
import {
  FolderKanban,
  ListChecks,
  FileText,
  LayoutGrid,
  DollarSign,
  CalendarDays,
  ShieldCheck,
  Plus,
  Link2,
} from "lucide-react";

type ItemType = "project" | "task" | "bp-section" | "bm-block" | "bp" | "bm" | "budget";

type Item = {
  id: string;
  type: ItemType;
  label: string;
  sub?: string;
  href: string;
  icon: any;
};

type Filter = "all" | ItemType | "bp-any" | "bm-any";

const FILTERS: { key: Filter; label: string }[] = [
  { key: "all", label: "Tout" },
  { key: "project", label: "Projets" },
  { key: "task", label: "Tâches" },
  { key: "bp-any", label: "BP" },
  { key: "bm-any", label: "BM" },
  { key: "budget", label: "Budget" },
];

const GROUP_ORDER: { key: ItemType; heading: string }[] = [
  { key: "project", heading: "Projets" },
  { key: "task", heading: "Tâches" },
  { key: "bp", heading: "Business Plans" },
  { key: "bp-section", heading: "Sections BP" },
  { key: "bm", heading: "Business Models" },
  { key: "bm-block", heading: "Blocs BM" },
  { key: "budget", heading: "Budgets" },
];

// --- Scoring ---
function normalize(s: string) {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function scoreItem(query: string, it: Item): number {
  if (!query) return 0;
  const q = normalize(query.trim());
  if (!q) return 0;
  const terms = q.split(/\s+/).filter(Boolean);
  const label = normalize(it.label);
  const sub = normalize(it.sub ?? "");
  let score = 0;
  for (const t of terms) {
    const inLabel = label.indexOf(t);
    const inSub = sub.indexOf(t);
    if (inLabel === -1 && inSub === -1) return -1; // every term must match somewhere
    if (inLabel === 0) score += 100;
    else if (inLabel > 0) {
      score += 60;
      // word-boundary bonus
      if (/[\s\-_/]/.test(label[inLabel - 1] ?? "")) score += 20;
    } else if (inSub >= 0) {
      score += 25;
    }
    // length proximity
    score += Math.max(0, 20 - Math.abs(label.length - t.length) / 4);
  }
  // type bonuses
  if (it.type === "project") score += 8;
  if (it.type === "task") score += 4;
  return score;
}

// --- Highlight ---
function Highlight({ text, query }: { text: string; query: string }) {
  if (!query.trim()) return <>{text}</>;
  const terms = Array.from(
    new Set(
      normalize(query)
        .split(/\s+/)
        .filter((t) => t.length > 0),
    ),
  ).sort((a, b) => b.length - a.length);
  if (terms.length === 0) return <>{text}</>;
  const norm = normalize(text);
  const marks: Array<[number, number]> = [];
  for (const t of terms) {
    let from = 0;
    while (true) {
      const idx = norm.indexOf(t, from);
      if (idx === -1) break;
      marks.push([idx, idx + t.length]);
      from = idx + t.length;
    }
  }
  if (marks.length === 0) return <>{text}</>;
  marks.sort((a, b) => a[0] - b[0]);
  const merged: Array<[number, number]> = [];
  for (const m of marks) {
    const last = merged[merged.length - 1];
    if (last && m[0] <= last[1]) last[1] = Math.max(last[1], m[1]);
    else merged.push([m[0], m[1]]);
  }
  const out: any[] = [];
  let cursor = 0;
  merged.forEach(([s, e], i) => {
    if (cursor < s) out.push(<span key={`p${i}`}>{text.slice(cursor, s)}</span>);
    out.push(
      <mark key={`m${i}`} className="bg-primary/20 text-foreground rounded-sm px-0.5">
        {text.slice(s, e)}
      </mark>,
    );
    cursor = e;
  });
  if (cursor < text.length) out.push(<span key="end">{text.slice(cursor)}</span>);
  return <>{out}</>;
}

export function CommandPalette() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState<Filter>("all");

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.key === "k" || e.key === "K") && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (!open || !user) return;
    if (items.length > 0) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const [projectsRes, bpsRes, bmsRes, budgetsRes, phasesRes] = await Promise.all([
          supabase.from("projects").select("id,title,description").order("updated_at", { ascending: false }),
          supabase.from("business_plans").select("id,title,project_id").order("updated_at", { ascending: false }),
          supabase.from("business_models").select("id,title,project_id").order("updated_at", { ascending: false }),
          supabase.from("budgets").select("id,title,project_id").order("updated_at", { ascending: false }),
          supabase.from("phases").select("id,name,project_id"),
        ]);

        const projects = projectsRes.data || [];
        const bps = bpsRes.data || [];
        const bms = bmsRes.data || [];
        const budgets = budgetsRes.data || [];
        const phases = phasesRes.data || [];
        const phaseIds = phases.map((p: any) => p.id);

        const [tasksRes, sectionsRes, blocksRes] = await Promise.all([
          phaseIds.length
            ? supabase.from("tasks").select("id,title,description,phase_id").in("phase_id", phaseIds)
            : Promise.resolve({ data: [] as any[] }),
          bps.length
            ? supabase
                .from("business_plan_sections")
                .select("id,title,section_type,business_plan_id")
                .in("business_plan_id", bps.map((b: any) => b.id))
            : Promise.resolve({ data: [] as any[] }),
          bms.length
            ? supabase
                .from("business_model_blocks")
                .select("id,title,block_type,business_model_id")
                .in("business_model_id", bms.map((b: any) => b.id))
            : Promise.resolve({ data: [] as any[] }),
        ]);

        const tasks = (tasksRes as any).data || [];
        const sections = (sectionsRes as any).data || [];
        const blocks = (blocksRes as any).data || [];

        const phaseToProject = new Map(phases.map((p: any) => [p.id, p.project_id]));
        const projectById = new Map(projects.map((p: any) => [p.id, p]));

        const all: Item[] = [];
        for (const p of projects)
          all.push({ id: `project-${p.id}`, type: "project", label: p.title, sub: "Projet", href: `/plan/${p.id}`, icon: FolderKanban });
        for (const bp of bps) {
          const proj = projectById.get(bp.project_id) as any;
          all.push({ id: `bp-${bp.id}`, type: "bp", label: bp.title || "Business Plan", sub: proj ? `BP · ${proj.title}` : "Business Plan", href: `/business-plan/${bp.id}`, icon: FileText });
        }
        for (const bm of bms) {
          const proj = projectById.get(bm.project_id) as any;
          all.push({ id: `bm-${bm.id}`, type: "bm", label: bm.title || "Business Model", sub: proj ? `BM · ${proj.title}` : "Business Model", href: `/business-model/${bm.id}`, icon: LayoutGrid });
        }
        for (const bg of budgets) {
          const proj = projectById.get(bg.project_id) as any;
          all.push({ id: `budget-${bg.id}`, type: "budget", label: bg.title || "Budget", sub: proj ? `Budget · ${proj.title}` : "Budget", href: `/budget/${bg.id}`, icon: DollarSign });
        }
        for (const t of tasks) {
          const projectId = phaseToProject.get(t.phase_id);
          const proj = projectId ? (projectById.get(projectId) as any) : null;
          all.push({ id: `task-${t.id}`, type: "task", label: t.title, sub: proj ? `Tâche · ${proj.title}` : "Tâche", href: projectId ? `/plan/${projectId}?task=${t.id}` : "/dashboard", icon: ListChecks });
        }
        for (const s of sections)
          all.push({ id: `bps-${s.id}`, type: "bp-section", label: s.title || s.section_type, sub: "Section BP", href: `/business-plan/${s.business_plan_id}#section-${s.id}`, icon: FileText });
        for (const b of blocks)
          all.push({ id: `bmb-${b.id}`, type: "bm-block", label: b.title || b.block_type, sub: "Bloc BM", href: `/business-model/${b.business_model_id}#block-${b.id}`, icon: LayoutGrid });

        if (!cancelled) setItems(all);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, user, items.length]);

  const matchesFilter = (it: Item): boolean => {
    if (filter === "all") return true;
    if (filter === "bp-any") return it.type === "bp" || it.type === "bp-section";
    if (filter === "bm-any") return it.type === "bm" || it.type === "bm-block";
    return it.type === filter;
  };

  const ranked = useMemo(() => {
    const q = query.trim();
    const filtered = items.filter(matchesFilter);
    if (!q) return filtered;
    const scored = filtered
      .map((it) => ({ it, score: scoreItem(q, it) }))
      .filter((x) => x.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 80)
      .map((x) => x.it);
    return scored;
  }, [items, query, filter]);

  const grouped = useMemo(() => {
    const g: Record<ItemType, Item[]> = {
      project: [], task: [], bp: [], "bp-section": [], bm: [], "bm-block": [], budget: [],
    };
    for (const it of ranked) g[it.type].push(it);
    return g;
  }, [ranked]);

  const go = (href: string) => {
    setOpen(false);
    setQuery("");
    navigate(href);
  };

  const quickActions = [
    { id: "qa-new", label: "Nouveau projet", sub: "Créer", href: "/onboarding", icon: Plus },
    { id: "qa-dash", label: "Tableau de bord", sub: "Aller à", href: "/dashboard", icon: FolderKanban },
    { id: "qa-cal", label: "Calendrier", sub: "Aller à", href: "/calendar", icon: CalendarDays },
    { id: "qa-coh", label: "Cohérence stratégique", sub: "Aller à", href: "/coherence", icon: ShieldCheck },
    { id: "qa-int", label: "Intégrations", sub: "Aller à", href: "/integrations", icon: Link2 },
  ];

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput
        placeholder="Rechercher projets, tâches, sections…  (Ctrl/Cmd + K)"
        value={query}
        onValueChange={setQuery}
      />
      <div className="flex flex-wrap gap-1 border-b px-3 py-2">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            type="button"
            onClick={() => setFilter(f.key)}
            className={
              "rounded-full px-2.5 py-0.5 text-xs transition-colors " +
              (filter === f.key
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground hover:bg-muted/70")
            }
          >
            {f.label}
          </button>
        ))}
      </div>
      <CommandList shouldFilter={false as any}>
        <CommandEmpty>{loading ? "Chargement…" : "Aucun résultat."}</CommandEmpty>

        {filter === "all" && !query.trim() && (
          <CommandGroup heading="Actions rapides">
            {quickActions.map((a) => (
              <CommandItem key={a.id} value={a.id} onSelect={() => go(a.href)}>
                <a.icon className="mr-2 h-4 w-4 text-muted-foreground" />
                <span>{a.label}</span>
                <span className="ml-auto text-xs text-muted-foreground">{a.sub}</span>
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        {query.trim() ? (
          ranked.length > 0 && (
            <CommandGroup heading={`Résultats (${ranked.length})`}>
              {ranked.map((it) => (
                <CommandItem key={it.id} value={it.id} onSelect={() => go(it.href)}>
                  <it.icon className="mr-2 h-4 w-4 text-muted-foreground" />
                  <span className="truncate">
                    <Highlight text={it.label} query={query} />
                  </span>
                  {it.sub && (
                    <span className="ml-auto text-xs text-muted-foreground truncate max-w-[40%]">
                      <Highlight text={it.sub} query={query} />
                    </span>
                  )}
                </CommandItem>
              ))}
            </CommandGroup>
          )
        ) : (
          GROUP_ORDER.map(({ key, heading }) =>
            grouped[key].length === 0 ? null : (
              <CommandGroup key={key} heading={heading}>
                {grouped[key].slice(0, 20).map((it) => (
                  <CommandItem key={it.id} value={it.id} onSelect={() => go(it.href)}>
                    <it.icon className="mr-2 h-4 w-4 text-muted-foreground" />
                    <span className="truncate">{it.label}</span>
                    {it.sub && (
                      <span className="ml-auto text-xs text-muted-foreground truncate max-w-[40%]">{it.sub}</span>
                    )}
                  </CommandItem>
                ))}
              </CommandGroup>
            ),
          )
        )}
      </CommandList>
    </CommandDialog>
  );
}
