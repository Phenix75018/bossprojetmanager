import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Sparkles, Loader2, RefreshCw, BookOpen } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface TaskExplainModalProps {
  open: boolean;
  onClose: () => void;
  taskTitle: string;
  taskDescription?: string | null;
  subtasks?: { title: string; duration_hours: number }[];
  projectDescription: string;
  phaseName: string;
  isSubtask?: boolean;
  taskId?: string | null;
  subtaskId?: string | null;
}

export default function TaskExplainModal({
  open,
  onClose,
  taskTitle,
  taskDescription,
  subtasks,
  projectDescription,
  phaseName,
  isSubtask = false,
  taskId,
  subtaskId,
}: TaskExplainModalProps) {
  const [explanation, setExplanation] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [savedId, setSavedId] = useState<string | null>(null);

  // Load saved explanation from DB
  useEffect(() => {
    if (!open || hasLoaded) return;
    const loadSaved = async () => {
      const entityId = isSubtask ? subtaskId : taskId;
      if (!entityId) { setHasLoaded(true); return; }

      let query = supabase.from("task_explanations").select("id, explanation");
      if (isSubtask) {
        query = query.eq("subtask_id", entityId).is("task_id", null);
      } else {
        query = query.eq("task_id", entityId).is("subtask_id", null);
      }
      const { data } = await query.order("created_at", { ascending: false }).limit(1);
      if (data && data.length > 0) {
        setExplanation(data[0].explanation);
        setSavedId(data[0].id);
      }
      setHasLoaded(true);
    };
    loadSaved();
  }, [open, hasLoaded, taskId, subtaskId, isSubtask]);

  // Auto-generate if no saved explanation found after load
  useEffect(() => {
    if (open && hasLoaded && !explanation && !loading) {
      generate();
    }
  }, [open, hasLoaded, explanation]);

  const generate = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("explain-task", {
        body: {
          taskTitle,
          taskDescription,
          subtasks: subtasks || [],
          projectDescription,
          phaseName,
          isSubtask,
        },
      });
      if (error) throw error;
      if (data?.error) {
        toast.error(data.error);
        return;
      }
      setExplanation(data.explanation);
      // Save to DB
      await saveExplanation(data.explanation);
    } catch (err: any) {
      toast.error(err.message || "Erreur lors de la génération");
    } finally {
      setLoading(false);
    }
  };

  const saveExplanation = async (text: string) => {
    const entityId = isSubtask ? subtaskId : taskId;
    if (!entityId) return;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    if (savedId) {
      await supabase.from("task_explanations").update({ explanation: text }).eq("id", savedId);
    } else {
      const insertData: any = {
        explanation: text,
        user_id: user.id,
      };
      if (isSubtask) {
        insertData.subtask_id = entityId;
      } else {
        insertData.task_id = entityId;
      }
      const { data } = await supabase.from("task_explanations").insert(insertData).select("id").single();
      if (data) setSavedId(data.id);
    }
  };

  const handleClose = () => {
    setExplanation(null);
    setHasLoaded(false);
    setSavedId(null);
    onClose();
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
        >
          <div className="absolute inset-0 bg-background/80 backdrop-blur-sm" onClick={handleClose} />

          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ duration: 0.2 }}
            className="relative w-full max-w-2xl glass-card rounded-2xl shadow-2xl max-h-[85vh] flex flex-col"
          >
            {/* Header */}
            <div className="flex items-center justify-between p-6 pb-4 border-b border-border">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-9 h-9 rounded-xl gradient-bg flex items-center justify-center flex-shrink-0">
                  <BookOpen className="w-4.5 h-4.5 text-primary-foreground" />
                </div>
                <div className="min-w-0">
                  <h2 className="font-display font-bold text-base truncate">
                    {isSubtask ? "Guide de la sous-tâche" : "Guide de la tâche"}
                  </h2>
                  <p className="text-xs text-muted-foreground truncate">{taskTitle}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={generate}
                  disabled={loading}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-border hover:border-primary/30 hover:text-primary transition-all disabled:opacity-50"
                  title="Régénérer une autre suggestion"
                >
                  {loading ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <RefreshCw className="w-3.5 h-3.5" />
                  )}
                  Autre suggestion
                </button>
                <button onClick={handleClose} className="p-1.5 rounded-lg hover:bg-muted transition-colors">
                  <X className="w-4 h-4 text-muted-foreground" />
                </button>
              </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-6">
              {loading && !explanation ? (
                <div className="flex flex-col items-center justify-center py-16 gap-4">
                  <div className="w-12 h-12 rounded-2xl gradient-bg flex items-center justify-center">
                    <Sparkles className="w-6 h-6 text-primary-foreground animate-pulse" />
                  </div>
                  <div className="text-center">
                    <p className="font-medium text-sm">Génération en cours…</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      L'IA prépare un guide détaillé pour cette {isSubtask ? "sous-tâche" : "tâche"}
                    </p>
                  </div>
                </div>
              ) : !hasLoaded ? (
                <div className="flex flex-col items-center justify-center py-16 gap-4">
                  <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">Chargement…</p>
                </div>
              ) : explanation ? (
                <div className="relative">
                  {loading && (
                    <div className="absolute top-0 right-0">
                      <Loader2 className="w-4 h-4 animate-spin text-primary" />
                    </div>
                  )}
                  <div className="prose prose-sm dark:prose-invert max-w-none prose-headings:font-display prose-headings:font-bold prose-h1:text-lg prose-h2:text-base prose-p:text-sm prose-li:text-sm prose-strong:text-foreground">
                    <ReactMarkdown>{explanation}</ReactMarkdown>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-16 gap-4 text-center">
                  <BookOpen className="w-8 h-8 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">
                    Cliquez sur "Autre suggestion" pour générer un guide
                  </p>
                </div>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
