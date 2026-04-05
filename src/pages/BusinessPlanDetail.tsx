import { useState, useEffect, useCallback } from "react";
import { useParams, Link } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowLeft, Loader2, Sparkles, Save, Share2, Download, ChevronDown, ChevronRight, PenLine, Eye, FileText, BarChart3, Plus, Wand2 } from "lucide-react";
import ReactMarkdown from "react-markdown";
import Navbar from "@/components/layout/Navbar";
import { useBusinessPlans, BPSectionRow } from "@/hooks/useBusinessPlans";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import ShareBusinessPlanModal from "@/components/ShareBusinessPlanModal";
import { exportBusinessPlanPDF } from "@/lib/pdfExport";
import BPChartEditor, { ChartConfig, ChartDataPoint } from "@/components/BPChartEditor";
import BPChartRenderer from "@/components/BPChartRenderer";

const SECTION_TYPES = [
  { type: "executive_summary", title: "Résumé exécutif", icon: "📋" },
  { type: "market_analysis", title: "Analyse de marché", icon: "📊" },
  { type: "business_strategy", title: "Stratégie commerciale", icon: "🎯" },
  { type: "financial_plan", title: "Plan financier", icon: "💰" },
  { type: "best_practices", title: "Meilleures pratiques du secteur", icon: "⭐" },
];

