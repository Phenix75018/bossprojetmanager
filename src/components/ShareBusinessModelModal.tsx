import { useState } from "react";
import { Copy, Lock, Share2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useBusinessModels } from "@/hooks/useBusinessModels";
import { toast } from "sonner";

interface Props {
  modelId: string;
  modelTitle: string;
  currentToken: string | null;
  onClose: () => void;
}

export default function ShareBusinessModelModal({ modelId, modelTitle, currentToken, onClose }: Props) {
  const { enableSharing } = useBusinessModels();
  const [password, setPassword] = useState("");
  const [sharing, setSharing] = useState(false);
  const [shareToken, setShareToken] = useState(currentToken);

  const handleShare = async () => {
    setSharing(true);
    const token = await enableSharing(modelId, password || undefined);
    if (token) {
      setShareToken(token);
      toast.success("Lien de partage créé !");
    }
    setSharing(false);
  };

  const shareUrl = shareToken ? `${window.location.origin}/business-model/share/${shareToken}` : "";

  const copyLink = () => {
    navigator.clipboard.writeText(shareUrl);
    toast.success("Lien copié !");
  };

  return (
    <Dialog open onOpenChange={() => onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Share2 className="w-5 h-5 text-primary" />
            Partager "{modelTitle}"
          </DialogTitle>
        </DialogHeader>

        {shareToken ? (
          <div className="space-y-4">
            <div>
              <Label className="text-xs font-medium">Lien de partage</Label>
              <div className="flex gap-2 mt-1">
                <Input value={shareUrl} readOnly className="text-xs" />
                <Button size="sm" variant="outline" onClick={copyLink} className="gap-1 shrink-0">
                  <Copy className="w-3.5 h-3.5" /> Copier
                </Button>
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              Toute personne ayant ce lien pourra consulter votre business model en lecture seule.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Créez un lien public pour partager votre business model en lecture seule.
            </p>
            <div>
              <Label className="text-xs font-medium flex items-center gap-1.5">
                <Lock className="w-3.5 h-3.5" />
                Mot de passe (optionnel)
              </Label>
              <Input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="Protéger par mot de passe"
                className="mt-1"
              />
            </div>
            <Button onClick={handleShare} disabled={sharing} className="w-full gradient-bg text-primary-foreground font-bold">
              {sharing ? "Création..." : "Créer le lien de partage"}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
