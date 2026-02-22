import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Calendar,
  Check,
  Copy,
  ExternalLink,
  Link2,
  Loader2,
  CalendarDays,
  Bell,
  BellOff,
} from "lucide-react";
import { useNotifications } from "@/hooks/useNotifications";
import Navbar from "@/components/layout/Navbar";
import { useCalendarIntegrations } from "@/hooks/useCalendarIntegrations";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";

const CALENDARS = [
  {
    id: "google",
    name: "Google Calendar",
    icon: "https://upload.wikimedia.org/wikipedia/commons/a/a5/Google_Calendar_icon_%282020%29.svg",
    color: "hsl(210 78% 56%)",
    instructions:
      "Ouvrez Google Calendar → Paramètres → Ajouter par URL → Collez le lien ICS ci-dessous.",
  },
  {
    id: "outlook",
    name: "Microsoft Outlook",
    icon: "https://upload.wikimedia.org/wikipedia/commons/d/df/Microsoft_Office_Outlook_%282018%E2%80%93present%29.svg",
    color: "hsl(210 90% 45%)",
    instructions:
      "Ouvrez Outlook → Calendrier → Ajouter un calendrier → S'abonner depuis le web → Collez le lien ICS.",
  },
  {
    id: "apple",
    name: "Apple Calendar",
    icon: "https://help.apple.com/assets/674CCA5DA08383A01C0227FA/674CCA5EA08383A01C022801/fr_FR/3e527e55a8cc9f2b4b7f3e6dbb8828c4.png",
    color: "hsl(0 0% 20%)",
    instructions:
      "Ouvrez Calendrier sur Mac → Fichier → Nouvel abonnement de calendrier → Collez l'URL ICS.",
  },
  {
    id: "yahoo",
    name: "Yahoo Calendar",
    icon: "https://s.yimg.com/rz/p/yahoo_calendar_en-US_f_p_142x37.png",
    color: "hsl(270 80% 50%)",
    instructions:
      "Ouvrez Yahoo Calendar → Actions → S'abonner à un calendrier → Collez le lien ICS.",
  },
  {
    id: "samsung",
    name: "Samsung Calendar",
    icon: "",
    color: "hsl(210 70% 40%)",
    instructions:
      "Samsung Calendar → Menu → Ajouter un compte → Copiez le fichier ICS et importez-le.",
  },
  {
    id: "thunderbird",
    name: "Thunderbird",
    icon: "",
    color: "hsl(210 80% 45%)",
    instructions:
      "Thunderbird → Nouveau calendrier → Sur le réseau → Format iCalendar (ICS) → Collez l'URL.",
  },
  {
    id: "zoho",
    name: "Zoho Calendar",
    icon: "",
    color: "hsl(15 85% 50%)",
    instructions:
      "Zoho Calendar → Paramètres → Importer/Exporter → S'abonner via URL → Collez le lien ICS.",
  },
  {
    id: "fastmail",
    name: "FastMail",
    icon: "",
    color: "hsl(210 60% 35%)",
    instructions:
      "FastMail → Calendrier → Ajouter un calendrier → Abonnement → Collez l'URL ICS.",
  },
  {
    id: "proton",
    name: "Proton Calendar",
    icon: "",
    color: "hsl(260 75% 55%)",
    instructions:
      "Proton Calendar → Paramètres → Calendriers → Ajouter un calendrier externe via lien ICS.",
  },
  {
    id: "notion",
    name: "Notion Calendar",
    icon: "",
    color: "hsl(0 0% 10%)",
    instructions:
      "Notion Calendar → Paramètres → S'abonner à un calendrier → Collez le lien ICS.",
  },
];

function CalendarIcon({ cal }: { cal: (typeof CALENDARS)[0] }) {
  if (cal.icon) {
    return (
      <img
        src={cal.icon}
        alt={cal.name}
        className="w-8 h-8 object-contain"
        onError={(e) => {
          (e.target as HTMLImageElement).style.display = "none";
        }}
      />
    );
  }
  return (
    <div
      className="w-8 h-8 rounded-lg flex items-center justify-center text-primary-foreground font-bold text-sm"
      style={{ background: cal.color }}
    >
      {cal.name.charAt(0)}
    </div>
  );
}

