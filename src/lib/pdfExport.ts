import jsPDF from "jspdf";
import html2canvas from "html2canvas";

async function renderToPdf(container: HTMLElement, filename: string) {
  const canvas = await html2canvas(container, { scale: 2, useCORS: true });
  const imgData = canvas.toDataURL("image/png");
  const pdf = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });
  const pageWidth = pdf.internal.pageSize.getWidth() - 20;
  const pageHeight = pdf.internal.pageSize.getHeight() - 20;
  const imgWidth = pageWidth;
  const imgHeight = (canvas.height * imgWidth) / canvas.width;
  let heightLeft = imgHeight;
  let position = 10;

  pdf.addImage(imgData, "PNG", 10, position, imgWidth, imgHeight);
  heightLeft -= pageHeight;

  while (heightLeft > 0) {
    position = heightLeft - imgHeight + 10;
    pdf.addPage();
    pdf.addImage(imgData, "PNG", 10, position, imgWidth, imgHeight);
    heightLeft -= pageHeight;
  }

  pdf.save(filename);
}

const PDF_STYLES = `
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; color: #1a1a1a; line-height: 1.5; }
    .pdf-container { padding: 40px; max-width: 800px; margin: 0 auto; }
    h1 { font-size: 24px; font-weight: 800; margin-bottom: 4px; }
    h2 { font-size: 18px; font-weight: 700; margin-top: 24px; margin-bottom: 8px; color: #333; border-bottom: 2px solid #e5e5e5; padding-bottom: 4px; }
    h3 { font-size: 15px; font-weight: 600; margin-top: 16px; margin-bottom: 4px; }
    h4 { font-size: 13px; font-weight: 600; margin-top: 10px; margin-bottom: 2px; }
    p { font-size: 12px; color: #555; margin-bottom: 6px; }
    .subtitle { font-size: 13px; color: #777; margin-bottom: 16px; }
    .meta { font-size: 11px; color: #999; margin-bottom: 24px; }
    .phase { margin-bottom: 20px; page-break-inside: avoid; }
    .task { padding: 10px 12px; margin-bottom: 6px; background: #fafafa; border-radius: 6px; border-left: 3px solid #6366f1; }
    .task-title { font-size: 13px; font-weight: 600; }
    .task-meta { font-size: 11px; color: #888; margin-top: 2px; }
    .subtask { padding: 4px 0 4px 16px; font-size: 12px; color: #555; border-left: 2px solid #e5e5e5; margin-left: 12px; margin-top: 2px; }
    .subtask-duration { font-size: 10px; color: #999; }
    .badge { display: inline-block; font-size: 10px; font-weight: 600; padding: 2px 8px; border-radius: 10px; margin-right: 4px; }
    .badge-critical { background: #fee2e2; color: #dc2626; }
    .badge-high { background: #fef3c7; color: #d97706; }
    .badge-normal { background: #e0e7ff; color: #4f46e5; }
    .badge-done { background: #d1fae5; color: #059669; }
    .badge-inprogress { background: #dbeafe; color: #2563eb; }
    .badge-todo { background: #f3f4f6; color: #6b7280; }
    .status-icon { margin-right: 4px; }
    .rec-card { padding: 12px; margin-bottom: 8px; background: #fafafa; border-radius: 6px; border: 1px solid #e5e5e5; }
    .rec-role { font-size: 14px; font-weight: 600; }
    .rec-desc { font-size: 12px; color: #666; margin-top: 2px; }
    .skill-tag { display: inline-block; font-size: 10px; background: #f3f4f6; color: #555; padding: 2px 6px; border-radius: 4px; margin: 2px 2px 0 0; }
    .alt-card { padding: 10px; margin: 6px 0 6px 16px; background: #f9fafb; border-radius: 6px; border: 1px solid #e5e5e5; }
    .alt-title { font-size: 12px; font-weight: 600; }
    .alt-detail { font-size: 11px; color: #666; }
    .pros { color: #059669; }
    .cons { color: #dc2626; }
    .explanation-section { margin-top: 6px; padding: 10px; background: #f0f4ff; border-radius: 6px; font-size: 12px; line-height: 1.6; }
    .explanation-section h1, .explanation-section h2, .explanation-section h3, .explanation-section h4 { margin-top: 8px; }
    .explanation-section ul, .explanation-section ol { padding-left: 20px; margin: 4px 0; }
    .explanation-section li { font-size: 12px; margin-bottom: 2px; }
    .page-break { page-break-before: always; }
  </style>
`;

