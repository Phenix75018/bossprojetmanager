import { useEffect, useMemo, useState } from "react";
import {
  Layers,
  Plus,
  Trash2,
  Check,
  Loader2,
  Pencil,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  BusinessAssumptions,
  EMPTY_ASSUMPTIONS,
} from "@/lib/businessAssumptions";
import { validateAssumptions } from "@/lib/validateAssumptions";

type ScenarioMap = Record<string, BusinessAssumptions & { label?: string }>;

interface Props {
  projectId: string | null | undefined;
  onScenarioChanged?: (id: string) => void;
  className?: string;
}

const DEFAULT_LABELS: Record<string, string> = {
  base: "Base",
  bull: "Bull (optimiste)",
  bear: "Bear (pessimiste)",
};

const TEMPLATES: Record<string, Partial<BusinessAssumptions>> = {
  base: {},
  bull: { growth_rate_pct: 120, market_share_target_pct: 8 },
  bear: { growth_rate_pct: 15, market_share_target_pct: 1 },
};

export default function ScenarioSwitcher({
  projectId,
  onScenarioChanged,
  className,
}: Props) {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [scenarios, setScenarios] = useState<ScenarioMap>({});
  const [active, setActive] = useState<string>("base");
  const [manageOpen, setManageOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<BusinessAssumptions & { label?: string }>(
    EMPTY_ASSUMPTIONS,
  );
  const [newId, setNewId] = useState("");
  const [newLabel, setNewLabel] = useState("");

  const load = async () => {
    if (!projectId) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("projects")
      .select("business_assumptions, assumption_scenarios, active_scenario")
      .eq("id", projectId)
      .maybeSingle();
    setLoading(false);
    if (error) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const row = data as any;
    let map: ScenarioMap = (row?.assumption_scenarios ?? {}) as ScenarioMap;
    const current = (row?.business_assumptions ?? {}) as BusinessAssumptions;
    if (!map || Object.keys(map).length === 0) {
      map = { base: { ...EMPTY_ASSUMPTIONS, ...current, label: "Base" } };
    }
    setScenarios(map);
    setActive(row?.active_scenario || "base");
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  const list = useMemo(
    () =>
      Object.entries(scenarios).map(([id, v]) => ({
        id,
        label: v.label || DEFAULT_LABELS[id] || id,
      })),
    [scenarios],
  );

  const persist = async (
    next: ScenarioMap,
    nextActive: string,
    syncActive = true,
  ) => {
    if (!projectId) return;
    setSaving(true);
    const activeAssumptions = next[nextActive] || EMPTY_ASSUMPTIONS;
    const { label: _l, ...cleanAssumptions } = activeAssumptions;
    const patch: Record<string, unknown> = {
      assumption_scenarios: next as never,
      active_scenario: nextActive,
    };
    if (syncActive) patch.business_assumptions = cleanAssumptions as never;
    const { error } = await supabase
      .from("projects")
      .update(patch)
      .eq("id", projectId);
    setSaving(false);
    if (error) {
      toast.error("Impossible d'enregistrer le scénario");
      return false;
    }
    return true;
  };

  const switchTo = async (id: string) => {
    if (id === active) return;
    const scenario = scenarios[id];
    const validation = validateAssumptions(scenario);
    if (!validation.ok) {
      toast.error(
        `Scénario « ${scenario.label || id} » invalide — corrigez-le d'abord.`,
      );
      return;
    }
    const ok = await persist(scenarios, id, true);
    if (!ok) return;
    setActive(id);
    toast.success(`Scénario actif : ${scenario.label || DEFAULT_LABELS[id] || id}`);
    onScenarioChanged?.(id);
  };

  const openCreate = () => {
    setEditingId("__new__");
    setNewId("");
    setNewLabel("");
    setDraft({ ...EMPTY_ASSUMPTIONS });
  };

  const openEdit = (id: string) => {
    setEditingId(id);
    setDraft({ ...EMPTY_ASSUMPTIONS, ...scenarios[id] });
  };

  const cancelEdit = () => {
    setEditingId(null);
  };

  const saveEdit = async () => {
    let id = editingId;
    if (id === "__new__") {
      const slug =
        (newId || newLabel || "scenario")
          .toLowerCase()
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "")
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/(^-|-$)/g, "") || "scenario";
      if (scenarios[slug]) {
        toast.error("Un scénario avec cet identifiant existe déjà.");
        return;
      }
      id = slug;
      // apply template if id matches a template name
      const tmpl = TEMPLATES[slug];
      if (tmpl) Object.assign(draft, tmpl);
      draft.label = newLabel || DEFAULT_LABELS[slug] || slug;
    }
    if (!id) return;
    const validation = validateAssumptions(draft);
    if (!validation.ok) {
      toast.error(validation.errors[0]?.message || "Hypothèses invalides");
      return;
    }
    const next = { ...scenarios, [id]: draft };
    const ok = await persist(next, active, active === id);
    if (!ok) return;
    setScenarios(next);
    toast.success("Scénario enregistré");
    setEditingId(null);
  };

  const removeScenario = async (id: string) => {
    if (Object.keys(scenarios).length <= 1) {
      toast.error("Impossible de supprimer le dernier scénario.");
      return;
    }
    const next = { ...scenarios };
    delete next[id];
    const nextActive = id === active ? Object.keys(next)[0] : active;
    const ok = await persist(next, nextActive, id === active);
    if (!ok) return;
    setScenarios(next);
    setActive(nextActive);
    toast.success("Scénario supprimé");
  };

  const activeLabel =
    scenarios[active]?.label || DEFAULT_LABELS[active] || active;

  return (
    <div className={className}>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" disabled={!projectId || loading}>
            <Layers className="w-4 h-4 mr-2" />
            Scénario : {activeLabel}
            {saving && <Loader2 className="w-3 h-3 ml-2 animate-spin" />}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-64">
          <DropdownMenuLabel>Basculer entre scénarios</DropdownMenuLabel>
          {list.map((s) => (
            <DropdownMenuItem
              key={s.id}
              onClick={() => switchTo(s.id)}
              className="flex items-center justify-between"
            >
              <span>{s.label}</span>
              {s.id === active && <Check className="w-4 h-4 text-emerald-500" />}
            </DropdownMenuItem>
          ))}
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={(e) => { e.preventDefault(); setManageOpen(true); }}>
            <Pencil className="w-4 h-4 mr-2" /> Gérer les scénarios
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={manageOpen} onOpenChange={setManageOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Scénarios d'hypothèses</DialogTitle>
            <DialogDescription>
              Créez plusieurs jeux d'hypothèses (Base, Bull, Bear…) et basculez
              entre eux. Le scénario actif est utilisé pour toutes les
              générations IA (Business Plan, Business Model, Budget, Plan).
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2">
            {list.map((s) => (
              <div
                key={s.id}
                className={`rounded-md border p-3 ${
                  s.id === active ? "border-emerald-500/50 bg-emerald-500/5" : ""
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <div className="font-medium">
                      {s.label}
                      {s.id === active && (
                        <span className="ml-2 text-xs text-emerald-600 dark:text-emerald-400">
                          (actif)
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      id : {s.id}
                    </div>
                  </div>
                  <div className="flex gap-1">
                    {s.id !== active && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => switchTo(s.id)}
                      >
                        Activer
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => openEdit(s.id)}
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => removeScenario(s.id)}
                      disabled={list.length <= 1}
                    >
                      <Trash2 className="w-3.5 h-3.5 text-destructive" />
                    </Button>
                  </div>
                </div>

                {editingId === s.id && (
                  <ScenarioEditor
                    draft={draft}
                    setDraft={setDraft}
                    onCancel={cancelEdit}
                    onSave={saveEdit}
                    saving={saving}
                  />
                )}
              </div>
            ))}

            {editingId === "__new__" ? (
              <div className="rounded-md border border-dashed p-3 space-y-2">
                <div className="grid grid-cols-2 gap-2">
                  <div className="grid gap-1">
                    <Label htmlFor="sc-new-id">Identifiant</Label>
                    <Input
                      id="sc-new-id"
                      placeholder="bull, bear, upside…"
                      value={newId}
                      onChange={(e) => setNewId(e.target.value)}
                    />
                  </div>
                  <div className="grid gap-1">
                    <Label htmlFor="sc-new-label">Libellé</Label>
                    <Input
                      id="sc-new-label"
                      placeholder="Bull (optimiste)"
                      value={newLabel}
                      onChange={(e) => setNewLabel(e.target.value)}
                    />
                  </div>
                </div>
                <ScenarioEditor
                  draft={draft}
                  setDraft={setDraft}
                  onCancel={cancelEdit}
                  onSave={saveEdit}
                  saving={saving}
                />
              </div>
            ) : (
              <div className="flex flex-wrap gap-2 pt-2">
                <Button size="sm" variant="outline" onClick={openCreate}>
                  <Plus className="w-4 h-4 mr-2" /> Nouveau scénario
                </Button>
                {(["bull", "bear"] as const)
                  .filter((k) => !scenarios[k])
                  .map((k) => (
                    <Button
                      key={k}
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        setEditingId("__new__");
                        setNewId(k);
                        setNewLabel(DEFAULT_LABELS[k]);
                        setDraft({
                          ...EMPTY_ASSUMPTIONS,
                          ...(scenarios[active] || {}),
                          ...TEMPLATES[k],
                          label: DEFAULT_LABELS[k],
                        });
                      }}
                    >
                      <Plus className="w-3.5 h-3.5 mr-1" /> {DEFAULT_LABELS[k]}
                    </Button>
                  ))}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setManageOpen(false)}>
              Fermer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ScenarioEditor({
  draft,
  setDraft,
  onCancel,
  onSave,
  saving,
}: {
  draft: BusinessAssumptions & { label?: string };
  setDraft: (v: BusinessAssumptions & { label?: string }) => void;
  onCancel: () => void;
  onSave: () => void;
  saving: boolean;
}) {
  const update = <K extends keyof (BusinessAssumptions & { label?: string })>(
    key: K,
    value: (BusinessAssumptions & { label?: string })[K],
  ) => setDraft({ ...draft, [key]: value });

  return (
    <div className="mt-3 grid gap-3">
      <div className="grid gap-1">
        <Label>Libellé</Label>
        <Input
          value={draft.label ?? ""}
          onChange={(e) => update("label", e.target.value)}
        />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div className="grid gap-1">
          <Label>Secteur</Label>
          <Input
            value={draft.sector ?? ""}
            onChange={(e) => update("sector", e.target.value)}
          />
        </div>
        <div className="grid gap-1">
          <Label>Géographie</Label>
          <Input
            value={draft.geography ?? ""}
            onChange={(e) => update("geography", e.target.value)}
          />
        </div>
      </div>
      <div className="grid gap-1">
        <Label>Pricing</Label>
        <Textarea
          rows={2}
          value={draft.pricing ?? ""}
          onChange={(e) => update("pricing", e.target.value)}
        />
      </div>
      <div className="grid gap-1">
        <Label>Coûts</Label>
        <Textarea
          rows={2}
          value={draft.costs ?? ""}
          onChange={(e) => update("costs", e.target.value)}
        />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div className="grid gap-1">
          <Label>Croissance annuelle (%)</Label>
          <Input
            type="number"
            value={draft.growth_rate_pct ?? ""}
            onChange={(e) =>
              update(
                "growth_rate_pct",
                e.target.value === "" ? null : Number(e.target.value),
              )
            }
          />
        </div>
        <div className="grid gap-1">
          <Label>Part de marché cible (%)</Label>
          <Input
            type="number"
            value={draft.market_share_target_pct ?? ""}
            onChange={(e) =>
              update(
                "market_share_target_pct",
                e.target.value === "" ? null : Number(e.target.value),
              )
            }
          />
        </div>
      </div>
      <div className="flex gap-2 justify-end pt-1">
        <Button size="sm" variant="ghost" onClick={onCancel}>
          <X className="w-4 h-4 mr-1" /> Annuler
        </Button>
        <Button size="sm" onClick={onSave} disabled={saving}>
          {saving ? (
            <Loader2 className="w-4 h-4 mr-1 animate-spin" />
          ) : (
            <Check className="w-4 h-4 mr-1" />
          )}
          Enregistrer
        </Button>
      </div>
    </div>
  );
}
