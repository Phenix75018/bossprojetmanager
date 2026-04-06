import { useState, useEffect, useCallback } from "react";
import { useParams, Link } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowLeft, Loader2, Sparkles, Save, Share2, Download, PenLine, LayoutGrid } from "lucide-react";
import ReactMarkdown from "react-markdown";
import Navbar from "@/components/layout/Navbar";
import { useBusinessModels, BMBlockRow } from "@/hooks/useBusinessModels";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import ShareBusinessModelModal from "@/components/ShareBusinessModelModal";
import { useDocumentVersions } from "@/hooks/useDocumentVersions";
import VersionHistoryPanel from "@/components/VersionHistoryPanel";

const BMC_BLOCKS = [
  { type: "key_partners", title: "Partenaires clés", icon: "🤝", color: "bg-blue-500/10 border-blue-500/30" },
  { type: "key_activities", title: "Activités clés", icon: "⚙️", color: "bg-purple-500/10 border-purple-500/30" },
  { type: "key_resources", title: "Ressources clés", icon: "🏗️", color: "bg-indigo-500/10 border-indigo-500/30" },
  { type: "value_propositions", title: "Propositions de valeur", icon: "💎", color: "bg-amber-500/10 border-amber-500/30" },
  { type: "customer_relationships", title: "Relations clients", icon: "💬", color: "bg-pink-500/10 border-pink-500/30" },
  { type: "channels", title: "Canaux", icon: "📢", color: "bg-cyan-500/10 border-cyan-500/30" },
  { type: "customer_segments", title: "Segments de clientèle", icon: "👥", color: "bg-green-500/10 border-green-500/30" },
  { type: "cost_structure", title: "Structure des coûts", icon: "💸", color: "bg-red-500/10 border-red-500/30" },
  { type: "revenue_streams", title: "Sources de revenus", icon: "💰", color: "bg-emerald-500/10 border-emerald-500/30" },
];

const LEAN_BLOCKS = [
  { type: "problem", title: "Problème", icon: "❗", color: "bg-red-500/10 border-red-500/30" },
  { type: "solution", title: "Solution", icon: "💡", color: "bg-green-500/10 border-green-500/30" },
  { type: "unique_value", title: "Proposition de valeur unique", icon: "💎", color: "bg-amber-500/10 border-amber-500/30" },
  { type: "unfair_advantage", title: "Avantage compétitif", icon: "🛡️", color: "bg-purple-500/10 border-purple-500/30" },
  { type: "customer_segments", title: "Segments de clientèle", icon: "👥", color: "bg-blue-500/10 border-blue-500/30" },
  { type: "key_metrics", title: "Métriques clés", icon: "📊", color: "bg-indigo-500/10 border-indigo-500/30" },
  { type: "channels", title: "Canaux", icon: "📢", color: "bg-cyan-500/10 border-cyan-500/30" },
  { type: "cost_structure", title: "Structure des coûts", icon: "💸", color: "bg-pink-500/10 border-pink-500/30" },
  { type: "revenue_streams", title: "Sources de revenus", icon: "💰", color: "bg-emerald-500/10 border-emerald-500/30" },
];

// BMC Canvas grid layout
const BMC_GRID = [
  // Row 1: 5 columns
  [
    { type: "key_partners", rowSpan: 2 },
    { type: "key_activities", rowSpan: 1 },
    { type: "value_propositions", rowSpan: 2 },
    { type: "customer_relationships", rowSpan: 1 },
    { type: "customer_segments", rowSpan: 2 },
  ],
  // Row 2: fills gaps
  [
    null, // key_partners spans
    { type: "key_resources", rowSpan: 1 },
    null, // value_propositions spans
    { type: "channels", rowSpan: 1 },
    null, // customer_segments spans
  ],
  // Row 3: 2 columns full width
  [
    { type: "cost_structure", colSpan: 2 },
    null,
    { type: "revenue_streams", colSpan: 2 },
    null,
  ],
];

