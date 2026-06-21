import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { Copy, Check, Mail, Link2, Loader2, Lock } from "lucide-react";

interface ShareCalendarModalProps {
  open: boolean;
  onClose: () => void;
}

export default function ShareCalendarModal({ open, onClose }: ShareCalendarModalProps) {
  const { user } = useAuth();
  const [shareToken, setShareToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [email, setEmail] = useState("");
  const [sendingEmail, setSendingEmail] = useState(false);
  const [initialized, setInitialized] = useState(false);
  const [passwordEnabled, setPasswordEnabled] = useState(false);
  const [password, setPassword] = useState("");
  const [savingPassword, setSavingPassword] = useState(false);

  const shareUrl = shareToken ? `${window.location.origin}/calendar/share/${shareToken}` : null;

  const loadShare = async () => {
    if (initialized || !user) return;
    setInitialized(true);
    // Only fetch the token and a boolean indicating whether a password is set —
    // never read the stored hash back into the client.
    const { data } = await supabase
      .from("calendar_shares" as any)
      .select("share_token, share_password")
      .eq("user_id", user.id)
      .maybeSingle();
    if (data) {
      setShareToken((data as any).share_token);
      if ((data as any).share_password) {
        setPasswordEnabled(true);
        // Do not populate the input with the stored hash. Leave it empty;
        // the user must re-enter a password to change it.
        setPassword("");
      }
    }
  };

  if (open && !initialized) loadShare();

  const handleGenerateLink = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const token = crypto.randomUUID();
      const upsertData: any = { user_id: user.id, share_token: token };
      if (passwordEnabled && password) {
        upsertData.share_password = password;
      }
      const { error } = await supabase
        .from("calendar_shares" as any)
        .upsert(upsertData, { onConflict: "user_id" });
      if (error) throw error;
      setShareToken(token);
      toast.success("Lien de partage créé !");
    } catch (err: any) {
      toast.error("Erreur lors de la création du lien");
    } finally {
      setLoading(false);
    }
  };

  const handleSavePassword = async () => {
    if (!user) return;
    setSavingPassword(true);
    try {
      const { error } = await supabase
        .from("calendar_shares" as any)
        .update({ share_password: passwordEnabled ? password || null : null } as any)
        .eq("user_id", user.id);
      if (error) throw error;
      toast.success(passwordEnabled && password ? "Mot de passe activé" : "Mot de passe désactivé");
    } catch {
      toast.error("Erreur");
    } finally {
      setSavingPassword(false);
    }
  };

  const handleCopy = () => {
    if (!shareUrl) return;
    navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    toast.success("Lien copié !");
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDisableLink = async () => {
    if (!user) return;
    try {
      const { error } = await supabase
        .from("calendar_shares" as any)
        .delete()
        .eq("user_id", user.id);
      if (error) throw error;
      setShareToken(null);
      setPasswordEnabled(false);
      setPassword("");
      toast.success("Lien de partage désactivé");
    } catch {
      toast.error("Erreur");
    }
  };

  const handleSendEmail = async () => {
    if (!email || !shareUrl) return;
    setSendingEmail(true);
    try {
      const { error } = await supabase.functions.invoke("share-plan-email", {
        body: {
          email,
          projectId: null,
          shareUrl,
          projectTitle: "Calendrier partagé",
          senderName: user?.email,
        },
      });
      if (error) throw error;
      toast.success(`Email envoyé à ${email}`);
      setEmail("");
    } catch (err: any) {
      toast.error(err.message || "Erreur lors de l'envoi");
    } finally {
      setSendingEmail(false);
    }
  };

  const handleClose = () => {
    setInitialized(false);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Link2 className="w-5 h-5 text-primary" />
            Partager le calendrier
          </DialogTitle>
          <DialogDescription>
            Partagez votre calendrier avec toutes les tâches et sous-tâches programmées.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 pt-2">
          {/* Password toggle before generating */}
          {!shareToken && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label htmlFor="cal-password-toggle" className="flex items-center gap-2 text-sm cursor-pointer">
                  <Lock className="w-4 h-4 text-muted-foreground" />
                  Protéger par mot de passe
                </Label>
                <Switch id="cal-password-toggle" checked={passwordEnabled} onCheckedChange={setPasswordEnabled} />
              </div>
              {passwordEnabled && (
                <Input type="text" placeholder="Mot de passe" value={password} onChange={(e) => setPassword(e.target.value)} />
              )}
            </div>
          )}

          {!shareToken ? (
            <Button onClick={handleGenerateLink} disabled={loading || (passwordEnabled && !password)} className="w-full gradient-bg">
              {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Link2 className="w-4 h-4 mr-2" />}
              Générer un lien de partage
            </Button>
          ) : (
            <div className="space-y-3">
              <div className="flex gap-2">
                <Input value={shareUrl || ""} readOnly className="text-xs font-mono" />
                <Button variant="outline" size="icon" onClick={handleCopy}>
                  {copied ? <Check className="w-4 h-4 text-teal-600" /> : <Copy className="w-4 h-4" />}
                </Button>
              </div>

              {/* Password section */}
              <div className="border-t border-border pt-3">
                <div className="flex items-center justify-between mb-2">
                  <Label htmlFor="cal-password-toggle-active" className="flex items-center gap-2 text-sm cursor-pointer">
                    <Lock className="w-4 h-4 text-muted-foreground" />
                    Protéger par mot de passe
                  </Label>
                  <Switch id="cal-password-toggle-active" checked={passwordEnabled} onCheckedChange={(v) => { setPasswordEnabled(v); if (!v) { setPassword(""); handleSavePassword(); } }} />
                </div>
                {passwordEnabled && (
                  <div className="flex gap-2">
                    <Input type="text" placeholder="Mot de passe" value={password} onChange={(e) => setPassword(e.target.value)} />
                    <Button variant="outline" onClick={handleSavePassword} disabled={savingPassword || !password}>
                      {savingPassword ? <Loader2 className="w-4 h-4 animate-spin" /> : "Enregistrer"}
                    </Button>
                  </div>
                )}
              </div>

              {/* Email section */}
              <div className="border-t border-border pt-3">
                <p className="text-sm font-medium mb-2 flex items-center gap-1.5">
                  <Mail className="w-4 h-4 text-primary" />
                  Envoyer par email
                </p>
                <div className="flex gap-2">
                  <Input
                    type="email"
                    placeholder="email@exemple.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleSendEmail()}
                  />
                  <Button onClick={handleSendEmail} disabled={sendingEmail || !email} variant="outline">
                    {sendingEmail ? <Loader2 className="w-4 h-4 animate-spin" /> : "Envoyer"}
                  </Button>
                </div>
              </div>

              <button onClick={handleDisableLink} className="text-xs text-destructive hover:underline w-full text-center pt-1">
                Désactiver le lien de partage
              </button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
