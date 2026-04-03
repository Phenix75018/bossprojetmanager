import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Plus, Calendar, BarChart3, Trash2, FolderOpen, Loader2, ArrowLeft, FileText } from "lucide-react";
import Navbar from "@/components/layout/Navbar";
import { useProjectsDB } from "@/hooks/useProjectsDB";

export default function Dashboard() {
  const { projects, loading, deleteProject } = useProjectsDB();

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="container pt-24 pb-12">
        <div className="flex items-center justify-between mb-8">
          <div>
            <Link to="/" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-2">
              <ArrowLeft className="w-4 h-4" />
              Retour à l'accueil
            </Link>
            <h1 className="text-3xl font-display font-black">Mes projets</h1>
            <p className="text-muted-foreground mt-1">
              {projects.length} projet{projects.length > 1 ? "s" : ""} actif{projects.length > 1 ? "s" : ""}
            </p>
          </div>
          <Link
            to="/onboarding"
            className="flex items-center gap-2 gradient-bg text-primary-foreground px-5 py-2.5 rounded-xl text-sm font-bold hover:opacity-90 transition-all"
          >
            <Plus className="w-4 h-4" />
            Nouveau projet
          </Link>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : projects.length === 0 ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-center py-20"
          >
            <FolderOpen className="w-16 h-16 text-muted-foreground/30 mx-auto mb-4" />
            <h2 className="text-xl font-semibold mb-2">Aucun projet pour l'instant</h2>
            <p className="text-muted-foreground mb-6">Créez votre premier projet pour commencer.</p>
            <Link
              to="/onboarding"
              className="inline-flex items-center gap-2 gradient-bg text-primary-foreground px-6 py-3 rounded-xl font-bold"
            >
              <Plus className="w-4 h-4" />
              Créer un projet
            </Link>
          </motion.div>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
            {projects.map((project, i) => (
              <motion.div
                key={project.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                className="glass-card-hover rounded-2xl overflow-hidden"
              >
                <Link to={`/plan/${project.id}`} className="block p-6">
                  <div className="flex items-start justify-between mb-3">
                    <h3 className="font-display font-bold text-base leading-tight line-clamp-2 flex-1 mr-2">
                      {project.title}
                    </h3>
                    <span className="font-mono text-xs text-primary font-semibold">
                      {project.completion_percent}%
                    </span>
                  </div>

                  <p className="text-sm text-muted-foreground line-clamp-2 mb-4">
                    {project.description}
                  </p>

                  <div className="h-1.5 bg-muted rounded-full mb-4 overflow-hidden">
                    <div
                      className="h-full gradient-bg rounded-full transition-all duration-500"
                      style={{ width: `${project.completion_percent}%` }}
                    />
                  </div>

                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <div className="flex items-center gap-1">
                      <BarChart3 className="w-3.5 h-3.5" />
                      {project.status}
                    </div>
                    <div className="flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5" />
                      {new Date(project.created_at).toLocaleDateString("fr-FR")}
                    </div>
                  </div>
                </Link>

                <div className="border-t border-border px-6 py-3 flex justify-end">
                  <button
                    onClick={() => deleteProject(project.id)}
                    className="text-muted-foreground hover:text-destructive transition-colors p-1"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