const priorityBadge = (p: string) => {
  const map: Record<string, { label: string; cls: string }> = {
    P0: { label: "Critique", cls: "badge-critical" },
    P1: { label: "Haute", cls: "badge-high" },
    P2: { label: "Normale", cls: "badge-normal" },
  };
  const cfg = map[p] || map.P2;
  return `<span class="badge ${cfg.cls}">${p} - ${cfg.label}</span>`;
};

const statusBadge = (s: string) => {
  const map: Record<string, { label: string; cls: string }> = {
    todo: { label: "À faire", cls: "badge-todo" },
    "in-progress": { label: "En cours", cls: "badge-inprogress" },
    done: { label: "Terminé", cls: "badge-done" },
  };
  const cfg = map[s] || map.todo;
  return `<span class="badge ${cfg.cls}">${cfg.label}</span>`;
};

interface ExportTask {
  id: string;
  title: string;
  description?: string | null;
  priority: string;
  status: string;
  duration_hours: number;
  optional: boolean;
  subtasks: { id: string; title: string; status: string; duration_hours: number }[];
}

interface ExportPhase {
  name: string;
  tasks: ExportTask[];
}

interface ExportRecommendation {
  id: string;
  role: string;
  description: string;
  importance: string;
  skills: string[];
  estimated_monthly_cost?: string | null;
}

interface ExportAlternative {
  type: string;
  title: string;
  description: string;
  duration?: string | null;
  estimated_cost?: string | null;
  pros: string[];
  cons: string[];
  feasibility: string;
}

interface ExportPlanOptions {
  title: string;
  description: string;
  phases: ExportPhase[];
  percent: number;
  totalTasks: number;
  doneTasks: number;
  recommendations?: ExportRecommendation[];
  alternativesByRec?: Record<string, ExportAlternative[]>;
  explanations?: Record<string, string>; // taskId or subtaskId -> explanation
}

