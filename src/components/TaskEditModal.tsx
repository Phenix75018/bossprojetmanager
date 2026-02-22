import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X } from "lucide-react";
import { TaskRow } from "@/hooks/useProjectsDB";

interface TaskEditModalProps {
  task: (TaskRow & { subtasks: any[] }) | null;
  open: boolean;
  onClose: () => void;
  onSave: (taskId: string, updates: { title: string; description: string | null; priority: string; duration_hours: number }) => Promise<void>;
}

const priorities = [
  { value: "P0", label: "P0 — Critique", class: "border-orange-500/40 bg-orange-500/10 text-orange-600" },
  { value: "P1", label: "P1 — Haute", class: "border-rose-500/40 bg-rose-500/10 text-rose-600" },
  { value: "P2", label: "P2 — Normale", class: "border-primary/40 bg-primary/10 text-primary" },
];

export default function TaskEditModal({ task, open, onClose, onSave }: TaskEditModalProps) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState("P1");
  const [duration, setDuration] = useState(4);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (task) {
      setTitle(task.title);
      setDescription(task.description || "");
      setPriority(task.priority);
      setDuration(task.duration_hours);
    }
  }, [task]);

  const handleSave = async () => {
    if (!task || !title.trim()) return;
    setSaving(true);
    await onSave(task.id, {
      title: title.trim(),
      description: description.trim() || null,
      priority,
      duration_hours: duration,
    });
    setSaving(false);
    onClose();
  };

  return (
    <AnimatePresence>
      {open && task && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
        >
          {/* Backdrop */}
          <div className="absolute inset-0 bg-background/80 backdrop-blur-sm" onClick={onClose} />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ duration: 0.2 }}
            className="relative w-full max-w-lg glass-card rounded-2xl p-6 space-y-5 shadow-2xl"
          >
            {/* Close */}
            <button onClick={onClose} className="absolute top-4 right-4 p-1.5 rounded-lg hover:bg-muted transition-colors">
              <X className="w-4 h-4 text-muted-foreground" />
            </button>

            <h2 className="font-display font-bold text-lg">Modifier la tâche</h2>

            {/* Title */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Titre</label>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 transition-all"
                placeholder="Titre de la tâche"
              />
            </div>

            {/* Description */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Description</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                className="w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/30 transition-all"
                placeholder="Description optionnelle…"
              />
            </div>

            {/* Priority */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Priorité</label>
              <div className="flex gap-2">
                {priorities.map((p) => (
                  <button
                    key={p.value}
                    onClick={() => setPriority(p.value)}
                    className={`flex-1 px-3 py-2 rounded-xl border text-xs font-semibold transition-all ${
                      priority === p.value
                        ? `${p.class} ring-2 ring-offset-1 ring-offset-background ring-current`
                        : "border-border text-muted-foreground hover:border-foreground/20"
                    }`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Duration */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Durée estimée (heures)</label>
              <div className="flex items-center gap-3">
                <input
                  type="range"
                  min={1}
                  max={40}
                  value={duration}
                  onChange={(e) => setDuration(Number(e.target.value))}
                  className="flex-1 accent-primary"
                />
                <span className="text-sm font-mono font-bold min-w-[3ch] text-right">{duration}h</span>
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-3 pt-2">
              <button
                onClick={onClose}
                className="flex-1 px-4 py-2.5 rounded-xl border border-border text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
              >
                Annuler
              </button>
              <button
                onClick={handleSave}
                disabled={saving || !title.trim()}
                className="flex-1 px-4 py-2.5 rounded-xl gradient-bg text-primary-foreground text-sm font-semibold disabled:opacity-50 transition-all"
              >
                {saving ? "Enregistrement…" : "Enregistrer"}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
