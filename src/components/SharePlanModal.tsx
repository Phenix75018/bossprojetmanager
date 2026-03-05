import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Copy, Check, Mail, Link2, Loader2, Lock } from "lucide-react";

interface SharePlanModalProps {
  open: boolean;
  onClose: () => void;
  projectId: string;
  projectTitle: string;
  shareToken: string | null;
  onTokenGenerated: (token: string) => void;
}

export default function SharePlanModal({ open, onClose, projectId, projectTitle, shareToken, onTokenGenerated }: SharePlanModalProps) {
  const [generating, setGenerating] = useState(false);
  const [copied, setCopied] = useState(false);
  const [email, setEmail] = useState("");
  const [sendingEmail, setSendingEmail] = useState(false);
  const [passwordEnabled, setPasswordEnabled] = useState(false);
  const [password, setPassword] = useState("");
  const [savingPassword, setSavingPassword] = useState(false);

  const shareUrl = shareToken ? `${window.location.origin}/share/${shareToken}` : null;

  const handleGenerateLink = async () => {
    setGenerating(true);
    try {
      const token = crypto.randomUUID();
      const updateData: any = { share_token: token };
      if (passwordEnabled && password) {
        updateData.share_password = password;
      }
      const { error } = await supabase
        .from("projects")
        .update(updateData)
        .eq("id", projectId);
      if (error) throw error;
      onTokenGenerated(token);
      toast.success("Lien de partage créé !");
    } catch (err: any) {
      toast.error("Erreur lors de la création du lien");
    } finally {
      setGenerating(false);
    }
  };

  const handleSavePassword = async () => {
    setSavingPassword(true);
    try {
      const { error } = await supabase
        .from("projects")
        .update({ share_password: passwordEnabled ? password || null : null } as any)
        .eq("id", projectId);
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
    try {
      const { error } = await supabase
        .from("projects")
        .update({ share_token: null, share_password: null } as any)
        .eq("id", projectId);
      if (error) throw error;
      onTokenGenerated("");
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
      const { data, error } = await supabase.functions.invoke("share-plan-email", {
        body: { email, projectId, shareUrl, projectTitle },
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

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Link2 className="w-5 h-5 text-primary" />
            Partager le plan
          </DialogTitle>
          <DialogDescription>
            Partagez votre plan d'action en lecture seule par lien ou par email.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 pt-2">
          {/* Password toggle - shown before generating */}
          {!shareToken && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label htmlFor="plan-password-toggle" className="flex items-center gap-2 text-sm cursor-pointer">
                  <Lock className="w-4 h-4 text-muted-foreground" />
                  Protéger par mot de passe
                </Label>
                <Switch id="plan-password-toggle" checked={passwordEnabled} onCheckedChange={setPasswordEnabled} />
              </div>
              {passwordEnabled && (
                <Input
                  type="text"
                  placeholder="Mot de passe"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              )}
            </div>
          )}

          {/* Link section */}
          {!shareToken ? (
            <Button onClick={handleGenerateLink} disabled={generating || (passwordEnabled && !password)} className="w-full gradient-bg">
              {generating ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Link2 className="w-4 h-4 mr-2" />}
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
                  <Label htmlFor="plan-password-toggle-active" className="flex items-center gap-2 text-sm cursor-pointer">
                    <Lock className="w-4 h-4 text-muted-foreground" />
                    Protéger par mot de passe
                  </Label>
                  <Switch id="plan-password-toggle-active" checked={passwordEnabled} onCheckedChange={(v) => { setPasswordEnabled(v); if (!v) { setPassword(""); handleSavePassword(); } }} />
                </div>
                {passwordEnabled && (
                  <div className="flex gap-2">
                    <Input
                      type="text"
                      placeholder="Mot de passe"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                    />
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

              <button
                onClick={handleDisableLink}
                className="text-xs text-destructive hover:underline w-full text-center pt-1"
              >
                Désactiver le lien de partage
              </button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