function markdownToHtml(md: string): string {
  return md
    .replace(/^### (.+)$/gm, "<h4>$1</h4>")
    .replace(/^## (.+)$/gm, "<h3>$1</h3>")
    .replace(/^# (.+)$/gm, "<h2>$1</h2>")
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    .replace(/^- (.+)$/gm, "<li>$1</li>")
    .replace(/^(\d+)\. (.+)$/gm, "<li>$2</li>")
    .replace(/(<li>.*<\/li>\n?)+/g, (match) => `<ul>${match}</ul>`)
    .replace(/\n\n/g, "<br/>")
    .replace(/\n/g, " ");
}

export async function exportFullPlanPDF(options: ExportPlanOptions) {
  const {
    title, description, phases, percent, totalTasks, doneTasks,
    recommendations, alternativesByRec, explanations,
  } = options;

  const date = new Date().toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });

  let html = `<div class="pdf-container">`;
  html += `<h1>${title}</h1>`;
  html += `<p class="subtitle">${description}</p>`;
  html += `<p class="meta">Exporté le ${date} • ${doneTasks}/${totalTasks} tâches terminées (${percent}%)</p>`;

  // Phases & Tasks
  for (const phase of phases) {
    html += `<h2>${phase.name}</h2>`;
    html += `<div class="phase">`;
    for (const task of phase.tasks) {
      html += `<div class="task">`;
      html += `<div class="task-title">${task.title} ${task.optional ? "(optionnel)" : ""}</div>`;
      html += `<div class="task-meta">${priorityBadge(task.priority)} ${statusBadge(task.status)} • ${task.duration_hours}h</div>`;
      if (task.description) {
        html += `<p style="margin-top:4px;font-size:11px;">${task.description}</p>`;
      }
      // Task explanation
      if (explanations?.[task.id]) {
        html += `<div class="explanation-section">${markdownToHtml(explanations[task.id])}</div>`;
      }
      // Subtasks
      for (const st of task.subtasks) {
        html += `<div class="subtask">${statusBadge(st.status)} ${st.title} <span class="subtask-duration">(${st.duration_hours}h)</span>`;
        if (explanations?.[st.id]) {
          html += `<div class="explanation-section" style="margin-top:4px;">${markdownToHtml(explanations[st.id])}</div>`;
        }
        html += `</div>`;
      }
      html += `</div>`;
    }
    html += `</div>`;
  }

  // Team Recommendations
  if (recommendations && recommendations.length > 0) {
    html += `<div class="page-break"></div>`;
    html += `<h2>🏢 Équipe recommandée</h2>`;
    for (const rec of recommendations) {
      html += `<div class="rec-card">`;
      html += `<div class="rec-role">${rec.role}</div>`;
      html += `<div class="rec-desc">${rec.description}</div>`;
      html += `<div style="margin-top:4px;">${rec.skills.map((s) => `<span class="skill-tag">${s}</span>`).join("")}</div>`;
      if (rec.estimated_monthly_cost) {
        html += `<p style="margin-top:4px;font-size:11px;">💰 ${rec.estimated_monthly_cost}/mois</p>`;
      }
      html += `<p style="font-size:11px;color:#888;">Importance : ${rec.importance}</p>`;

      // Alternatives
      const alts = alternativesByRec?.[rec.id];
      if (alts && alts.length > 0) {
        html += `<h4 style="margin-top:8px;">Alternatives explorées</h4>`;
        for (const alt of alts) {
          html += `<div class="alt-card">`;
          html += `<div class="alt-title">${alt.title} <span class="badge" style="background:#e0e7ff;color:#4f46e5;">${alt.type}</span></div>`;
          html += `<div class="alt-detail">${alt.description}</div>`;
          if (alt.duration || alt.estimated_cost) {
            html += `<div class="alt-detail">${alt.duration ? `⏱ ${alt.duration}` : ""} ${alt.estimated_cost ? `💰 ${alt.estimated_cost}` : ""}</div>`;
          }
          if (alt.pros.length > 0) {
            html += `<div class="alt-detail pros">${alt.pros.map((p) => `✓ ${p}`).join("<br/>")}</div>`;
          }
          if (alt.cons.length > 0) {
            html += `<div class="alt-detail cons">${alt.cons.map((c) => `✗ ${c}`).join("<br/>")}</div>`;
          }
          html += `</div>`;
        }
      }
      html += `</div>`;
    }
  }

  html += `</div>`;

  const container = document.createElement("div");
  container.innerHTML = PDF_STYLES + html;
  document.body.appendChild(container);

  try {
    const filename = `${title.replace(/[^a-zA-Z0-9àâéèêëïîôùûüÿçæœ ]/g, "").trim()}_plan-action.pdf`;
    await renderToPdf(container, filename);
  } finally {
    document.body.removeChild(container);
  }
}

export async function exportTaskExplanationPDF(
  taskTitle: string,
  explanation: string,
  isSubtask: boolean,
  phaseName: string,
) {
  const date = new Date().toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });
  const type = isSubtask ? "Sous-tâche" : "Tâche";

  let html = `<div class="pdf-container">`;
  html += `<h1>${type} : ${taskTitle}</h1>`;
  html += `<p class="meta">Phase : ${phaseName} • Exporté le ${date}</p>`;
  html += `<div class="explanation-section">${markdownToHtml(explanation)}</div>`;
  html += `</div>`;

  const container = document.createElement("div");
  container.innerHTML = PDF_STYLES + html;
  document.body.appendChild(container);

  try {
    const filename = `guide_${taskTitle.replace(/[^a-zA-Z0-9àâéèêëïîôùûüÿçæœ ]/g, "").substring(0, 40).trim()}.pdf`;
    await renderToPdf(container, filename);
  } finally {
    document.body.removeChild(container);
  }
}

// ========================================
// Business Plan Professional PDF Export
// ========================================

interface BPSection {
  section_type: string;
  title: string;
  content: string;
  sort_order: number;
}

interface BusinessPlanPDFOptions {
  title: string;
  description: string;
  sections: BPSection[];
  status: string;
}

