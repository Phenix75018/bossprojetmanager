import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { Loader2, Lock, FileText } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";

const SECTION_ICONS: Record<string, string> = {
  executive_summary: "📋",
  market_analysis: "📊",
  business_strategy: "🎯",
  financial_plan: "💰",
  best_practices: "⭐",
};

export default function SharedBusinessPlan() {
  const { token } = useParams<{ token: string }>();
  const [loading, setLoading] = useState(true);
  const [needsPassword, setNeedsPassword] = useState(false);
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [plan, setPlan] = useState<any>(null);
  const [sections, setSections] = useState<any[]>([]);
  const [activeSection, setActiveSection] = useState<string>("");

  const fetchPlan = async (pwd?: string) => {
    setLoading(true);
    setError("");
    try {
      const { data, error: err } = await supabase.functions.invoke("get-shared-business-plan", {
        body: { token, password: pwd },
      });
      if (err) throw err;
      if (data?.error === "password_required") {
        setNeedsPassword(true);
        setLoading(false);
        return;
      }
      if (data?.error) {
        setError(data.error);
        setLoading(false);
        return;
      }
      setPlan(data.businessPlan);
      setSections(data.sections || []);
      if (data.sections?.length > 0) setActiveSection(data.sections[0].section_type);
      setNeedsPassword(false);
    } catch {
      setError("Erreur lors du chargement");
    }
    setLoading(false);
  };

  useEffect(() => { fetchPlan(); }, [token]);

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center bg-background"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;
  }

  if (needsPassword) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="glass-card rounded-2xl p-8 max-w-sm w-full text-center">
          <Lock className="w-10 h-10 text-primary mx-auto mb-4" />
          <h2 className="font-display font-bold text-lg mb-2">Contenu protégé</h2>
          <p className="text-sm text-muted-foreground mb-4">Entrez le mot de passe pour accéder à ce business plan.</p>
          <Input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Mot de passe" className="mb-3" />
          {error && <p className="text-destructive text-sm mb-3">{error}</p>}
          <Button onClick={() => fetchPlan(password)} className="w-full gradient-bg text-primary-foreground">Accéder</Button>
        </div>
      </div>
    );
  }

  if (error || !plan) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <FileText className="w-12 h-12 text-muted-foreground/30 mx-auto mb-4" />
          <p className="text-muted-foreground">{error || "Business plan introuvable"}</p>
        </div>
      </div>
    );
  }

  const current = sections.find((s: any) => s.section_type === activeSection);

  return (
    <div className="min-h-screen bg-background">
      <div className="container py-8 max-w-5xl">
        <div className="mb-6">
          <h1 className="text-2xl font-display font-black">{plan.title}</h1>
          {plan.description && <p className="text-sm text-muted-foreground mt-1">{plan.description}</p>}
        </div>

        <div className="grid lg:grid-cols-[240px_1fr] gap-6">
          <div className="space-y-1">
            {sections.map((s: any) => (
              <button
                key={s.section_type}
                onClick={() => setActiveSection(s.section_type)}
                className={`w-full text-left px-3 py-2.5 rounded-lg text-sm transition-all flex items-center gap-2 ${
                  activeSection === s.section_type ? "bg-primary/10 text-primary font-semibold" : "hover:bg-muted"
                }`}
              >
                <span>{SECTION_ICONS[s.section_type] || "📄"}</span>
                {s.title}
              </button>
            ))}
          </div>
          <div className="glass-card rounded-2xl p-6">
            {current ? (
              <div>
                <h2 className="text-lg font-display font-bold mb-4">{current.title}</h2>
                <div className="prose prose-sm dark:prose-invert max-w-none">
                  <ReactMarkdown>{current.content}</ReactMarkdown>
                </div>
              </div>
            ) : (
              <p className="text-muted-foreground text-center py-20">Sélectionnez une section</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
