import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Plus, FileText, Trash2, Loader2, ArrowLeft, Briefcase, Link2 } from "lucide-react";
import Navbar from "@/components/layout/Navbar";
import { useBusinessPlans } from "@/hooks/useBusinessPlans";
import { useProjectsDB } from "@/hooks/useProjectsDB";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";

export default function BusinessPlans() {
  const { plans, loading, deletePlan, createPlan } = useBusinessPlans();
  const { projects } = useProjectsDB();
  const navigate = useNavigate();
  const [showCreate, setShowCreate] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [projectId, setProjectId] = useState<string>("");
  const [creating, setCreating] = useState(false);

  const handleCreate = async () => {
    if (!title.trim()) return;
    setCreating(true);
    const id = await createPlan(title, description, projectId || undefined);
    setCreating(false);
    if (id) {
      setShowCreate(false);
      setTitle("");
      setDescription("");
      setProjectId("");
      navigate(`/business-plan/${id}`);
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
            <h1 className="text-3xl font-display font-black">Business Plans</h1>
            <p className="text-muted-foreground mt-1">
              {plans.length} business plan{plans.length > 1 ? "s" : ""}
            </p>
          </div>
          <Button onClick={() => setShowCreate(true)} className="gap-2 gradient-bg text-primary-foreground rounded-xl font-bold">
            <Plus className="w-4 h-4" />
            Nouveau business plan
          </Button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : plans.length === 0 ? (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center py-20">
            <FileText className="w-16 h-16 text-muted-foreground/30 mx-auto mb-4" />
            <h2 className="text-xl font-semibold mb-2">Aucun business plan</h2>
            <p className="text-muted-foreground mb-6">Créez votre premier business plan professionnel.</p>
            <Button onClick={() => setShowCreate(true)} className="gap-2 gradient-bg text-primary-foreground rounded-xl font-bold">
              <Plus className="w-4 h-4" />
              Créer un business plan
            </Button>
          </motion.div>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
            {plans.map((bp, i) => (
              <motion.div key={bp.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }} className="glass-card-hover rounded-2xl overflow-hidden">
                <Link to={`/business-plan/${bp.id}`} className="block p-6">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-2 flex-1 mr-2">
                      <Briefcase className="w-5 h-5 text-primary shrink-0" />
                      <h3 className="font-display font-bold text-base leading-tight line-clamp-2">{bp.title}</h3>
                    </div>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary font-medium whitespace-nowrap">
                      {statusLabel[bp.status] || bp.status}
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground line-clamp-2 mb-4">{bp.description || "Aucune description"}</p>
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    {bp.project_id && (
                      <div className="flex items-center gap-1">
                        <Link2 className="w-3.5 h-3.5" />
                        Lié à un projet
                      </div>
                    )}
                    <span>{new Date(bp.created_at).toLocaleDateString("fr-FR")}</span>
                  </div>
                </Link>
                <div className="border-t border-border px-6 py-3 flex justify-end">
                  <button onClick={() => deletePlan(bp.id)} className="text-muted-foreground hover:text-destructive transition-colors p-1">
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
              <DialogTitle>Nouveau Business Plan</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Titre *</Label>
                <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="Ex: Mon restaurant bio" />
              </div>
              <div>
                <Label>Description du projet</Label>
                <Textarea value={description} onChange={e => setDescription(e.target.value)} placeholder="Décrivez votre projet en détail pour une meilleure génération IA..." rows={4} />
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
