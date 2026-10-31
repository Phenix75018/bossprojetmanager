import { useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import jsPDF from "jspdf";
import { ArrowLeft, Loader2, Sparkles, RefreshCw, Pencil, Save, FileDown, FileText, Square } from "lucide-react";
import Navbar from "@/components/layout/Navbar";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { Slider } from "@/components/ui/slider";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import {
  DEFAULT_CONFIG, FRAMEWORKS, SECTION_CATALOG, completion, orderedSections,
  type MarketStudyConfig, type MarketStudySection,
} from "@/lib/marketStudy";

export default function MarketStudyDetail() {
  const { id } = useParams();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [config, setConfig] = useState<MarketStudyConfig>(DEFAULT_CONFIG);
  const [sections, setSections] = useState<MarketStudySection[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const stopRef = useRef(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [tab, setTab] = useState("config");

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("market_studies").select("*").eq("id", id!).single();
      if (data) {
        setTitle(data.title);
        setDescription(data.description);
        setConfig({ ...DEFAULT_CONFIG, ...(data.config as any) });
        setSections((data.sections as any) ?? []);
        if (((data.sections as any) ?? []).length) setTab("report");
      }
      setLoading(false);
    })();
  }, [id]);

  const persist = async (patch: Record<string, unknown>) => {
    const { error } = await supabase.from("market_studies").update(patch as any).eq("id", id!);
    if (error) toast.error("Enregistrement impossible");
  };

  const saveConfig = async () => {
    await persist({ title, description, config });
    toast.success("Configuration enregistrée");
  };

  const set = <K extends keyof MarketStudyConfig>(k: K, v: MarketStudyConfig[K]) => setConfig((c) => ({ ...c, [k]: v }));
  const toggle = (k: "sections" | "frameworks", v: string) =>
    setConfig((c) => ({ ...c, [k]: c[k].includes(v) ? c[k].filter((x) => x !== v) : [...c[k], v] }));

  const generateOne = async (key: string, current: MarketStudySection[]) => {
    const meta = SECTION_CATALOG.find((s) => s.key === key)!;
    setBusyKey(key);
    const previous = current.filter((s) => s.key !== key && s.content).map((s) => ({ title: s.title, content: s.content }));
    const { data, error } = await supabase.functions.invoke("generate-market-study", {
      body: { title, description, config, section: { title: meta.title, brief: meta.brief }, previous },
    });
    setBusyKey(null);
    if (error || !data?.content) {
      toast.error(data?.error || `Échec : ${meta.title}`);
      return null;
    }
    const next = [...current.filter((s) => s.key !== key), { key, title: meta.title, content: data.content, generated_at: new Date().toISOString() }];
    setSections(next);
    await persist({ sections: next, status: "in_progress" });
    return next;
  };

  const generateAll = async (onlyMissing: boolean) => {
    await persist({ title, description, config });
    setTab("report");
    setRunning(true);
    stopRef.current = false;
    let cur = sections;
    for (const s of orderedSections(config.sections)) {
      if (stopRef.current) break;
      if (onlyMissing && cur.some((x) => x.key === s.key && x.content)) continue;
      const res = await generateOne(s.key, cur);
      if (res) cur = res;
    }
    setRunning(false);
    if (!stopRef.current) {
      await persist({ status: "completed" });
      toast.success("Étude de marché terminée");
    }
  };

  const saveEdit = async (key: string) => {
    const next = sections.map((s) => (s.key === key ? { ...s, content: draft } : s));
    setSections(next);
    setEditing(null);
    await persist({ sections: next });
  };

  const ordered = orderedSections(config.sections)
    .map((m) => sections.find((s) => s.key === m.key))
    .filter(Boolean) as MarketStudySection[];
  const pct = completion(config, sections);

  const exportMd = () => {
    const md = `# ${title}\n\n${ordered.map((s) => `## ${s.title}\n\n${s.content}`).join("\n\n")}`;
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([md], { type: "text/markdown" }));
    a.download = `etude-marche-${title.replace(/\W+/g, "-")}.md`;
    a.click();
  };

  const exportPdf = () => {
    const doc = new jsPDF({ unit: "mm", format: "a4" });
    const W = 180; let y = 20;
    const add = (txt: string, size: number, bold = false, gap = 2) => {
      doc.setFont("helvetica", bold ? "bold" : "normal"); doc.setFontSize(size);
      for (const line of doc.splitTextToSize(txt, W)) {
        if (y > 280) { doc.addPage(); y = 20; }
        doc.text(line, 15, y); y += size * 0.45;
      }
      y += gap;
    };
    add(title, 22, true, 4);
    add(`${config.sector} · ${config.geography} · ${config.targetType} · horizon ${config.horizonYears} ans`, 11, false, 2);
    add(`Généré le ${new Date().toLocaleDateString("fr-FR")}`, 9, false, 6);
    add("Sommaire", 14, true);
    ordered.forEach((s, i) => add(`${i + 1}. ${s.title}`, 10, false, 0));
    for (const [i, s] of ordered.entries()) {
      doc.addPage(); y = 20;
      add(`${i + 1}. ${s.title}`, 16, true, 4);
      for (const raw of s.content.split("\n")) {
        const l = raw.replace(/\*\*/g, "").replace(/`/g, "");
        if (/^\s*\|?\s*:?-{3,}/.test(l)) continue;
        if (l.startsWith("### ")) add(l.slice(4), 12, true);
        else if (l.startsWith("## ")) add(l.slice(3), 13, true);
        else if (l.startsWith("|")) add(l.split("|").filter((c) => c.trim()).map((c) => c.trim()).join("  ·  "), 9, false, 0.5);
        else if (l.trim()) add(l.replace(/^\s*[-*]\s+/, "• "), 10, false, 1);
        else y += 2;
      }
    }
    doc.save(`etude-marche-${title.replace(/\W+/g, "-")}.pdf`);
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="container pt-24 pb-12 max-w-5xl">
        <Link to="/market-studies" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-2">
          <ArrowLeft className="w-4 h-4" /> Toutes les études
        </Link>
        <div className="flex flex-wrap items-end justify-between gap-4 mb-6">
          <div>
            <h1 className="text-3xl font-display font-black">{title}</h1>
            <p className="text-muted-foreground text-sm">{config.sector || "Secteur à préciser"} · {config.geography} · {pct}% rédigé</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {running ? (
              <Button variant="outline" onClick={() => (stopRef.current = true)} className="gap-2"><Square className="w-4 h-4" /> Arrêter</Button>
            ) : (
              <>
                <Button onClick={() => generateAll(false)} disabled={!config.sections.length} className="gap-2 gradient-bg text-primary-foreground">
                  <Sparkles className="w-4 h-4" /> {sections.length ? "Tout régénérer" : "Lancer l'étude"}
                </Button>
                {sections.length > 0 && pct < 100 && (
                  <Button variant="outline" onClick={() => generateAll(true)}>Compléter les sections manquantes</Button>
                )}
              </>
            )}
            <Button variant="outline" onClick={exportPdf} disabled={!ordered.length} className="gap-2"><FileDown className="w-4 h-4" /> PDF</Button>
            <Button variant="outline" onClick={exportMd} disabled={!ordered.length} className="gap-2"><FileText className="w-4 h-4" /> Markdown</Button>
          </div>
        </div>
        {(running || pct > 0) && <Progress value={pct} className="mb-6" />}

        <Tabs value={tab} onValueChange={setTab}>
          <TabsList><TabsTrigger value="config">Configuration</TabsTrigger><TabsTrigger value="report">Rapport ({ordered.length})</TabsTrigger></TabsList>

          <TabsContent value="config" className="space-y-6 mt-6">
            <div className="glass-card rounded-2xl p-6 grid md:grid-cols-2 gap-4">
              <div className="md:col-span-2"><Label>Titre</Label><Input value={title} onChange={(e) => setTitle(e.target.value)} /></div>
              <div className="md:col-span-2"><Label>Produit / projet étudié</Label><Textarea rows={3} value={description} onChange={(e) => setDescription(e.target.value)} /></div>
              <div><Label>Secteur / domaine</Label><Input value={config.sector} onChange={(e) => set("sector", e.target.value)} placeholder="N'importe quel domaine" /></div>
              <div><Label>Zone géographique</Label><Input value={config.geography} onChange={(e) => set("geography", e.target.value)} placeholder="France, Europe, Monde, Île-de-France…" /></div>
              <div><Label>Type de cible</Label>
                <Select value={config.targetType} onValueChange={(v) => set("targetType", v as any)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{["B2C", "B2B", "B2B2C", "B2G"].map((v) => <SelectItem key={v} value={v}>{v}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label>Niveau de profondeur</Label>
                <Select value={config.depth} onValueChange={(v) => set("depth", v as any)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="standard">Standard (~800 mots / section)</SelectItem>
                    <SelectItem value="approfondie">Approfondie (~1 300 mots / section)</SelectItem>
                    <SelectItem value="experte">Experte (~2 000 mots, raisonnement renforcé)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div><Label>Horizon de prévision : {config.horizonYears} ans</Label>
                <Slider min={1} max={10} step={1} value={[config.horizonYears]} onValueChange={([v]) => set("horizonYears", v)} className="mt-3" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Devise</Label>
                  <Select value={config.currency} onValueChange={(v) => set("currency", v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{["EUR", "USD", "GBP", "CHF", "CAD", "XOF", "MAD"].map((v) => <SelectItem key={v} value={v}>{v}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div><Label>Langue</Label>
                  <Select value={config.language} onValueChange={(v) => set("language", v as any)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent><SelectItem value="fr">Français</SelectItem><SelectItem value="en">English</SelectItem></SelectContent>
                  </Select>
                </div>
              </div>
              <div><Label>Public du rapport</Label><Input value={config.audience} onChange={(e) => set("audience", e.target.value)} /></div>
              <div><Label>Concurrents connus</Label><Input value={config.competitors} onChange={(e) => set("competitors", e.target.value)} placeholder="Séparés par des virgules" /></div>
              <div className="md:col-span-2"><Label>Objectifs & questions clés</Label><Textarea rows={3} value={config.objectives} onChange={(e) => set("objectives", e.target.value)} placeholder="Ex : valider le prix, choisir la ville d'implantation, convaincre une banque…" /></div>
            </div>

            <div className="glass-card rounded-2xl p-6">
              <h3 className="font-display font-bold mb-3">Cadres d'analyse</h3>
              <div className="flex flex-wrap gap-4">
                {FRAMEWORKS.map((f) => (
                  <label key={f} className="flex items-center gap-2 text-sm"><Checkbox checked={config.frameworks.includes(f)} onCheckedChange={() => toggle("frameworks", f)} />{f}</label>
                ))}
              </div>
            </div>

            <div className="glass-card rounded-2xl p-6">
              <div className="flex justify-between items-center mb-3">
                <h3 className="font-display font-bold">Sections du rapport ({config.sections.length}/{SECTION_CATALOG.length})</h3>
                <div className="flex gap-2">
                  <Button size="sm" variant="ghost" onClick={() => set("sections", SECTION_CATALOG.map((s) => s.key))}>Tout</Button>
                  <Button size="sm" variant="ghost" onClick={() => set("sections", [])}>Aucune</Button>
                </div>
              </div>
              <div className="grid md:grid-cols-2 gap-3">
                {SECTION_CATALOG.map((s) => (
                  <label key={s.key} className="flex gap-2 text-sm items-start">
                    <Checkbox className="mt-0.5" checked={config.sections.includes(s.key)} onCheckedChange={() => toggle("sections", s.key)} />
                    <span><span className="font-medium">{s.title}</span><br /><span className="text-muted-foreground text-xs">{s.brief}</span></span>
                  </label>
                ))}
              </div>
            </div>
            <div className="flex justify-end"><Button onClick={saveConfig} className="gap-2"><Save className="w-4 h-4" /> Enregistrer la configuration</Button></div>
          </TabsContent>

          <TabsContent value="report" className="space-y-6 mt-6">
            {orderedSections(config.sections).map((m, i) => {
              const s = sections.find((x) => x.key === m.key);
              const busy = busyKey === m.key;
              return (
                <section key={m.key} id={m.key} className="glass-card rounded-2xl p-6">
                  <div className="flex justify-between items-center gap-2 mb-4">
                    <h2 className="font-display text-xl font-bold">{i + 1}. {m.title}</h2>
                    <div className="flex gap-1">
                      {s && editing !== m.key && (
                        <Button size="icon" variant="ghost" aria-label="Modifier" onClick={() => { setEditing(m.key); setDraft(s.content); }}><Pencil className="w-4 h-4" /></Button>
                      )}
                      <Button size="icon" variant="ghost" aria-label="Régénérer" disabled={running || !!busyKey} onClick={() => generateOne(m.key, sections)}>
                        {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                      </Button>
                    </div>
                  </div>
                  {editing === m.key ? (
                    <div className="space-y-2">
                      <Textarea rows={18} value={draft} onChange={(e) => setDraft(e.target.value)} className="font-mono text-xs" />
                      <div className="flex justify-end gap-2">
                        <Button variant="outline" onClick={() => setEditing(null)}>Annuler</Button>
                        <Button onClick={() => saveEdit(m.key)}>Enregistrer</Button>
                      </div>
                    </div>
                  ) : s ? (
                    <div className="prose prose-sm dark:prose-invert max-w-none prose-table:text-xs prose-th:border prose-td:border prose-th:px-2 prose-td:px-2 overflow-x-auto">
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>{s.content}</ReactMarkdown>
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">{busy ? "Rédaction en cours…" : "Pas encore rédigée."}</p>
                  )}
                </section>
              );
            })}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
