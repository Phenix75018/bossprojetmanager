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

type Item = {
  id: string;
  type: "project" | "task" | "bp-section" | "bm-block" | "bp" | "bm" | "budget";
  label: string;
  sub?: string;
  href: string;
  icon: any;
};

export function CommandPalette() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(false);

  // Cmd+K / Ctrl+K toggle
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

  // Load index when opened
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
                .in(
                  "business_plan_id",
                  bps.map((b: any) => b.id),
                )
            : Promise.resolve({ data: [] as any[] }),
          bms.length
            ? supabase
                .from("business_model_blocks")
                .select("id,title,block_type,business_model_id")
                .in(
                  "business_model_id",
                  bms.map((b: any) => b.id),
                )
            : Promise.resolve({ data: [] as any[] }),
        ]);

        const tasks = (tasksRes as any).data || [];
        const sections = (sectionsRes as any).data || [];
        const blocks = (blocksRes as any).data || [];

        const phaseToProject = new Map(phases.map((p: any) => [p.id, p.project_id]));
        const projectById = new Map(projects.map((p: any) => [p.id, p]));

        const all: Item[] = [];

        for (const p of projects) {
          all.push({
            id: `project-${p.id}`,
            type: "project",
            label: p.title,
            sub: "Projet",
            href: `/plan/${p.id}`,
            icon: FolderKanban,
          });
        }
        for (const bp of bps) {
          const proj = projectById.get(bp.project_id) as any;
          all.push({
            id: `bp-${bp.id}`,
            type: "bp",
            label: bp.title || "Business Plan",
            sub: proj ? `BP · ${proj.title}` : "Business Plan",
            href: `/business-plan/${bp.id}`,
            icon: FileText,
          });
        }
        for (const bm of bms) {
          const proj = projectById.get(bm.project_id) as any;
          all.push({
            id: `bm-${bm.id}`,
            type: "bm",
            label: bm.title || "Business Model",
            sub: proj ? `BM · ${proj.title}` : "Business Model",
            href: `/business-model/${bm.id}`,
            icon: LayoutGrid,
          });
        }
        for (const bg of budgets) {
          const proj = projectById.get(bg.project_id) as any;
          all.push({
            id: `budget-${bg.id}`,
            type: "budget",
            label: bg.title || "Budget",
            sub: proj ? `Budget · ${proj.title}` : "Budget",
            href: `/budget/${bg.id}`,
            icon: DollarSign,
          });
        }
        for (const t of tasks) {
          const projectId = phaseToProject.get(t.phase_id);
          const proj = projectId ? (projectById.get(projectId) as any) : null;
          all.push({
            id: `task-${t.id}`,
            type: "task",
            label: t.title,
            sub: proj ? `Tâche · ${proj.title}` : "Tâche",
            href: projectId ? `/plan/${projectId}?task=${t.id}` : "/dashboard",
            icon: ListChecks,
          });
        }
        for (const s of sections) {
          all.push({
            id: `bps-${s.id}`,
            type: "bp-section",
            label: s.title || s.section_type,
            sub: `Section BP`,
            href: `/business-plan/${s.business_plan_id}#section-${s.id}`,
            icon: FileText,
          });
        }
        for (const b of blocks) {
          all.push({
            id: `bmb-${b.id}`,
            type: "bm-block",
            label: b.title || b.block_type,
            sub: `Bloc BM`,
            href: `/business-model/${b.business_model_id}#block-${b.id}`,
            icon: LayoutGrid,
          });
        }

        if (!cancelled) setItems(all);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, user, items.length]);

  const grouped = useMemo(() => {
    const g: Record<string, Item[]> = {
      Projets: [],
      Tâches: [],
      "Business Plans": [],
      "Sections BP": [],
      "Business Models": [],
      "Blocs BM": [],
      Budgets: [],
    };
    for (const it of items) {
      if (it.type === "project") g.Projets.push(it);
      else if (it.type === "task") g.Tâches.push(it);
      else if (it.type === "bp") g["Business Plans"].push(it);
      else if (it.type === "bp-section") g["Sections BP"].push(it);
      else if (it.type === "bm") g["Business Models"].push(it);
      else if (it.type === "bm-block") g["Blocs BM"].push(it);
      else if (it.type === "budget") g.Budgets.push(it);
    }
    return g;
  }, [items]);

  const go = (href: string) => {
    setOpen(false);
    setQuery("");
    navigate(href);
  };

  const quickActions: Item[] = [
    { id: "qa-new", type: "project", label: "Nouveau projet", sub: "Créer", href: "/onboarding", icon: Plus },
    { id: "qa-dash", type: "project", label: "Tableau de bord", sub: "Aller à", href: "/dashboard", icon: FolderKanban },
    { id: "qa-cal", type: "project", label: "Calendrier", sub: "Aller à", href: "/calendar", icon: CalendarDays },
    { id: "qa-coh", type: "project", label: "Cohérence stratégique", sub: "Aller à", href: "/coherence", icon: ShieldCheck },
    { id: "qa-int", type: "project", label: "Intégrations", sub: "Aller à", href: "/integrations", icon: Link2 },
  ];

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput
        placeholder="Rechercher projets, tâches, sections…  (Ctrl/Cmd + K)"
        value={query}
        onValueChange={setQuery}
      />
      <CommandList>
        <CommandEmpty>{loading ? "Chargement…" : "Aucun résultat."}</CommandEmpty>

        <CommandGroup heading="Actions rapides">
          {quickActions.map((a) => (
            <CommandItem key={a.id} value={`${a.label} ${a.sub}`} onSelect={() => go(a.href)}>
              <a.icon className="mr-2 h-4 w-4 text-muted-foreground" />
              <span>{a.label}</span>
              <span className="ml-auto text-xs text-muted-foreground">{a.sub}</span>
            </CommandItem>
          ))}
        </CommandGroup>

        {Object.entries(grouped).map(([heading, list]) =>
          list.length === 0 ? null : (
            <CommandGroup key={heading} heading={heading}>
              {list.map((it) => (
                <CommandItem
                  key={it.id}
                  value={`${it.label} ${it.sub ?? ""} ${heading}`}
                  onSelect={() => go(it.href)}
                >
                  <it.icon className="mr-2 h-4 w-4 text-muted-foreground" />
                  <span className="truncate">{it.label}</span>
                  {it.sub && (
                    <span className="ml-auto text-xs text-muted-foreground truncate max-w-[40%]">{it.sub}</span>
                  )}
                </CommandItem>
              ))}
            </CommandGroup>
          ),
        )}
      </CommandList>
    </CommandDialog>
  );
}
