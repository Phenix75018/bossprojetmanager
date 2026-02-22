import { Link, useLocation } from "react-router-dom";
import { motion } from "framer-motion";
import { FolderKanban, CalendarDays, Zap, LogOut, User, Link2 } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";

const navItems = [
{ to: "/", label: "Accueil", icon: Zap },
{ to: "/dashboard", label: "Projets", icon: FolderKanban },
{ to: "/integrations", label: "Intégrations", icon: Link2 }];


export default function Navbar() {
  const location = useLocation();
  const { user, signOut } = useAuth();

  return (
    <motion.header
      initial={{ y: -20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      className="fixed top-0 left-0 right-0 z-50 glass-card border-b border-border/50">

      <div className="container flex items-center justify-between h-16">
        <Link to="/" className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg gradient-bg flex items-center justify-center">
            <Zap className="w-4 h-4 text-primary-foreground" />
          </div>
          <span className="font-display font-bold text-2xl tracking-tight italic">
            Boss <span className="text-primary">Project Manager</span>
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
