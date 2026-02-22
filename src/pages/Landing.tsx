import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowRight, Zap, BarChart3, Calendar, CheckCircle2, Layers, Sparkles } from "lucide-react";
import Navbar from "@/components/layout/Navbar";
import heroBg from "@/assets/hero-bg.jpg";

const features = [
{
  icon: Sparkles,
  title: "Planification IA",
  description: "L'IA génère un plan d'action structuré en phases, tâches et sous-tâches automatiquement."
},
{
  icon: Layers,
  title: "Vues multiples",
  description: "Liste, Kanban ou Timeline — visualisez votre projet comme vous le souhaitez."
},
{
  icon: Calendar,
  title: "Calendrier intelligent",
  description: "Dispatch automatique dans votre calendrier selon vos disponibilités."
},
{
  icon: BarChart3,
  title: "Suivi en temps réel",
  description: "Progression, priorités et dépendances — tout est visible d'un coup d'œil."
}];


const fadeUp = {
  hidden: { opacity: 0, y: 30 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.1, duration: 0.6, ease: "easeOut" as const }
  })
};

export default function Landing() {
  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      {/* Hero */}
      <section className="relative pt-32 pb-20 overflow-hidden">
        <div className="absolute inset-0 z-0">
          <img src={heroBg} alt="" className="w-full h-full object-cover opacity-20" />
          <div className="absolute inset-0 bg-gradient-to-b from-background/60 via-background/80 to-background" />
        </div>

        {/* Floating orbs */}
        <div className="absolute top-20 left-10 w-72 h-72 bg-primary/20 rounded-full blur-3xl animate-float" />
        <div className="absolute bottom-10 right-10 w-96 h-96 bg-primary/10 rounded-full blur-3xl animate-float" style={{ animationDelay: "3s" }} />

        <div className="container relative z-10">
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            className="max-w-3xl mx-auto text-center">

            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.2 }}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary text-sm font-medium mb-8">

              <Zap className="w-4 h-4" />
              Propulsé par l'Intelligence Artificielle
            </motion.div>

            <h1 className="text-5xl md:text-7xl font-display font-black tracking-tight leading-[1.1] mb-6">
              Gérez vos projets
              <br />
              <span className="gradient-text">comme un Boss</span>
            </h1>

            <p className="text-lg md:text-xl text-muted-foreground max-w-xl mx-auto mb-10 leading-relaxed">
              Décrivez votre projet, l'IA génère votre plan d'action. 
              Organisez, planifiez et suivez — tout en un seul endroit.
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link
                to="/onboarding"
                className="gradient-bg text-primary-foreground px-8 py-4 rounded-xl text-base font-bold hover:opacity-90 transition-all flex items-center gap-2 shadow-lg shadow-primary/25 animate-glow">

                Créer mon plan d'action
                <ArrowRight className="w-5 h-5" />
              </Link>
              <Link
                to="/dashboard"
                className="px-8 py-4 rounded-xl text-base font-semibold text-foreground bg-card border border-border hover:border-primary/30 transition-all">

                Voir la démo
              </Link>
            </div>
          </motion.div>

          {/* Stats */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6 }}
            className="flex justify-center gap-12 mt-16 text-center">

            {[
            { value: "10x", label: "Plus rapide" },
            { value: "500+", label: "Projets gérés" },
            { value: "98%", label: "Satisfaction" }].
            map((stat) =>
            <div key={stat.label}>
                
                <div className="text-sm text-muted-foreground mt-1">{stat.label}</div>
              </div>
            )}
          </motion.div>
        </div>
      </section>

      {/* Features */}
      <section className="py-24">
        <div className="container">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            className="text-center mb-16">

            <motion.h2
              variants={fadeUp}
              custom={0}
              className="text-3xl md:text-4xl font-display font-black mb-4">

              Tout ce qu'il faut pour <span className="gradient-text">réussir</span>
            </motion.h2>
            <motion.p
              variants={fadeUp}
              custom={1}
              className="text-muted-foreground text-lg max-w-lg mx-auto">

              Des outils puissants pour transformer vos idées en résultats concrets.
            </motion.p>
          </motion.div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {features.map((feature, i) =>
            <motion.div
              key={feature.title}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true }}
              variants={fadeUp}
              custom={i + 2}
              className="glass-card-hover rounded-2xl p-6">

                <div className="w-12 h-12 rounded-xl gradient-bg flex items-center justify-center mb-4">
                  <feature.icon className="w-6 h-6 text-primary-foreground" />
                </div>
                <h3 className="font-display font-bold text-lg mb-2">{feature.title}</h3>
                <p className="text-muted-foreground text-sm leading-relaxed">{feature.description}</p>
              </motion.div>
            )}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-24">
        <div className="container">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            className="relative overflow-hidden rounded-3xl gradient-bg p-12 md:p-20 text-center">

            <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_50%,rgba(255,255,255,0.1),transparent)]" />
            <div className="relative z-10">
              <h2 className="text-3xl md:text-5xl font-display font-black text-primary-foreground mb-4">
                Prêt à devenir un Boss ?
              </h2>
              <p className="text-primary-foreground/80 text-lg mb-8 max-w-md mx-auto">
                Commencez gratuitement et transformez votre façon de gérer vos projets.
              </p>
              <Link
                to="/onboarding"
                className="inline-flex items-center gap-2 bg-card text-foreground px-8 py-4 rounded-xl text-base font-bold hover:bg-card/90 transition-all">

                Commencer maintenant
                <ArrowRight className="w-5 h-5" />
              </Link>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border py-8">
        <div className="container flex items-center justify-between text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-md gradient-bg flex items-center justify-center">
              <Zap className="w-3 h-3 text-primary-foreground" />
            </div>
            <span className="font-semibold text-foreground">BossPM</span>
          </div>
          <p>© 2026 Boss Projet Manager. Tous droits réservés.</p>
        </div>
      </footer>
    </div>);

}