export default function Integrations() {
  const { integrations, loading, toggleIntegration, getICSUrl } =
    useCalendarIntegrations();
  const { prefs: notifPrefs, loading: notifLoading, toggleEnabled: toggleNotifications, permissionState } =
    useNotifications();
  const [selectedCal, setSelectedCal] = useState<
    (typeof CALENDARS)[0] | null
  >(null);
  const [copied, setCopied] = useState(false);
  const { toast } = useToast();

  const isEnabled = (provider: string) =>
    integrations.some((i) => i.provider === provider && i.enabled);

  const copyICS = (provider: string) => {
    const url = getICSUrl(provider);
    if (url) {
      navigator.clipboard.writeText(url);
      setCopied(true);
      toast({ title: "Lien ICS copié !" });
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="container pt-24 pb-12 max-w-4xl">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl gradient-bg flex items-center justify-center">
              <Link2 className="w-5 h-5 text-primary-foreground" />
            </div>
            <h1 className="text-3xl font-display font-black">Intégrations</h1>
          </div>
          <p className="text-muted-foreground mb-8 ml-[52px]">
            Connectez vos calendriers pour synchroniser vos tâches et événements.
          </p>

          {/* Built-in calendar toggle */}
          <div className="glass-card rounded-2xl p-6 mb-8">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl gradient-bg flex items-center justify-center">
                  <CalendarDays className="w-6 h-6 text-primary-foreground" />
                </div>
                <div>
                  <h2 className="font-display font-bold text-lg">
                    Calendrier BossPM
                  </h2>
                  <p className="text-sm text-muted-foreground">
                    Calendrier intégré avec dispatch intelligent des tâches
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-primary bg-primary/10 px-2.5 py-1 rounded-full">
                  Actif
                </span>
              </div>
            </div>
          </div>

          {/* Notifications */}
          <div className="glass-card rounded-2xl p-6 mb-8">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-accent flex items-center justify-center">
                  {notifPrefs.enabled ? (
                    <Bell className="w-6 h-6 text-primary" />
                  ) : (
                    <BellOff className="w-6 h-6 text-muted-foreground" />
                  )}
                </div>
                <div>
                  <h2 className="font-display font-bold text-lg">
                    Notifications de rappel
                  </h2>
                  <p className="text-sm text-muted-foreground">
                    Recevez un rappel 12h et 5 min avant chaque tâche planifiée
                  </p>
                  {permissionState === "denied" && (
                    <p className="text-xs text-destructive mt-1">
                      Les notifications sont bloquées dans votre navigateur. Autorisez-les dans les paramètres.
                    </p>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2">
                {notifPrefs.enabled && (
                  <span className="text-xs font-medium text-primary bg-primary/10 px-2.5 py-1 rounded-full">
                    Actif
                  </span>
                )}
                <Switch
                  checked={notifPrefs.enabled}
                  onCheckedChange={toggleNotifications}
                  disabled={notifLoading || permissionState === "denied"}
                />
              </div>
            </div>
          </div>

          {/* External calendars */}
          <h2 className="font-display font-bold text-lg mb-4">
            Calendriers externes
          </h2>
          <p className="text-sm text-muted-foreground mb-6">
            Activez un calendrier pour générer un lien ICS compatible. Vos
            tâches et événements seront synchronisés automatiquement.
          </p>

          {loading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
            </div>
          ) : (
            <div className="grid gap-3">
              {CALENDARS.map((cal, i) => {
                const enabled = isEnabled(cal.id);
                return (
                  <motion.div
                    key={cal.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.04 }}
                    className="glass-card rounded-xl p-4 flex items-center justify-between"
                  >
                    <div className="flex items-center gap-3">
                      <CalendarIcon cal={cal} />
                      <div>
                        <span className="font-semibold text-sm">
                          {cal.name}
                        </span>
                        {enabled && (
                          <span className="ml-2 text-xs text-primary bg-primary/10 px-2 py-0.5 rounded-full">
                            Connecté
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      {enabled && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-xs"
                          onClick={() => setSelectedCal(cal)}
                        >
                          <ExternalLink className="w-3.5 h-3.5 mr-1" />
                          Instructions
                        </Button>
                      )}
                      <Switch
                        checked={enabled}
                        onCheckedChange={() => toggleIntegration(cal.id)}
                      />
                    </div>
                  </motion.div>
                );
              })}
            </div>
          )}
        </motion.div>
      </div>

      {/* Instructions dialog */}
      <Dialog
        open={!!selectedCal}
        onOpenChange={(open) => !open && setSelectedCal(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {selectedCal && <CalendarIcon cal={selectedCal} />}
              {selectedCal?.name}
            </DialogTitle>
            <DialogDescription>
              {selectedCal?.instructions}
            </DialogDescription>
          </DialogHeader>

          {selectedCal && (
            <div className="mt-4 space-y-3">
              <label className="text-sm font-medium">Lien ICS</label>
              <div className="flex gap-2">
                <code className="flex-1 bg-muted rounded-lg px-3 py-2 text-xs break-all">
                  {getICSUrl(selectedCal.id) || "Activez l'intégration d'abord"}
                </code>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => copyICS(selectedCal.id)}
                  disabled={!getICSUrl(selectedCal.id)}
                >
                  {copied ? (
                    <Check className="w-4 h-4" />
                  ) : (
                    <Copy className="w-4 h-4" />
                  )}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
