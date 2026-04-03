import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Copy, Link2, Lock } from "lucide-react";
import { useBusinessPlans } from "@/hooks/useBusinessPlans";

interface Props {
  planId: string;
  planTitle: string;
  currentToken: string | null;
  onClose: () => void;
}

export default function ShareBusinessPlanModal({ planId, planTitle, currentToken, onClose }: Props) {
  const { enableSharing } = useBusinessPlans();
  const [password, setPassword] = useState("");
  const [usePassword, setUsePassword] = useState(false);
  const [token, setToken] = useState(currentToken);
  const [generating, setGenerating] = useState(false);

  const shareUrl = token ? `${window.location.origin}/business-plan/share/${token}` : "";

  const handleGenerate = async () => {
    setGenerating(true);
    const newToken = await enableSharing(planId, usePassword ? password : undefined);
    if (newToken) {
      setToken(newToken);
      toast.success("Lien de partage créé !");
    }
    setGenerating(false);
  };

  const copyLink = () => {
    navigator.clipboard.writeText(shareUrl);
    toast.success("Lien copié !");
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Partager « {planTitle} »</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          {token ? (
            <div className="space-y-3">
              <Label>Lien de partage</Label>
              <div className="flex gap-2">
                <Input value={shareUrl} readOnly className="text-xs" />
                <Button variant="outline" size="icon" onClick={copyLink}><Copy className="w-4 h-4" /></Button>
              </div>
              <p className="text-xs text-muted-foreground">Toute personne ayant ce lien peut consulter le business plan.</p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <input type="checkbox" id="use-pwd" checked={usePassword} onChange={e => setUsePassword(e.target.checked)} className="rounded" />
                <label htmlFor="use-pwd" className="text-sm flex items-center gap-1"><Lock className="w-3.5 h-3.5" /> Protéger par mot de passe</label>
              </div>
              {usePassword && (
                <Input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Mot de passe" />
              )}
              <Button onClick={handleGenerate} disabled={generating} className="w-full gradient-bg text-primary-foreground gap-2">
                <Link2 className="w-4 h-4" />
                {generating ? "Génération..." : "Créer le lien de partage"}
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
