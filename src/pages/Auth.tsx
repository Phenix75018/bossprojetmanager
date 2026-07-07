import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { Zap, Mail, Lock, User, ArrowRight, Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";

export default function Auth() {
  const [isLogin, setIsLogin] = useState(true);
  const [isForgot, setIsForgot] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (isForgot) {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/reset-password`,
        });
        if (error) throw error;
        toast.success("Email de réinitialisation envoyé ! Vérifiez votre boîte.");
        setIsForgot(false);
      } else if (isLogin) {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        toast.success("Connexion réussie !");
        navigate("/dashboard");
      } else {
        const { data, error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        // With email confirmation disabled, sign-up returns an active session
        // right away, so the user is logged straight in. Keep a graceful
        // fallback in case confirmation is ever re-enabled server-side.
        if (data.session) {
          toast.success("Compte créé ! Bienvenue 🎉");
          navigate("/dashboard");
        } else {
          toast.success("Compte créé ! Vérifiez votre email pour confirmer.");
        }
      }
    } catch (error: any) {
      toast.error(error.message || "Une erreur est survenue");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="absolute top-20 left-10 w-72 h-72 bg-primary/20 rounded-full blur-3xl animate-float" />
      <div className="absolute bottom-10 right-10 w-96 h-96 bg-primary/10 rounded-full blur-3xl animate-float" style={{ animationDelay: "3s" }} />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md relative z-10"
      >
        <div className="text-center mb-8">
          <div className="w-12 h-12 rounded-xl gradient-bg flex items-center justify-center mx-auto mb-4">
            <Zap className="w-6 h-6 text-primary-foreground" />
          </div>
          <h1 className="text-2xl font-display font-black">
            {isForgot ? "Mot de passe oublié" : isLogin ? "Bon retour !" : "Créer un compte"}
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            {isForgot
              ? "Entrez votre email pour recevoir un lien de réinitialisation"
              : isLogin
              ? "Connectez-vous pour continuer"
              : "Rejoignez Boss PM gratuitement"}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="glass-card rounded-2xl p-8 space-y-5">
          <div>
            <label className="text-sm font-medium mb-2 block">Email</label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-xl border border-input bg-background pl-10 pr-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                placeholder="vous@exemple.com"
              />
            </div>
          </div>

          {!isForgot && (
            <div>
              <label className="text-sm font-medium mb-2 block">Mot de passe</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input
                  type={showPassword ? "text" : "password"}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full rounded-xl border border-input bg-background pl-10 pr-10 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                  placeholder="••••••••"
                  minLength={6}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {isLogin && (
                <button
                  type="button"
                  onClick={() => setIsForgot(true)}
                  className="text-xs text-primary hover:underline mt-2"
                >
                  Mot de passe oublié ?
                </button>
              )}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 gradient-bg text-primary-foreground py-3 rounded-xl font-bold text-sm disabled:opacity-50 transition-all"
          >
            {loading ? (
              <span className="animate-pulse-soft">Chargement...</span>
            ) : (
              <>
                {isForgot ? "Envoyer le lien" : isLogin ? "Se connecter" : "Créer mon compte"}
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>

        <p className="text-center text-sm text-muted-foreground mt-6">
          {isForgot ? (
            <button
              onClick={() => setIsForgot(false)}
              className="text-primary font-semibold hover:underline"
            >
              Retour à la connexion
            </button>
          ) : (
            <>
              {isLogin ? "Pas encore de compte ?" : "Déjà un compte ?"}{" "}
              <button
                onClick={() => setIsLogin(!isLogin)}
                className="text-primary font-semibold hover:underline"
              >
                {isLogin ? "S'inscrire" : "Se connecter"}
              </button>
            </>
          )}
        </p>
      </motion.div>
    </div>
  );
}
