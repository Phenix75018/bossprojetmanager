import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Plus, LayoutGrid, Trash2, Loader2, ArrowLeft, Briefcase, Link2 } from "lucide-react";
import Navbar from "@/components/layout/Navbar";
import { useBusinessModels } from "@/hooks/useBusinessModels";
import { useProjectsDB } from "@/hooks/useProjectsDB";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";

export default function BusinessModels() {
  const { models, loading, deleteModel, createModel } = useBusinessModels();
  const { projects } = useProjectsDB();
  const navigate = useNavigate();
  const [showCreate, setShowCreate] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [framework, setFramework] = useState<string>("bmc");
  const [projectId, setProjectId] = useState<string>("");
  const [creating, setCreating] = useState(false);

  const handleCreate = async () => {
    if (!title.trim()) return;
    setCreating(true);
    const id = await createModel(title, description, framework, projectId || undefined);
    setCreating(false);
    if (id) {
      setShowCreate(false);
      setTitle("");
      setDescription("");
      setFramework("bmc");
      setProjectId("");
      navigate(`/business-model/${id}`);
    }
  };

  const statusLabel: Record<string, string> = {
    draft: "Brouillon",
    in_progress: "En cours",
    completed: "Terminé",
  };

  const frameworkLabel: Record<string, string> = {
    bmc: "Business Model Canvas",
    lean: "Lean Canvas",
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
            <h1 className="text-3xl font-display font-black">Business Models</h1>
            <p className="text-muted-foreground mt-1">
              {models.length} business model{models.length > 1 ? "s" : ""}
            </p>
          </div>
          <Button onClick={() => setShowCreate(true)} className="gap-2 gradient-bg text-primary-foreground rounded-xl font-bold">
            <Plus className="w-4 h-4" />
            Nouveau business model
          </Button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : models.length === 0 ? (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center py-20">
            <LayoutGrid className="w-16 h-16 text-muted-foreground/30 mx-auto mb-4" />
            <h2 className="text-xl font-semibold mb-2">Aucun business model</h2>
            <p className="text-muted-foreground mb-6">Créez votre premier business model professionnel.</p>
            <Button onClick={() => setShowCreate(true)} className="gap-2 gradient-bg text-primary-foreground rounded-xl font-bold">
              <Plus className="w-4 h-4" />
              Créer un business model
            </Button>
          </motion.div>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
            {models.map((bm, i) => (
              <motion.div key={bm.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }} className="glass-card-hover rounded-2xl overflow-hidden">
                <Link to={`/business-model/${bm.id}`} className="block p-6">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-2 flex-1 mr-2">
                      <LayoutGrid className="w-5 h-5 text-primary shrink-0" />
                      <h3 className="font-display font-bold text-base leading-tight line-clamp-2">{bm.title}</h3>
                    </div>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary font-medium whitespace-nowrap">
                      {statusLabel[bm.status] || bm.status}
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground line-clamp-2 mb-3">{bm.description || "Aucune description"}</p>
                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-xs px-2 py-0.5 rounded-md bg-muted text-muted-foreground font-medium">
                      {frameworkLabel[bm.framework] || bm.framework}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    {bm.project_id && (
                      <div className="flex items-center gap-1">
                        <Link2 className="w-3.5 h-3.5" />
                        Lié à un projet
                      </div>
                    )}
                    <span>{new Date(bm.created_at).toLocaleDateString("fr-FR")}</span>
                  </div>
                </Link>
                <div className="border-t border-border px-6 py-3 flex justify-end">
                  <button onClick={() => deleteModel(bm.id)} className="text-muted-foreground hover:text-destructive transition-colors p-1">
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
              <DialogTitle>Nouveau Business Model</DialogTitle>
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
                <Label>Framework</Label>
                <Select value={framework} onValueChange={setFramework}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="bmc">Business Model Canvas</SelectItem>
                    <SelectItem value="lean">Lean Canvas</SelectItem>
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
