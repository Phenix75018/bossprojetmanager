import { useEffect, useMemo, useState } from "react";
import { Settings2, Loader2, Save, AlertCircle, AlertTriangle } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  BusinessAssumptions,
  EMPTY_ASSUMPTIONS,
  hasAnyAssumption,
} from "@/lib/businessAssumptions";
import { validateAssumptions } from "@/lib/validateAssumptions";

interface Props {
  projectId: string | null | undefined;
  variant?: "default" | "ghost" | "outline" | "secondary";
  size?: "sm" | "default" | "lg" | "icon";
  className?: string;
  onSaved?: (a: BusinessAssumptions) => void;
}

export default function BusinessAssumptionsPanel({
  projectId,
  variant = "outline",
  size = "sm",
  className,
  onSaved,
}: Props) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [data, setData] = useState<BusinessAssumptions>(EMPTY_ASSUMPTIONS);
  const [hasValues, setHasValues] = useState(false);

  const load = async () => {
    if (!projectId) return;
    setLoading(true);
    const { data: row, error } = await supabase
      .from("projects")
      .select("business_assumptions")
      .eq("id", projectId)
      .maybeSingle();
    setLoading(false);
    if (error) {
      toast.error("Impossible de charger les paramètres");
      return;
    }
    const a = (row?.business_assumptions ?? {}) as BusinessAssumptions;
    const merged = { ...EMPTY_ASSUMPTIONS, ...a };
    setData(merged);
    setHasValues(hasAnyAssumption(merged));
  };

  useEffect(() => {
    if (projectId) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  useEffect(() => {
    if (open && projectId) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const update = <K extends keyof BusinessAssumptions>(
    key: K,
    value: BusinessAssumptions[K],
  ) => setData((prev) => ({ ...prev, [key]: value }));

  const validation = useMemo(() => validateAssumptions(data), [data]);
  const fieldErr = (k: keyof BusinessAssumptions) =>
    validation.errors.find((e) => e.field === k)?.message;
  const fieldWarn = (k: keyof BusinessAssumptions) =>
    validation.warnings.find((w) => w.field === k)?.message;

  const save = async () => {
    if (!projectId) return;
    if (!validation.ok) {
      toast.error("Corrigez les erreurs avant d'enregistrer");
      return;
    }
    setSaving(true);
    const cleaned: BusinessAssumptions = {
      ...data,
      growth_rate_pct:
        data.growth_rate_pct === null || data.growth_rate_pct === undefined
          ? null
          : Number(data.growth_rate_pct),
      market_share_target_pct:
        data.market_share_target_pct === null ||
        data.market_share_target_pct === undefined
          ? null
          : Number(data.market_share_target_pct),
    };
    const { error } = await supabase
      .from("projects")
      .update({ business_assumptions: cleaned as never })
      .eq("id", projectId);
    setSaving(false);
    if (error) {
      toast.error("Erreur lors de l'enregistrement");
      return;
    }
    setHasValues(hasAnyAssumption(cleaned));
    toast.success("Paramètres business enregistrés");
    onSaved?.(cleaned);
    setOpen(false);
  };

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant={variant} size={size} className={className} disabled={!projectId}>
          <Settings2 className="w-4 h-4 mr-2" />
          Paramètres business
          {hasValues && (
            <span className="ml-2 inline-block w-2 h-2 rounded-full bg-emerald-500" />
          )}
        </Button>
      </SheetTrigger>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Paramètres business</SheetTitle>
          <SheetDescription>
            Ces paramètres affinent les estimations de l'IA pour le Business
            Plan, le Business Model, le Budget et le Plan d'action.
          </SheetDescription>
        </SheetHeader>

        {loading ? (
          <div className="flex items-center justify-center py-10">
            <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="grid gap-4 py-6">
            <div className="grid gap-2">
              <Label htmlFor="ba-sector">Secteur d'activité</Label>
              <Input
                id="ba-sector"
                placeholder="Ex: SaaS B2B, restauration, e-commerce mode…"
                value={data.sector ?? ""}
                onChange={(e) => update("sector", e.target.value)}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-2">
                <Label htmlFor="ba-geo">Géographie</Label>
                <Input
                  id="ba-geo"
                  placeholder="France, DACH, Europe…"
                  value={data.geography ?? ""}
                  onChange={(e) => update("geography", e.target.value)}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="ba-currency">Devise</Label>
                <Input
                  id="ba-currency"
                  placeholder="EUR"
                  value={data.currency ?? ""}
                  onChange={(e) => update("currency", e.target.value)}
                />
              </div>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="ba-market-size">Taille de marché visée</Label>
              <Input
                id="ba-market-size"
                placeholder="Ex: TAM 5 Md€, SAM 800 M€, SOM 40 M€"
                value={data.target_market_size ?? ""}
                onChange={(e) => update("target_market_size", e.target.value)}
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="ba-pricing">Pricing</Label>
              <Textarea
                id="ba-pricing"
                rows={3}
                placeholder="Ex: Freemium + 29€/mois Pro + 99€/mois Business, setup fee 500€"
                value={data.pricing ?? ""}
                onChange={(e) => update("pricing", e.target.value)}
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="ba-costs">Structure de coûts</Label>
              <Textarea
                id="ba-costs"
                rows={3}
                placeholder="Ex: 2 salariés à 50k€/an chargés, hébergement 800€/mois, marketing 20% du CA"
                value={data.costs ?? ""}
                onChange={(e) => update("costs", e.target.value)}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-2">
                <Label htmlFor="ba-growth">Croissance annuelle cible (%)</Label>
                <Input
                  id="ba-growth"
                  type="number"
                  inputMode="decimal"
                  placeholder="Ex: 80"
                  value={data.growth_rate_pct ?? ""}
                  onChange={(e) =>
                    update(
                      "growth_rate_pct",
                      e.target.value === "" ? null : Number(e.target.value),
                    )
                  }
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="ba-share">Part de marché cible (%)</Label>
                <Input
                  id="ba-share"
                  type="number"
                  inputMode="decimal"
                  placeholder="Ex: 3"
                  value={data.market_share_target_pct ?? ""}
                  onChange={(e) =>
                    update(
                      "market_share_target_pct",
                      e.target.value === "" ? null : Number(e.target.value),
                    )
                  }
                />
              </div>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="ba-notes">Notes / contraintes</Label>
              <Textarea
                id="ba-notes"
                rows={2}
                placeholder="Ex: contrainte réglementaire RGPD, levée de 500k€ prévue en M9…"
                value={data.notes ?? ""}
                onChange={(e) => update("notes", e.target.value)}
              />
            </div>
          </div>
        )}

        <SheetFooter>
          <Button variant="ghost" onClick={() => setOpen(false)} disabled={saving}>
            Annuler
          </Button>
          <Button onClick={save} disabled={saving || loading || !projectId}>
            {saving ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Save className="w-4 h-4 mr-2" />
            )}
            Enregistrer
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
