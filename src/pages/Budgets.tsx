import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Plus, Trash2, Loader2, ArrowLeft, DollarSign, Link2 } from "lucide-react";
import Navbar from "@/components/layout/Navbar";
import { useBudgets } from "@/hooks/useBudgets";
import { useProjectsDB } from "@/hooks/useProjectsDB";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";

export default function Budgets() {
  const { budgets, loading, deleteBudget, createBudget } = useBudgets();
  const { projects } = useProjectsDB();
  const navigate = useNavigate();
  const [showCreate, setShowCreate] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [projectId, setProjectId] = useState<string>("");
  const [horizon, setHorizon] = useState("12");
  const [creating, setCreating] = useState(false);

  const handleCreate = async () => {
    if (!title.trim()) return;
    setCreating(true);
    const id = await createBudget(title, description, parseInt(horizon), projectId || undefined);
    setCreating(false);
    if (id) {
      setShowCreate(false);
      setTitle("");
      setDescription("");
      setProjectId("");
      setHorizon("12");
      navigate(`/budget/${id}`);
    }
  };

  const statusLabel: Record<string, string> = {
    draft: "Brouillon",
    in_progress: "En cours",
    completed: "Terminé",
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="container pt-24 pb-12">
        <div className="flex items-center justify-between mb-8">
          <div>
            <Link to="/dashboard" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-2">
              <ArrowLeft className="w-4 h-4" />
              Retour au dashboard
            </Link>
            <h1 className="text-3xl font-display font-black">Budgets Prévisionnels</h1>
            <p className="text-muted-foreground mt-1">
              {budgets.length} budget{budgets.length > 1 ? "s" : ""}
            </p>
          </div>
          <Button onClick={() => setShowCreate(true)} className="gap-2 gradient-bg text-primary-foreground rounded-xl font-bold">
            <Plus className="w-4 h-4" />
            Nouveau budget
          </Button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : budgets.length === 0 ? (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center py-20">
            <DollarSign className="w-16 h-16 text-muted-foreground/30 mx-auto mb-4" />
            <h2 className="text-xl font-semibold mb-2">Aucun budget prévisionnel</h2>
            <p className="text-muted-foreground mb-6">Créez votre premier budget prévisionnel professionnel.</p>
            <Button onClick={() => setShowCreate(true)} className="gap-2 gradient-bg text-primary-foreground rounded-xl font-bold">
              <Plus className="w-4 h-4" />
              Créer un budget
            </Button>
          </motion.div>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
            {budgets.map((b, i) => (
              <motion.div key={b.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }} className="glass-card-hover rounded-2xl overflow-hidden">
                <Link to={`/budget/${b.id}`} className="block p-6">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-2 flex-1 mr-2">
                      <DollarSign className="w-5 h-5 text-primary shrink-0" />
                      <h3 className="font-display font-bold text-base leading-tight line-clamp-2">{b.title}</h3>
                    </div>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary font-medium whitespace-nowrap">
                      {statusLabel[b.status] || b.status}
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground line-clamp-2 mb-4">{b.description || "Aucune description"}</p>
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>{b.horizon_months} mois</span>
                    {b.project_id && (
                      <div className="flex items-center gap-1">
                        <Link2 className="w-3.5 h-3.5" />
                        Lié à un projet
                      </div>
                    )}
                    <span>{new Date(b.created_at).toLocaleDateString("fr-FR")}</span>
                  </div>
                </Link>
                <div className="border-t border-border px-6 py-3 flex justify-end">
                  <button onClick={() => deleteBudget(b.id)} className="text-muted-foreground hover:text-destructive transition-colors p-1">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </motion.div>
            ))}
          </div>
        )}

        <Dialog open={showCreate} onOpenChange={setShowCreate}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Nouveau Budget Prévisionnel</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Titre *</Label>
                <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="Ex: Budget startup 2026" />
              </div>
              <div>
                <Label>Description du projet</Label>
                <Textarea value={description} onChange={e => setDescription(e.target.value)} placeholder="Décrivez votre projet pour une meilleure génération IA..." rows={3} />
              </div>
              <div>
                <Label>Horizon prévisionnel</Label>
                <Select value={horizon} onValueChange={setHorizon}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="6">6 mois</SelectItem>
                    <SelectItem value="12">12 mois (1 an)</SelectItem>
                    <SelectItem value="24">24 mois (2 ans)</SelectItem>
                    <SelectItem value="36">36 mois (3 ans)</SelectItem>
                    <SelectItem value="48">48 mois (4 ans)</SelectItem>
                    <SelectItem value="60">60 mois (5 ans)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Rattacher à un projet (optionnel)</Label>
                <Select value={projectId} onValueChange={setProjectId}>
                  <SelectTrigger><SelectValue placeholder="Aucun projet" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Aucun projet</SelectItem>
                    {projects.map(p => (
                      <SelectItem key={p.id} value={p.id}>{p.title}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowCreate(false)}>Annuler</Button>
              <Button onClick={handleCreate} disabled={!title.trim() || creating} className="gradient-bg text-primary-foreground">
                {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : "Créer"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
