import html2pdf from "html2pdf.js";

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
    await html2pdf().set({
      margin: [10, 10, 10, 10],
      filename: `${title.replace(/[^a-zA-Z0-9àâéèêëïîôùûüÿçæœ ]/g, "").trim()}_plan-action.pdf`,
      html2canvas: { scale: 2, useCORS: true },
      jsPDF: { unit: "mm", format: "a4", orientation: "portrait" },
      pagebreak: { mode: ["css", "legacy"] },
    }).from(container).save();
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
    await html2pdf().set({
      margin: [10, 10, 10, 10],
      filename: `guide_${taskTitle.replace(/[^a-zA-Z0-9àâéèêëïîôùûüÿçæœ ]/g, "").substring(0, 40).trim()}.pdf`,
      html2canvas: { scale: 2, useCORS: true },
      jsPDF: { unit: "mm", format: "a4", orientation: "portrait" },
    }).from(container).save();
  } finally {
    document.body.removeChild(container);
  }
}