const BP_PDF_STYLES = `
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&display=swap');
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Inter', 'Helvetica Neue', Helvetica, Arial, sans-serif; color: #1a1a1a; line-height: 1.6; }

    /* Cover page */
    .cover-page {
      height: 1120px;
      display: flex;
      flex-direction: column;
      justify-content: center;
      align-items: center;
      text-align: center;
      background: linear-gradient(135deg, #1a1a2e 0%, #16213e 40%, #0f3460 100%);
      color: white;
      position: relative;
      overflow: hidden;
    }
    .cover-page::before {
      content: '';
      position: absolute;
      top: -60px;
      right: -60px;
      width: 300px;
      height: 300px;
      border-radius: 50%;
      background: rgba(255,255,255,0.04);
    }
    .cover-page::after {
      content: '';
      position: absolute;
      bottom: -100px;
      left: -100px;
      width: 400px;
      height: 400px;
      border-radius: 50%;
      background: rgba(255,255,255,0.03);
    }
    .cover-badge {
      display: inline-block;
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 3px;
      text-transform: uppercase;
      padding: 8px 24px;
      border: 1px solid rgba(255,255,255,0.3);
      border-radius: 30px;
      margin-bottom: 40px;
      color: rgba(255,255,255,0.8);
    }
    .cover-title {
      font-size: 42px;
      font-weight: 800;
      line-height: 1.15;
      max-width: 600px;
      margin-bottom: 20px;
    }
    .cover-desc {
      font-size: 16px;
      color: rgba(255,255,255,0.6);
      max-width: 500px;
      margin-bottom: 60px;
      line-height: 1.7;
    }
    .cover-date {
      font-size: 13px;
      color: rgba(255,255,255,0.4);
      position: absolute;
      bottom: 50px;
    }
    .cover-line {
      width: 60px;
      height: 3px;
      background: linear-gradient(90deg, #e2725b, #f4a261);
      margin: 0 auto 40px;
      border-radius: 2px;
    }

    /* TOC */
    .toc-page { padding: 60px 50px; }
    .toc-title {
      font-size: 28px;
      font-weight: 800;
      margin-bottom: 8px;
      color: #1a1a2e;
    }
    .toc-underline {
      width: 50px;
      height: 3px;
      background: linear-gradient(90deg, #e2725b, #f4a261);
      margin-bottom: 40px;
      border-radius: 2px;
    }
    .toc-item {
      display: flex;
      align-items: center;
      padding: 16px 0;
      border-bottom: 1px solid #f0f0f0;
    }
    .toc-num {
      width: 36px;
      height: 36px;
      border-radius: 50%;
      background: #f0f4ff;
      color: #0f3460;
      font-size: 14px;
      font-weight: 700;
      display: flex;
      align-items: center;
      justify-content: center;
      margin-right: 16px;
      flex-shrink: 0;
    }
    .toc-label { font-size: 15px; font-weight: 600; color: #333; flex: 1; }
    .toc-dots { flex: 1; border-bottom: 1px dotted #ccc; margin: 0 12px; min-width: 40px; }
    .toc-page-num { font-size: 14px; font-weight: 600; color: #888; }

    /* Section pages */
    .section-page { padding: 50px; page-break-before: always; }
    .section-header {
      display: flex;
      align-items: center;
      margin-bottom: 30px;
      padding-bottom: 16px;
      border-bottom: 2px solid #0f3460;
    }
    .section-number {
      width: 44px;
      height: 44px;
      border-radius: 50%;
      background: linear-gradient(135deg, #0f3460, #1a1a2e);
      color: white;
      font-size: 18px;
      font-weight: 800;
      display: flex;
      align-items: center;
      justify-content: center;
      margin-right: 16px;
      flex-shrink: 0;
    }
    .section-title { font-size: 24px; font-weight: 800; color: #1a1a2e; }

    /* Content styling */
    .section-content { font-size: 13px; color: #333; line-height: 1.8; }
    .section-content h1 { font-size: 20px; font-weight: 700; margin: 24px 0 10px; color: #1a1a2e; }
    .section-content h2 { font-size: 17px; font-weight: 700; margin: 20px 0 8px; color: #0f3460; }
    .section-content h3 { font-size: 15px; font-weight: 600; margin: 16px 0 6px; color: #333; }
    .section-content h4 { font-size: 14px; font-weight: 600; margin: 12px 0 4px; color: #555; }
    .section-content p { margin-bottom: 8px; }
    .section-content ul, .section-content ol { padding-left: 22px; margin: 8px 0; }
    .section-content li { margin-bottom: 4px; font-size: 13px; }
    .section-content strong { font-weight: 700; color: #1a1a2e; }
    .section-content em { font-style: italic; color: #555; }
    .section-content table { width: 100%; border-collapse: collapse; margin: 16px 0; font-size: 12px; }
    .section-content th { background: #0f3460; color: white; padding: 10px 12px; text-align: left; font-weight: 600; }
    .section-content td { padding: 8px 12px; border-bottom: 1px solid #e5e5e5; }
    .section-content tr:nth-child(even) td { background: #f9fafb; }
    .section-content blockquote { border-left: 3px solid #e2725b; padding: 8px 16px; margin: 12px 0; background: #fff8f5; color: #555; font-style: italic; }

    /* Footer */
    .page-footer {
      position: relative;
      margin-top: 40px;
      padding-top: 16px;
      border-top: 1px solid #e5e5e5;
      font-size: 10px;
      color: #aaa;
      display: flex;
      justify-content: space-between;
    }
  </style>
`;

