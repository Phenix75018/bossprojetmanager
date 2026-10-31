import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Plus, Telescope, Trash2, Loader2 } from "lucide-react";
import Navbar from "@/components/layout/Navbar";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import { DEFAULT_CONFIG, completion, type MarketStudySection } from "@/lib/marketStudy";

interface Row { id: string; title: string; description: string; config: any; sections: any; created_at: string }

export default function MarketStudies() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [sector, setSector] = useState("");

  const load = async () => {
    const { data } = await supabase.from("market_studies").select("*").order("created_at", { ascending: false });
    setRows((data as Row[]) ?? []);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const create = async () => {
    if (!user || !title.trim()) return;
    const { data, error } = await supabase.from("market_studies")
      .insert({ user_id: user.id, title: title.trim(), description, config: { ...DEFAULT_CONFIG, sector } as any })
      .select("id").single();
    if (error) return toast.error("Création impossible");
    navigate(`/market-study/${data.id}`);
  };

  const remove = async (id: string) => {
    if (!confirm("Supprimer cette étude ?")) return;
    await supabase.from("market_studies").delete().eq("id", id);
    load();
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="container pt-24 pb-12">
        <div className="flex flex-wrap gap-4 items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-display font-black">Études de marché</h1>
            <p className="text-muted-foreground mt-1">Des études professionnelles et complètes, pour n'importe quel secteur.</p>
          </div>
          <Button onClick={() => setOpen(true)} className="gap-2 gradient-bg text-primary-foreground rounded-xl font-bold">
            <Plus className="w-4 h-4" /> Nouvelle étude
          </Button>
        </div>
        {loading ? (
          <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
        ) : rows.length === 0 ? (
          <div className="text-center py-20">
            <Telescope className="w-16 h-16 text-muted-foreground/30 mx-auto mb-4" />
            <h2 className="text-xl font-semibold mb-2">Aucune étude de marché</h2>
            <Button onClick={() => setOpen(true)} className="gradient-bg text-primary-foreground rounded-xl mt-4">Lancer ma première étude</Button>
          </div>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
            {rows.map((r) => {
              const pct = completion(r.config ?? {}, (r.sections ?? []) as MarketStudySection[]);
              return (
                <div key={r.id} className="glass-card-hover rounded-2xl overflow-hidden">
                  <Link to={`/market-study/${r.id}`} className="block p-6 space-y-3">
                    <div className="flex items-center gap-2">
                      <Telescope className="w-5 h-5 text-primary shrink-0" />
                      <h3 className="font-display font-bold line-clamp-2">{r.title}</h3>
                    </div>
                    <p className="text-sm text-muted-foreground line-clamp-2">{r.config?.sector || r.description || "Secteur non précisé"} · {r.config?.geography}</p>
                    <Progress value={pct} />
                    <p className="text-xs text-muted-foreground">{pct}% rédigé · {new Date(r.created_at).toLocaleDateString("fr-FR")}</p>
                  </Link>
                  <div className="border-t border-border px-6 py-3 flex justify-end">
                    <button aria-label="Supprimer" onClick={() => remove(r.id)} className="text-muted-foreground hover:text-destructive p-1"><Trash2 className="w-4 h-4" /></button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader><DialogTitle>Nouvelle étude de marché</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div><Label>Titre *</Label><Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ex : Marché des cosmétiques bio en France" /></div>
              <div><Label>Secteur / domaine</Label><Input value={sector} onChange={(e) => setSector(e.target.value)} placeholder="Ex : cosmétique, SaaS RH, restauration…" /></div>
              <div><Label>Produit ou projet étudié</Label><Textarea rows={4} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Décrivez l'offre, la cible, ce que vous voulez savoir…" /></div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>Annuler</Button>
              <Button onClick={create} disabled={!title.trim()} className="gradient-bg text-primary-foreground">Créer et configurer</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
