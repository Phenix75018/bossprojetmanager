import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, ArrowRight, Check, Sparkles } from "lucide-react";
import Navbar from "@/components/layout/Navbar";
import { useAuth } from "@/hooks/useAuth";
import { useProjectsDB } from "@/hooks/useProjectsDB";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

type ProjectStatus = "idea" | "planning" | "in-progress" | "halfway" | "finalizing";

const steps = ["Décris ton projet", "État d'avancement", "Tes disponibilités"];

const statusOptions: { value: ProjectStatus; label: string; emoji: string }[] = [
  { value: "idea", label: "Idée", emoji: "💡" },
  { value: "planning", label: "Planification", emoji: "📋" },
  { value: "in-progress", label: "En cours", emoji: "🚀" },
  { value: "halfway", label: "À 50%", emoji: "⚡" },
  { value: "finalizing", label: "Finalisation", emoji: "🎯" },
];

const days = ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi", "Dimanche"];

interface OnboardingData {
  description: string;
  status: ProjectStatus;
  statusDetails: string;
  availability: {
    daysPerWeek: string[];
    hoursPerWeek: number;
    timeSlots: string;
    deadline: string;
  };
}

export default function Onboarding() {
  const [step, setStep] = useState(0);
  const [data, setData] = useState<OnboardingData>({
    description: "",
    status: "idea",
    statusDetails: "",
    availability: {
      daysPerWeek: ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi"],
      hoursPerWeek: 20,
      timeSlots: "9h-12h, 14h-18h",
      deadline: "",
    },
  });
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationStatus, setGenerationStatus] = useState("Analyse du projet...");
  const { user } = useAuth();
  const { createProjectFromAI } = useProjectsDB();
  const navigate = useNavigate();

  const canNext =
    (step === 0 && data.description.trim().length > 10) ||
    (step === 1 && data.status) ||
    step === 2;

  const handleFinish = async () => {
    if (!user) {
      toast.error("Vous devez être connecté");
      navigate("/auth");
      return;
    }

    setIsGenerating(true);
    setGenerationStatus("L'IA analyse votre projet...");

    try {
      const { data: fnData, error: fnError } = await supabase.functions.invoke("generate-plan", {
        body: {
          description: data.description,
          status: data.status,
          statusDetails: data.statusDetails,
        },
      });

      if (fnError) throw new Error(fnError.message);
      if (fnData?.error) throw new Error(fnData.error);

      setGenerationStatus("Création du plan d'action...");

      const projectId = await createProjectFromAI(
        fnData.plan,
        data.description,
        data.status,
        data.availability
      );

      if (projectId) {
        setGenerationStatus("Terminé !");
        setTimeout(() => navigate(`/plan/${projectId}`), 500);
      } else {
        throw new Error("Erreur lors de la sauvegarde");
      }
    } catch (error: any) {
      console.error("Generation error:", error);
      toast.error(error.message || "Erreur lors de la génération du plan");
      setIsGenerating(false);
    }
  };

  const toggleDay = (day: string) => {
    setData((prev) => ({
      ...prev,
      availability: {
        ...prev.availability,
        daysPerWeek: prev.availability.daysPerWeek.includes(day)
          ? prev.availability.daysPerWeek.filter((d) => d !== day)
          : [...prev.availability.daysPerWeek, day],
      },
    }));
  };

  if (isGenerating) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="text-center"
        >
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
            className="w-20 h-20 rounded-2xl gradient-bg flex items-center justify-center mx-auto mb-6"
          >
            <Sparkles className="w-10 h-10 text-primary-foreground" />
          </motion.div>
          <h2 className="text-2xl font-display font-bold mb-2">{generationStatus}</h2>
          <p className="text-muted-foreground">Génération du plan d'action par l'IA</p>
          <div className="mt-6 w-64 h-2 bg-muted rounded-full mx-auto overflow-hidden">
            <motion.div
              className="h-full gradient-bg rounded-full"
              initial={{ width: "0%" }}
              animate={{ width: "90%" }}
              transition={{ duration: 8 }}
            />
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="container pt-28 pb-12 max-w-2xl">
        {/* Progress */}
        <div className="flex items-center gap-2 mb-10">
          {steps.map((s, i) => (
            <div key={s} className="flex items-center gap-2 flex-1">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-all ${
                  i <= step
                    ? "gradient-bg text-primary-foreground"
                    : "bg-muted text-muted-foreground"
                }`}
              >
                {i < step ? <Check className="w-4 h-4" /> : i + 1}
              </div>
              <span
                className={`text-sm font-medium hidden sm:block ${
                  i <= step ? "text-foreground" : "text-muted-foreground"
                }`}
              >
                {s}
              </span>
              {i < steps.length - 1 && (
                <div
                  className={`flex-1 h-0.5 rounded-full transition-colors ${
                    i < step ? "bg-primary" : "bg-muted"
                  }`}
                />
              )}
            </div>
          ))}
        </div>

        {/* Steps */}
        <AnimatePresence mode="wait">
          <motion.div
            key={step}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.3 }}
            className="glass-card rounded-2xl p-8"
          >
            {step === 0 && (
              <div>
                <h2 className="text-2xl font-display font-bold mb-2">Décris ton projet</h2>
                <p className="text-muted-foreground mb-6">
                  Sois le plus précis possible pour que l'IA puisse générer un plan adapté.
                </p>
                <textarea
                  value={data.description}
                  onChange={(e) => setData({ ...data, description: e.target.value })}
                  rows={6}
                  className="w-full rounded-xl border border-input bg-background px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 resize-none"
                  placeholder="Ex: Je veux créer une application mobile de livraison de repas avec un système de suivi GPS en temps réel, un module de paiement intégré, et une interface pour les restaurateurs..."
                />
                <p className="text-xs text-muted-foreground mt-2">
                  {data.description.length} caractères • Minimum 10 recommandé
                </p>
              </div>
            )}

            {step === 1 && (
              <div>
                <h2 className="text-2xl font-display font-bold mb-2">État d'avancement</h2>
                <p className="text-muted-foreground mb-6">Où en es-tu dans ce projet ?</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-6">
                  {statusOptions.map((opt) => (
                    <button
                      key={opt.value}
                      onClick={() => setData({ ...data, status: opt.value })}
                      className={`flex items-center gap-3 p-4 rounded-xl border text-left transition-all ${
                        data.status === opt.value
                          ? "border-primary bg-primary/5 shadow-sm"
                          : "border-border hover:border-primary/30"
                      }`}
                    >
                      <span className="text-2xl">{opt.emoji}</span>
                      <span className="font-medium">{opt.label}</span>
                    </button>
                  ))}
                </div>
                <textarea
                  value={data.statusDetails}
                  onChange={(e) => setData({ ...data, statusDetails: e.target.value })}
                  rows={3}
                  className="w-full rounded-xl border border-input bg-background px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 resize-none"
                  placeholder="Détails supplémentaires sur l'avancement (optionnel)..."
                />
              </div>
            )}

            {step === 2 && (
              <div>
                <h2 className="text-2xl font-display font-bold mb-2">Tes disponibilités</h2>
                <p className="text-muted-foreground mb-6">Quand peux-tu travailler sur ce projet ?</p>
                <div className="mb-6">
                  <label className="text-sm font-medium mb-3 block">Jours disponibles</label>
                  <div className="flex flex-wrap gap-2">
                    {days.map((day) => (
                      <button
                        key={day}
                        onClick={() => toggleDay(day)}
                        className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                          data.availability.daysPerWeek.includes(day)
                            ? "gradient-bg text-primary-foreground"
                            : "bg-muted text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        {day.slice(0, 3)}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4 mb-6">
                  <div>
                    <label className="text-sm font-medium mb-2 block">Heures / semaine</label>
                    <input
                      type="number"
                      value={data.availability.hoursPerWeek}
                      onChange={(e) =>
                        setData({
                          ...data,
                          availability: { ...data.availability, hoursPerWeek: Number(e.target.value) },
                        })
                      }
                      className="w-full rounded-xl border border-input bg-background px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                      min={1}
                      max={80}
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-2 block">Date butoir</label>
                    <input
                      type="date"
                      value={data.availability.deadline}
                      onChange={(e) =>
                        setData({
                          ...data,
                          availability: { ...data.availability, deadline: e.target.value },
                        })
                      }
                      className="w-full rounded-xl border border-input bg-background px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                    />
                  </div>
                </div>
                <div>
                  <label className="text-sm font-medium mb-2 block">Plages horaires préférées</label>
                  <input
                    type="text"
                    value={data.availability.timeSlots}
                    onChange={(e) =>
                      setData({
                        ...data,
                        availability: { ...data.availability, timeSlots: e.target.value },
                      })
                    }
                    className="w-full rounded-xl border border-input bg-background px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                    placeholder="Ex: 9h-12h, 14h-18h"
                  />
                </div>
              </div>
            )}
          </motion.div>
        </AnimatePresence>

        {/* Navigation */}
        <div className="flex items-center justify-between mt-6">
          <button
            onClick={() => setStep((s) => s - 1)}
            disabled={step === 0}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium text-muted-foreground hover:text-foreground disabled:opacity-30 transition-all"
          >
            <ArrowLeft className="w-4 h-4" />
            Précédent
          </button>

          {step < 2 ? (
            <button
              onClick={() => setStep((s) => s + 1)}
              disabled={!canNext}
              className="flex items-center gap-2 gradient-bg text-primary-foreground px-6 py-2.5 rounded-xl text-sm font-bold disabled:opacity-50 transition-all"
            >
              Suivant
              <ArrowRight className="w-4 h-4" />
            </button>
          ) : (
            <button
              onClick={handleFinish}
              className="flex items-center gap-2 gradient-bg text-primary-foreground px-6 py-2.5 rounded-xl text-sm font-bold transition-all animate-glow"
            >
              <Sparkles className="w-4 h-4" />
              Générer mon plan
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
