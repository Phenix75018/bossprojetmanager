import { Link, useLocation } from "react-router-dom";
import { motion } from "framer-motion";
import { FolderKanban, CalendarDays, Zap, LogOut, User, Link2, FileText, LayoutGrid, DollarSign, ShieldCheck, Search, FileBarChart, ScanSearch } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import ThemeToggle from "@/components/ThemeToggle";

const navItems = [
{ to: "/", label: "Accueil", icon: Zap },
{ to: "/dashboard", label: "Projets", icon: FolderKanban },
{ to: "/business-plans", label: "Business Plans", icon: FileText },
{ to: "/business-models", label: "Business Models", icon: LayoutGrid },
{ to: "/budgets", label: "Budgets", icon: DollarSign },
{ to: "/coherence", label: "Cohérence", icon: ShieldCheck },
{ to: "/checks", label: "Vérifications", icon: ScanSearch },
{ to: "/reports", label: "Rapports", icon: FileBarChart },
{ to: "/calendar", label: "Calendrier", icon: CalendarDays },
{ to: "/integrations", label: "Intégrations", icon: Link2 }];


export default function Navbar() {
  const location = useLocation();
  const { user, signOut } = useAuth();

  return (
    <motion.header
      initial={{ y: -20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      className="fixed top-0 left-0 right-0 z-50 glass-card !rounded-none border-x-0 border-t-0 border-b border-border/60">

      <div className="container flex items-center justify-between h-16">
        <Link to="/" className="flex items-center gap-2.5 group">
          <div className="w-9 h-9 rounded-xl gradient-bg flex items-center justify-center animate-glow-pulse transition-transform group-hover:scale-105">
            <Zap className="w-4 h-4 text-primary-foreground" />
          </div>
          <span className="font-display font-bold text-2xl tracking-tight italic">
            Boss <span className="gradient-text">Project Manager</span>
          </span>
        </Link>


        <nav className="hidden md:flex items-center gap-1">
          {navItems.map((item) => {
            const active = location.pathname === item.to;
            return (
              <Link
                key={item.to}
                to={item.to}
                className={`relative flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                active ? "text-primary" : "text-muted-foreground hover:text-foreground"}`
                }>

                <item.icon className="w-4 h-4" />
                {item.label}
                {active &&
                <motion.div
                  layoutId="nav-indicator"
                  className="absolute inset-0 rounded-lg bg-primary/10"
                  transition={{ type: "spring", bounce: 0.2, duration: 0.5 }} />

                }
              </Link>);

          })}
        </nav>

        <div className="flex items-center gap-3">
          <button
            onClick={() => {
              const ev = new KeyboardEvent("keydown", { key: "k", ctrlKey: true, bubbles: true });
              window.dispatchEvent(ev);
            }}
            title="Rechercher (Ctrl/Cmd + K)"
            className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs text-muted-foreground hover:text-foreground border border-border/60 hover:border-border transition-colors">
            <Search className="w-3.5 h-3.5" />
            <span>Rechercher</span>
            <kbd className="ml-1 px-1.5 py-0.5 rounded bg-muted text-[10px] font-mono">⌘K</kbd>
          </button>
          <ThemeToggle />
          {user ?
          <>
              <Link
              to="/onboarding"
              className="gradient-bg text-primary-foreground px-5 py-2 rounded-lg text-sm font-semibold hover:opacity-90 transition-opacity">

                Nouveau projet
              </Link>
              <button
              onClick={signOut}
              className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">

                <LogOut className="w-4 h-4" />
              </button>
            </> :

          <Link
            to="/auth"
            className="gradient-bg text-primary-foreground px-5 py-2 rounded-lg text-sm font-semibold hover:opacity-90 transition-opacity">

              Connexion
            </Link>
          }
        </div>
      </div>
    </motion.header>);

}