export default function BusinessModelDetail() {
  const { id } = useParams<{ id: string }>();
  const { fetchModelWithBlocks, updateBlock, upsertBlocks, addBlock, updateModelStatus } = useBusinessModels();
  const [model, setModel] = useState<any>(null);
  const [blocks, setBlocks] = useState<BMBlockRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [generatingFull, setGeneratingFull] = useState(false);
  const [generatingBlock, setGeneratingBlock] = useState<string | null>(null);
  const [editMode, setEditMode] = useState<Record<string, boolean>>({});
  const [editContent, setEditContent] = useState<Record<string, string>>({});
  const [showShare, setShowShare] = useState(false);
  const [selectedBlock, setSelectedBlock] = useState<string | null>(null);
  const { versions, saveVersion, deleteVersion } = useDocumentVersions("business_model", id);

  const BLOCKS = model?.framework === "lean" ? LEAN_BLOCKS : BMC_BLOCKS;

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    const data = await fetchModelWithBlocks(id);
    if (data) {
      setModel(data.model);
      setBlocks(data.blocks);
    }
    setLoading(false);
  }, [id, fetchModelWithBlocks]);

  useEffect(() => { load(); }, [id]);

  const generateFull = async () => {
    if (!model) return;
    setGeneratingFull(true);
    try {
      const { data, error } = await supabase.functions.invoke("generate-business-model", {
        body: { projectDescription: model.description, projectTitle: model.title, framework: model.framework, mode: "full" },
      });
      if (error) throw error;
      if (data?.result?.blocks) {
        const blks = data.result.blocks.map((b: any, i: number) => ({
          block_type: b.type,
          title: b.title,
          content: b.content,
          sort_order: i,
        }));
        await upsertBlocks(model.id, blks);
        await updateModelStatus(model.id, "in_progress");
        toast.success("Business model généré avec succès !");
        await load();
      }
    } catch (e: any) {
      toast.error(e?.message || "Erreur lors de la génération");
    }
    setGeneratingFull(false);
  };

  const generateSingle = async (blockType: string) => {
    if (!model) return;
    setGeneratingBlock(blockType);
    try {
      const existingBlocks = blocks.map(b => ({ title: b.title, content: b.content }));
      const { data, error } = await supabase.functions.invoke("generate-business-model", {
        body: { projectDescription: model.description, projectTitle: model.title, framework: model.framework, mode: "block", blockType, existingBlocks },
      });
      if (error) throw error;
      if (data?.result) {
        const existing = blocks.find(b => b.block_type === blockType);
        if (existing) {
          await updateBlock(existing.id, data.result.content);
        } else {
          const info = BLOCKS.find(b => b.type === blockType);
          await addBlock(model.id, blockType, data.result.title || info?.title || "", data.result.content, BLOCKS.findIndex(b => b.type === blockType));
        }
        toast.success("Bloc généré !");
        await load();
      }
    } catch (e: any) {
      toast.error(e?.message || "Erreur lors de la génération");
    }
    setGeneratingBlock(null);
  };

  const handleSave = async (blockId: string) => {
    if (editContent[blockId] !== undefined) {
      await updateBlock(blockId, editContent[blockId]);
      toast.success("Bloc sauvegardé");
      setEditMode(prev => ({ ...prev, [blockId]: false }));
      await load();
    }
  };

  const exportPDF = async () => {
    try {
      const { exportBusinessModelPDF } = await import("@/lib/businessModelPdfExport");
      await exportBusinessModelPDF({
        title: model.title,
        description: model.description,
        framework: model.framework,
        blocks: blocks.map(b => ({ block_type: b.block_type, title: b.title, content: b.content })),
        status: model.status,
      });
      toast.success("PDF exporté !");
    } catch {
      toast.error("Erreur lors de l'export PDF");
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="flex items-center justify-center pt-32"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
      </div>
    );
  }

  if (!model) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="container pt-24 text-center">
          <p className="text-muted-foreground">Business model introuvable</p>
          <Link to="/business-models" className="text-primary underline mt-2 inline-block">Retour</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="container pt-24 pb-12">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <Link to="/business-models" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-2">
              <ArrowLeft className="w-4 h-4" />
              Retour aux business models
            </Link>
            <h1 className="text-2xl font-display font-black">{model.title}</h1>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-xs px-2 py-0.5 rounded-md bg-muted text-muted-foreground font-medium">
                {model.framework === "lean" ? "Lean Canvas" : "Business Model Canvas"}
              </span>
              {model.description && <p className="text-sm text-muted-foreground line-clamp-1">{model.description}</p>}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => setShowShare(true)} className="gap-1.5">
              <Share2 className="w-4 h-4" /> Partager
            </Button>
            {blocks.length > 0 && (
              <Button variant="outline" size="sm" onClick={exportPDF} className="gap-1.5">
                <Download className="w-4 h-4" /> PDF
              </Button>
            )}
            <Button onClick={generateFull} disabled={generatingFull} size="sm" className="gap-1.5 gradient-bg text-primary-foreground font-bold">
              {generatingFull ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
              {blocks.length > 0 ? "Regénérer tout" : "Générer tout"}
            </Button>
          </div>
        </div>

        {/* Canvas Grid */}
        {blocks.length === 0 && !generatingFull ? (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="glass-card rounded-2xl p-8 text-center mb-8">
            <LayoutGrid className="w-12 h-12 text-primary/40 mx-auto mb-4" />
            <h2 className="text-xl font-semibold mb-2">Générer votre business model</h2>
            <p className="text-muted-foreground mb-6 max-w-lg mx-auto">
              Générez le business model complet en un clic ou bloc par bloc ci-dessous.
            </p>
          </motion.div>
        ) : null}

        {/* Canvas view - grid of blocks */}
        <div className={`grid gap-4 ${model.framework === "bmc"
          ? "grid-cols-1 md:grid-cols-5"
          : "grid-cols-1 md:grid-cols-3"
        }`}>
          {BLOCKS.map((blockDef, idx) => {
            const block = blocks.find(b => b.block_type === blockDef.type);
            const isEditing = block ? editMode[block.id] : false;
            const isSelected = selectedBlock === blockDef.type;

            // BMC layout logic
            let gridClass = "";
            if (model.framework === "bmc") {
              if (blockDef.type === "cost_structure") gridClass = "md:col-span-2 lg:col-span-2";
              else if (blockDef.type === "revenue_streams") gridClass = "md:col-span-3 lg:col-span-3";
            }

            return (
              <motion.div
                key={blockDef.type}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.03 }}
                className={`rounded-xl border p-4 cursor-pointer transition-all ${blockDef.color} ${gridClass} ${
                  isSelected ? "ring-2 ring-primary shadow-lg" : "hover:shadow-md"
                }`}
                onClick={() => setSelectedBlock(isSelected ? null : blockDef.type)}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-lg">{blockDef.icon}</span>
                    <h3 className="text-sm font-bold">{blockDef.title}</h3>
                  </div>
                  <div className="flex items-center gap-1">
                    {block && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          if (isEditing) {
                            handleSave(block.id);
                          } else {
                            setEditContent(prev => ({ ...prev, [block.id]: block.content }));
                            setEditMode(prev => ({ ...prev, [block.id]: true }));
                          }
                        }}
                        className="p-1 rounded hover:bg-background/50 transition-colors"
                      >
                        {isEditing ? <Save className="w-3.5 h-3.5 text-primary" /> : <PenLine className="w-3.5 h-3.5 text-muted-foreground" />}
                      </button>
                    )}
                    <button
                      onClick={(e) => { e.stopPropagation(); generateSingle(blockDef.type); }}
                      disabled={generatingBlock === blockDef.type}
                      className="p-1 rounded hover:bg-background/50 transition-colors"
                    >
                      {generatingBlock === blockDef.type ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin text-primary" />
                      ) : (
                        <Sparkles className="w-3.5 h-3.5 text-muted-foreground hover:text-primary" />
                      )}
                    </button>
                  </div>
                </div>

                {block ? (
                  isEditing ? (
                    <Textarea
                      value={editContent[block.id] || ""}
                      onChange={e => setEditContent(prev => ({ ...prev, [block.id]: e.target.value }))}
                      className="text-xs min-h-[120px] font-mono bg-background/50"
                      onClick={e => e.stopPropagation()}
                    />
                  ) : (
                    <div className={`prose prose-xs dark:prose-invert max-w-none text-xs leading-relaxed ${isSelected ? "" : "line-clamp-6"}`}>
                      <ReactMarkdown>{block.content}</ReactMarkdown>
                    </div>
                  )
                ) : (
                  <p className="text-xs text-muted-foreground italic">Cliquez sur ✨ pour générer ce bloc</p>
                )}
              </motion.div>
            );
          })}
        </div>
      </div>

      {showShare && (
        <ShareBusinessModelModal
          modelId={model.id}
          modelTitle={model.title}
          currentToken={model.share_token}
          onClose={() => setShowShare(false)}
        />
      )}
    </div>
  );
}
