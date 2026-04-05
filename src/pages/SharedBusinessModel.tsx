import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { Loader2, Lock, LayoutGrid } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const BMC_BLOCKS = [
  { type: "key_partners", title: "Partenaires clés", icon: "🤝", color: "bg-blue-500/10 border-blue-500/30" },
  { type: "key_activities", title: "Activités clés", icon: "⚙️", color: "bg-purple-500/10 border-purple-500/30" },
  { type: "key_resources", title: "Ressources clés", icon: "🏗️", color: "bg-indigo-500/10 border-indigo-500/30" },
  { type: "value_propositions", title: "Propositions de valeur", icon: "💎", color: "bg-amber-500/10 border-amber-500/30" },
  { type: "customer_relationships", title: "Relations clients", icon: "💬", color: "bg-pink-500/10 border-pink-500/30" },
  { type: "channels", title: "Canaux", icon: "📢", color: "bg-cyan-500/10 border-cyan-500/30" },
  { type: "customer_segments", title: "Segments de clientèle", icon: "👥", color: "bg-green-500/10 border-green-500/30" },
  { type: "cost_structure", title: "Structure des coûts", icon: "💸", color: "bg-red-500/10 border-red-500/30" },
  { type: "revenue_streams", title: "Sources de revenus", icon: "💰", color: "bg-emerald-500/10 border-emerald-500/30" },
];

const LEAN_BLOCKS = [
  { type: "problem", title: "Problème", icon: "❗", color: "bg-red-500/10 border-red-500/30" },
  { type: "solution", title: "Solution", icon: "💡", color: "bg-green-500/10 border-green-500/30" },
  { type: "unique_value", title: "Proposition de valeur unique", icon: "💎", color: "bg-amber-500/10 border-amber-500/30" },
  { type: "unfair_advantage", title: "Avantage compétitif", icon: "🛡️", color: "bg-purple-500/10 border-purple-500/30" },
  { type: "customer_segments", title: "Segments de clientèle", icon: "👥", color: "bg-blue-500/10 border-blue-500/30" },
  { type: "key_metrics", title: "Métriques clés", icon: "📊", color: "bg-indigo-500/10 border-indigo-500/30" },
  { type: "channels", title: "Canaux", icon: "📢", color: "bg-cyan-500/10 border-cyan-500/30" },
  { type: "cost_structure", title: "Structure des coûts", icon: "💸", color: "bg-pink-500/10 border-pink-500/30" },
  { type: "revenue_streams", title: "Sources de revenus", icon: "💰", color: "bg-emerald-500/10 border-emerald-500/30" },
];

export default function SharedBusinessModel() {
  const { token } = useParams<{ token: string }>();
  const [loading, setLoading] = useState(true);
  const [needPassword, setNeedPassword] = useState(false);
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [data, setData] = useState<any>(null);

  const loadShared = async (pwd?: string) => {
    setLoading(true);
    setError("");
    try {
      const { data: result, error: err } = await supabase.functions.invoke("get-shared-business-model", {
        body: { token, password: pwd },
      });
      if (err) throw err;
      if (result?.error === "password_required") {
        setNeedPassword(true);
        setLoading(false);
        return;
      }
      if (result?.error) {
        setError(result.error);
        setLoading(false);
        return;
      }
      setData(result);
      setNeedPassword(false);
    } catch {
      setError("Erreur lors du chargement");
    }
    setLoading(false);
  };

  useEffect(() => { loadShared(); }, [token]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (needPassword) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="glass-card rounded-2xl p-8 max-w-sm w-full text-center">
          <Lock className="w-10 h-10 text-primary mx-auto mb-4" />
          <h2 className="text-lg font-bold mb-2">Business model protégé</h2>
          <p className="text-sm text-muted-foreground mb-4">Entrez le mot de passe pour accéder</p>
          <Input
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            placeholder="Mot de passe"
            className="mb-3"
          />
          {error && <p className="text-xs text-destructive mb-2">{error}</p>}
          <Button onClick={() => loadShared(password)} className="w-full gradient-bg text-primary-foreground">
            Accéder
          </Button>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <p className="text-muted-foreground">{error || "Business model introuvable"}</p>
        </div>
      </div>
    );
  }

  const { businessModel, blocks } = data;
  const BLOCKS = businessModel.framework === "lean" ? LEAN_BLOCKS : BMC_BLOCKS;

  return (
    <div className="min-h-screen bg-background">
      <div className="container py-12">
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-2 mb-2">
            <LayoutGrid className="w-6 h-6 text-primary" />
            <h1 className="text-2xl font-display font-black">{businessModel.title}</h1>
          </div>
          <span className="text-xs px-2 py-0.5 rounded-md bg-muted text-muted-foreground font-medium">
            {businessModel.framework === "lean" ? "Lean Canvas" : "Business Model Canvas"}
          </span>
          {businessModel.description && <p className="text-sm text-muted-foreground mt-2">{businessModel.description}</p>}
        </div>

        <div className={`grid gap-4 ${businessModel.framework === "bmc" ? "grid-cols-1 md:grid-cols-5" : "grid-cols-1 md:grid-cols-3"}`}>
          {BLOCKS.map((blockDef) => {
            const block = blocks.find((b: any) => b.block_type === blockDef.type);
            let gridClass = "";
            if (businessModel.framework === "bmc") {
              if (blockDef.type === "cost_structure") gridClass = "md:col-span-2";
              else if (blockDef.type === "revenue_streams") gridClass = "md:col-span-3";
            }
            return (
              <div key={blockDef.type} className={`rounded-xl border p-4 ${blockDef.color} ${gridClass}`}>
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-lg">{blockDef.icon}</span>
                  <h3 className="text-sm font-bold">{blockDef.title}</h3>
                </div>
                {block ? (
                  <div className="prose prose-xs dark:prose-invert max-w-none text-xs leading-relaxed">
                    <ReactMarkdown>{block.content}</ReactMarkdown>
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground italic">Non renseigné</p>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
