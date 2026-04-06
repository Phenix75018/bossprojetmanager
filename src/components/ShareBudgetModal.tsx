import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Copy, Check, Lock } from "lucide-react";

interface ShareBudgetModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onShare: (password?: string) => Promise<string | null>;
  existingToken?: string | null;
}

export default function ShareBudgetModal({ open, onOpenChange, onShare, existingToken }: ShareBudgetModalProps) {
  const [password, setPassword] = useState("");
  const [shareToken, setShareToken] = useState(existingToken || "");
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleShare = async () => {
    setLoading(true);
    const token = await onShare(password || undefined);
    if (token) setShareToken(token);
    setLoading(false);
  };

  const shareUrl = shareToken ? `${window.location.origin}/budget/share/${shareToken}` : "";

  const copyLink = () => {
    navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Partager le budget prévisionnel</DialogTitle>
        </DialogHeader>
        {!shareToken ? (
          <div className="space-y-4">
            <div>
              <Label className="flex items-center gap-2"><Lock className="w-4 h-4" /> Mot de passe (optionnel)</Label>
              <Input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Protéger par mot de passe" />
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => onOpenChange(false)}>Annuler</Button>
              <Button onClick={handleShare} disabled={loading} className="gradient-bg text-primary-foreground">
                {loading ? "Génération..." : "Générer le lien"}
              </Button>
            </DialogFooter>
          </div>
        ) : (
          <div className="space-y-4">
            <div>
              <Label>Lien de partage</Label>
              <div className="flex gap-2 mt-1">
                <Input value={shareUrl} readOnly className="text-xs" />
                <Button size="icon" variant="outline" onClick={copyLink}>
                  {copied ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
                </Button>
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