export default function BusinessPlanDetail() {
  const { id } = useParams<{ id: string }>();
  const { fetchPlanWithSections, updateSection, upsertSections, addSection, updatePlanStatus } = useBusinessPlans();
  const [plan, setPlan] = useState<any>(null);
  const [sections, setSections] = useState<BPSectionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [generatingFull, setGeneratingFull] = useState(false);
  const [generatingSection, setGeneratingSection] = useState<string | null>(null);
  const [activeSection, setActiveSection] = useState<string | null>(null);
  const [editMode, setEditMode] = useState<Record<string, boolean>>({});
  const [editContent, setEditContent] = useState<Record<string, string>>({});
  const [showShare, setShowShare] = useState(false);
  const [charts, setCharts] = useState<Record<string, { id: string; chart_type: string; title: string; chart_data: ChartDataPoint[]; sort_order: number }[]>>({});
  const [showChartEditor, setShowChartEditor] = useState(false);
  const [editingChart, setEditingChart] = useState<ChartConfig | null>(null);
  const [generatingCharts, setGeneratingCharts] = useState(false);

  const loadCharts = useCallback(async (sectionIds: string[]) => {
    if (sectionIds.length === 0) return;
    const { data } = await supabase
      .from("business_plan_charts")
      .select("*")
      .in("section_id", sectionIds)
      .order("sort_order");
    if (data) {
      const grouped: Record<string, { id: string; chart_type: string; title: string; chart_data: ChartDataPoint[]; sort_order: number }[]> = {};
      data.forEach((c: any) => {
        if (!grouped[c.section_id]) grouped[c.section_id] = [];
        grouped[c.section_id].push({
          id: c.id,
          chart_type: c.chart_type,
          title: c.title,
          chart_data: (c.chart_data || []) as ChartDataPoint[],
          sort_order: c.sort_order,
        });
      });
      setCharts(grouped);
    }
  }, []);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    const data = await fetchPlanWithSections(id);
    if (data) {
      setPlan(data.plan);
      setSections(data.sections);
      if (data.sections.length > 0 && !activeSection) {
        setActiveSection(data.sections[0].section_type);
      }
      await loadCharts(data.sections.map(s => s.id));
    }
    setLoading(false);
  }, [id, fetchPlanWithSections, activeSection, loadCharts]);

  useEffect(() => { load(); }, [id]);

  const saveChart = async (config: ChartConfig) => {
    const currentSec = sections.find(s => s.section_type === activeSection);
    if (!currentSec) return;

    if (config.id) {
      await supabase.from("business_plan_charts").update({
        chart_type: config.chart_type,
        title: config.title,
        chart_data: config.chart_data as any,
      }).eq("id", config.id);
    } else {
      const currentCharts = charts[currentSec.id] || [];
      await supabase.from("business_plan_charts").insert({
        section_id: currentSec.id,
        chart_type: config.chart_type,
        title: config.title,
        chart_data: config.chart_data as any,
        sort_order: currentCharts.length,
      });
    }
    setShowChartEditor(false);
    setEditingChart(null);
    await loadCharts(sections.map(s => s.id));
    toast.success(config.id ? "Graphique mis à jour" : "Graphique ajouté");
  };

  const deleteChart = async (chartId: string) => {
    await supabase.from("business_plan_charts").delete().eq("id", chartId);
    await loadCharts(sections.map(s => s.id));
    toast.success("Graphique supprimé");
  };

  const autoGenerateCharts = async () => {
    if (!plan || !currentSectionForCharts) return;
    const section = currentSectionForCharts;
    if (!section.content || section.content.length < 50) {
      toast.error("Le contenu de la section est trop court pour générer des graphiques");
      return;
    }
    setGeneratingCharts(true);
    try {
      const { data, error } = await supabase.functions.invoke("generate-bp-charts", {
        body: {
          sectionContent: section.content,
          sectionType: section.section_type,
          projectTitle: plan.title,
        },
      });
      if (error) throw error;
      if (data?.charts && Array.isArray(data.charts)) {
        const existingCharts = charts[section.id] || [];
        const startOrder = existingCharts.length;
        for (let i = 0; i < data.charts.length; i++) {
          const c = data.charts[i];
          await supabase.from("business_plan_charts").insert({
            section_id: section.id,
            chart_type: c.chart_type,
            title: c.title,
            chart_data: c.chart_data as any,
            sort_order: startOrder + i,
          });
        }
        await loadCharts(sections.map(s => s.id));
        toast.success(`${data.charts.length} graphique(s) généré(s) avec succès !`);
      }
    } catch (e: any) {
      toast.error(e?.message || "Erreur lors de la génération des graphiques");
    }
    setGeneratingCharts(false);
  };

  const generateFull = async () => {
    if (!plan) return;
    setGeneratingFull(true);
    try {
      const { data, error } = await supabase.functions.invoke("generate-business-plan", {
        body: { projectDescription: plan.description, projectTitle: plan.title, mode: "full" },
      });
      if (error) throw error;
      if (data?.result?.sections) {
        const secs = data.result.sections.map((s: any, i: number) => ({
          section_type: s.type,
          title: s.title,
          content: s.content,
          sort_order: i,
        }));
        await upsertSections(plan.id, secs);
        await updatePlanStatus(plan.id, "in_progress");
        toast.success("Business plan généré avec succès !");
        await load();
      }
    } catch (e: any) {
      toast.error(e?.message || "Erreur lors de la génération");
    }
    setGeneratingFull(false);
  };

  const generateSingle = async (sectionType: string) => {
    if (!plan) return;
    setGeneratingSection(sectionType);
    try {
      const existingSections = sections.map(s => ({ title: s.title, content: s.content }));
      const { data, error } = await supabase.functions.invoke("generate-business-plan", {
        body: { projectDescription: plan.description, projectTitle: plan.title, mode: "section", sectionType, existingSections },
      });
      if (error) throw error;
      if (data?.result) {
        const existing = sections.find(s => s.section_type === sectionType);
        if (existing) {
          await updateSection(existing.id, data.result.content);
        } else {
          const info = SECTION_TYPES.find(s => s.type === sectionType);
          await addSection(plan.id, sectionType, data.result.title || info?.title || "", data.result.content, SECTION_TYPES.findIndex(s => s.type === sectionType));
        }
        toast.success("Section générée !");
        await load();
        setActiveSection(sectionType);
      }
    } catch (e: any) {
      toast.error(e?.message || "Erreur lors de la génération");
    }
    setGeneratingSection(null);
  };

  const handleSave = async (sectionId: string) => {
    if (editContent[sectionId] !== undefined) {
      await updateSection(sectionId, editContent[sectionId]);
      toast.success("Section sauvegardée");
      setEditMode(prev => ({ ...prev, [sectionId]: false }));
      await load();
    }
  };

  const exportPDF = async () => {
    try {
      await exportBusinessPlanPDF({
        title: plan.title,
        description: plan.description,
        sections: sections.map(s => ({
          section_type: s.section_type,
          title: s.title,
          content: s.content,
          sort_order: s.sort_order,
          charts: (charts[s.id] || []).map(c => ({
            chart_type: c.chart_type as "bar" | "pie",
            title: c.title,
            chart_data: c.chart_data,
          })),
        })),
        status: plan.status,
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

  if (!plan) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="container pt-24 text-center">
          <p className="text-muted-foreground">Business plan introuvable</p>
          <Link to="/business-plans" className="text-primary underline mt-2 inline-block">Retour</Link>
        </div>
      </div>
    );
  }

  const currentSection = sections.find(s => s.section_type === activeSection);

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="container pt-24 pb-12">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <Link to="/business-plans" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-2">
              <ArrowLeft className="w-4 h-4" />
              Retour aux business plans
            </Link>
            <h1 className="text-2xl font-display font-black">{plan.title}</h1>
            {plan.description && <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{plan.description}</p>}
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => setShowShare(true)} className="gap-1.5">
              <Share2 className="w-4 h-4" /> Partager
            </Button>
            {sections.length > 0 && (
              <Button variant="outline" size="sm" onClick={exportPDF} className="gap-1.5">
                <Download className="w-4 h-4" /> PDF
              </Button>
            )}
          </div>
        </div>

        {/* Generation buttons */}
        {sections.length === 0 && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="glass-card rounded-2xl p-8 text-center mb-8">
            <FileText className="w-12 h-12 text-primary/40 mx-auto mb-4" />
            <h2 className="text-xl font-semibold mb-2">Générer votre business plan</h2>
            <p className="text-muted-foreground mb-6 max-w-lg mx-auto">
              Choisissez de générer le business plan complet en une fois, ou section par section pour plus de contrôle.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
              <Button onClick={generateFull} disabled={generatingFull} className="gap-2 gradient-bg text-primary-foreground font-bold px-6">
                {generatingFull ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                Générer tout le business plan
              </Button>
              <span className="text-muted-foreground text-sm">ou</span>
              <p className="text-sm text-muted-foreground">Générez section par section ci-dessous</p>
            </div>
          </motion.div>
        )}

        <div className="grid lg:grid-cols-[280px_1fr] gap-6">
          {/* Sidebar - sections */}
          <div className="space-y-2">
            {sections.length > 0 && (
              <Button onClick={generateFull} disabled={generatingFull} variant="outline" size="sm" className="w-full gap-1.5 mb-4">
                {generatingFull ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                Regénérer tout
              </Button>
            )}
            {SECTION_TYPES.map((st) => {
              const exists = sections.find(s => s.section_type === st.type);
              const isActive = activeSection === st.type;
              return (
                <button
                  key={st.type}
                  onClick={() => setActiveSection(st.type)}
                  className={`w-full text-left px-4 py-3 rounded-xl text-sm transition-all flex items-center gap-3 ${
                    isActive ? "bg-primary/10 text-primary font-semibold" : "hover:bg-muted"
                  }`}
                >
                  <span className="text-lg">{st.icon}</span>
                  <span className="flex-1">{st.title}</span>
                  {exists ? (
                    <ChevronRight className="w-4 h-4 text-muted-foreground" />
                  ) : (
                    <button
                      onClick={(e) => { e.stopPropagation(); generateSingle(st.type); }}
                      disabled={generatingSection === st.type}
                      className="text-xs text-primary hover:underline"
                    >
                      {generatingSection === st.type ? <Loader2 className="w-3 h-3 animate-spin" /> : "Générer"}
                    </button>
                  )}
                </button>
              );
            })}
          </div>

          {/* Content area */}
          <div className="glass-card rounded-2xl p-6 min-h-[500px]">
            {currentSection ? (
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-display font-bold">{currentSection.title}</h2>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setEditingChart(null);
                        setShowChartEditor(true);
                      }}
                      className="gap-1"
                    >
                      <BarChart3 className="w-3 h-3" />
                      Graphique
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => generateSingle(currentSection.section_type)}
                      disabled={!!generatingSection}
                      className="gap-1"
                    >
                      {generatingSection === currentSection.section_type ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
                      Regénérer
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        if (editMode[currentSection.id]) {
                          handleSave(currentSection.id);
                        } else {
                          setEditContent(prev => ({ ...prev, [currentSection.id]: currentSection.content }));
                          setEditMode(prev => ({ ...prev, [currentSection.id]: true }));
                        }
                      }}
                      className="gap-1"
                    >
                      {editMode[currentSection.id] ? (
                        <><Save className="w-3 h-3" /> Sauvegarder</>
                      ) : (
                        <><PenLine className="w-3 h-3" /> Modifier</>
                      )}
                    </Button>
                  </div>
                </div>
                {editMode[currentSection.id] ? (
                  <Textarea
                    value={editContent[currentSection.id] || ""}
                    onChange={e => setEditContent(prev => ({ ...prev, [currentSection.id]: e.target.value }))}
                    className="min-h-[400px] font-mono text-sm"
                  />
                ) : (
                  <div className="prose prose-sm dark:prose-invert max-w-none">
                    <ReactMarkdown>{currentSection.content}</ReactMarkdown>
                  </div>
                )}

                {/* Charts for this section */}
                {(charts[currentSection.id] || []).map(chart => (
                  <BPChartRenderer
                    key={chart.id}
                    id={chart.id}
                    chartType={chart.chart_type as "bar" | "pie"}
                    title={chart.title}
                    data={chart.chart_data}
                    editable
                    onEdit={() => {
                      setEditingChart({
                        id: chart.id,
                        chart_type: chart.chart_type as "bar" | "pie",
                        title: chart.title,
                        chart_data: chart.chart_data,
                      });
                      setShowChartEditor(true);
                    }}
                    onDelete={() => deleteChart(chart.id)}
                  />
                ))}
              </div>
            ) : activeSection ? (
              <div className="flex flex-col items-center justify-center h-full py-20">
                <p className="text-muted-foreground mb-4">Cette section n'a pas encore été générée</p>
                <Button
                  onClick={() => generateSingle(activeSection)}
                  disabled={!!generatingSection}
                  className="gap-2 gradient-bg text-primary-foreground"
                >
                  {generatingSection === activeSection ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                  Générer cette section
                </Button>
              </div>
            ) : (
              <div className="flex items-center justify-center h-full py-20 text-muted-foreground">
                Sélectionnez une section
              </div>
            )}
          </div>
        </div>
      </div>

      {showShare && (
        <ShareBusinessPlanModal
          planId={plan.id}
          planTitle={plan.title}
          currentToken={plan.share_token}
          onClose={() => setShowShare(false)}
        />
      )}

      <BPChartEditor
        open={showChartEditor}
        initial={editingChart}
        onSave={saveChart}
        onClose={() => { setShowChartEditor(false); setEditingChart(null); }}
      />
    </div>
  );
}
