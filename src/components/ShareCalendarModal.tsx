import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { Copy, Check, Mail, Link2, Loader2 } from "lucide-react";

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

  const shareUrl = shareToken ? `${window.location.origin}/calendar/share/${shareToken}` : null;

  // Load existing share on open
  const loadShare = async () => {
    if (initialized || !user) return;
    setInitialized(true);
    const { data } = await supabase
      .from("calendar_shares" as any)
      .select("share_token")
      .eq("user_id", user.id)
      .maybeSingle();
    if (data) setShareToken((data as any).share_token);
  };

  if (open && !initialized) loadShare();

  const handleGenerateLink = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const token = crypto.randomUUID();
      const { error } = await supabase
        .from("calendar_shares" as any)
        .upsert({ user_id: user.id, share_token: token } as any, { onConflict: "user_id" });
      if (error) throw error;
      setShareToken(token);
      toast.success("Lien de partage créé !");
    } catch (err: any) {
      toast.error("Erreur lors de la création du lien");
    } finally {
      setLoading(false);
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
          {!shareToken ? (
            <Button onClick={handleGenerateLink} disabled={loading} className="w-full gradient-bg">
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