function mdToHtmlRich(md: string): string {
  let html = md
    // Tables
    .replace(/^\|(.+)\|$/gm, (match) => {
      return match;
    });

  // Process tables
  const tableRegex = /(\|[^\n]+\|\n)((?:\|[-:| ]+\|\n))((?:\|[^\n]+\|\n?)*)/g;
  html = html.replace(tableRegex, (_match, headerRow, _separator, bodyRows) => {
    const headers = headerRow.trim().split('|').filter((c: string) => c.trim());
    const rows = bodyRows.trim().split('\n').filter((r: string) => r.trim());

    let table = '<table><thead><tr>';
    headers.forEach((h: string) => { table += `<th>${h.trim()}</th>`; });
    table += '</tr></thead><tbody>';
    rows.forEach((row: string) => {
      const cells = row.split('|').filter((c: string) => c.trim());
      table += '<tr>';
      cells.forEach((c: string) => { table += `<td>${c.trim()}</td>`; });
      table += '</tr>';
    });
    table += '</tbody></table>';
    return table;
  });

  // Headings
  html = html
    .replace(/^#### (.+)$/gm, "<h4>$1</h4>")
    .replace(/^### (.+)$/gm, "<h3>$1</h3>")
    .replace(/^## (.+)$/gm, "<h2>$1</h2>")
    .replace(/^# (.+)$/gm, "<h1>$1</h1>");

  // Bold & italic
  html = html
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>");

  // Blockquotes
  html = html.replace(/^> (.+)$/gm, "<blockquote>$1</blockquote>");

  // Lists
  html = html.replace(/^- (.+)$/gm, "<li>$1</li>");
  html = html.replace(/^(\d+)\. (.+)$/gm, "<li>$2</li>");
  html = html.replace(/(<li>.*?<\/li>\n?)+/g, (match) => `<ul>${match}</ul>`);

  // Paragraphs
  html = html.replace(/\n\n/g, "</p><p>");
  html = `<p>${html}</p>`;
  html = html.replace(/<p>\s*<(h[1-4]|table|ul|ol|blockquote)/g, "<$1");
  html = html.replace(/<\/(h[1-4]|table|ul|ol|blockquote)>\s*<\/p>/g, "</$1>");
  html = html.replace(/<p>\s*<\/p>/g, "");

  return html;
}

export async function exportBusinessPlanPDF(options: BusinessPlanPDFOptions) {
  const { title, description, sections, status } = options;
  const date = new Date().toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });

  const statusLabels: Record<string, string> = {
    draft: "Brouillon",
    in_progress: "En cours de rédaction",
    completed: "Finalisé",
  };

  const sectionIcons: Record<string, string> = {
    executive_summary: "📋",
    market_analysis: "📊",
    business_strategy: "🎯",
    financial_plan: "💰",
    best_practices: "⭐",
  };

  // ---- Cover Page ----
  let html = `
    <div class="cover-page">
      <div class="cover-badge">Business Plan</div>
      <div class="cover-line"></div>
      <div class="cover-title">${title}</div>
      <div class="cover-desc">${description || "Plan d'affaires détaillé"}</div>
      <div class="cover-date">${date} • ${statusLabels[status] || status}</div>
    </div>
  `;

  // ---- Table of Contents ----
  html += `
    <div class="toc-page" style="page-break-before:always;">
      <div class="toc-title">Sommaire</div>
      <div class="toc-underline"></div>
  `;
  sections.forEach((sec, i) => {
    html += `
      <div class="toc-item">
        <div class="toc-num">${i + 1}</div>
        <div class="toc-label">${sectionIcons[sec.section_type] || "📄"} ${sec.title}</div>
        <div class="toc-dots"></div>
        <div class="toc-page-num">${i + 3}</div>
      </div>
    `;
  });
  html += `</div>`;

  // ---- Section Pages ----
  sections.forEach((sec, i) => {
    html += `
      <div class="section-page">
        <div class="section-header">
          <div class="section-number">${i + 1}</div>
          <div class="section-title">${sec.title}</div>
        </div>
        <div class="section-content">
          ${mdToHtmlRich(sec.content)}
        </div>
        <div class="page-footer">
          <span>${title} — Business Plan</span>
          <span>Page ${i + 3}</span>
        </div>
      </div>
    `;
  });

  const container = document.createElement("div");
  container.style.width = "794px"; // A4 width at 96dpi
  container.innerHTML = BP_PDF_STYLES + html;
  document.body.appendChild(container);

  try {
    const filename = `${title.replace(/[^a-zA-Z0-9àâéèêëïîôùûüÿçæœ ]/g, "").trim()}_business-plan.pdf`;
    await renderToPdf(container, filename);
  } finally {
    document.body.removeChild(container);
  }
}
