import jsPDF from "jspdf";

interface BMBlock {
  block_type: string;
  title: string;
  content: string;
}

interface BMPDFData {
  title: string;
  description: string;
  framework: string;
  blocks: BMBlock[];
  status: string;
}

function mdToPlainText(md: string): string {
  return md
    .replace(/#{1,6}\s*/g, "")
    .replace(/\*\*(.*?)\*\*/g, "$1")
    .replace(/\*(.*?)\*/g, "$1")
    .replace(/- /g, "• ")
    .replace(/\n{3,}/g, "\n\n");
}

export async function exportBusinessModelPDF(data: BMPDFData) {
  const pdf = new jsPDF("landscape", "mm", "a3");
  const pageW = pdf.internal.pageSize.getWidth();
  const pageH = pdf.internal.pageSize.getHeight();
  const margin = 15;

  // Cover page
  pdf.setFillColor(15, 23, 42);
  pdf.rect(0, 0, pageW, pageH, "F");

  pdf.setTextColor(255, 255, 255);
  pdf.setFontSize(32);
  pdf.setFont("helvetica", "bold");
  pdf.text(data.title, pageW / 2, pageH / 2 - 20, { align: "center" });

  pdf.setFontSize(14);
  pdf.setFont("helvetica", "normal");
  pdf.setTextColor(180, 180, 200);
  const frameworkLabel = data.framework === "lean" ? "Lean Canvas" : "Business Model Canvas";
  pdf.text(frameworkLabel, pageW / 2, pageH / 2, { align: "center" });

  if (data.description) {
    pdf.setFontSize(10);
    const descLines = pdf.splitTextToSize(data.description, pageW - 80);
    pdf.text(descLines, pageW / 2, pageH / 2 + 15, { align: "center" });
  }

  pdf.setFontSize(8);
  pdf.text(`Généré le ${new Date().toLocaleDateString("fr-FR")}`, pageW / 2, pageH - 20, { align: "center" });

  // Canvas page
  pdf.addPage("a3", "landscape");
  pdf.setFillColor(248, 250, 252);
  pdf.rect(0, 0, pageW, pageH, "F");

  pdf.setTextColor(15, 23, 42);
  pdf.setFontSize(16);
  pdf.setFont("helvetica", "bold");
  pdf.text(frameworkLabel, margin, margin + 5);

  const startY = margin + 15;
  const canvasW = pageW - margin * 2;
  const canvasH = pageH - startY - margin;

  const blockColors: Record<string, [number, number, number]> = {
    key_partners: [59, 130, 246],
    key_activities: [168, 85, 247],
    key_resources: [99, 102, 241],
    value_propositions: [245, 158, 11],
    customer_relationships: [236, 72, 153],
    channels: [6, 182, 212],
    customer_segments: [34, 197, 94],
    cost_structure: [239, 68, 68],
    revenue_streams: [16, 185, 129],
    problem: [239, 68, 68],
    solution: [34, 197, 94],
    unique_value: [245, 158, 11],
    unfair_advantage: [168, 85, 247],
    key_metrics: [99, 102, 241],
  };

  if (data.framework === "bmc") {
    // BMC layout: 5 cols top, 2 cols bottom
    const colW = canvasW / 5;
    const topH = canvasH * 0.65;
    const botH = canvasH * 0.35;

    const bmcLayout = [
      { type: "key_partners", x: 0, y: 0, w: colW, h: topH },
      { type: "key_activities", x: colW, y: 0, w: colW, h: topH / 2 },
      { type: "key_resources", x: colW, y: topH / 2, w: colW, h: topH / 2 },
      { type: "value_propositions", x: colW * 2, y: 0, w: colW, h: topH },
      { type: "customer_relationships", x: colW * 3, y: 0, w: colW, h: topH / 2 },
      { type: "channels", x: colW * 3, y: topH / 2, w: colW, h: topH / 2 },
      { type: "customer_segments", x: colW * 4, y: 0, w: colW, h: topH },
      { type: "cost_structure", x: 0, y: topH, w: canvasW / 2, h: botH },
      { type: "revenue_streams", x: canvasW / 2, y: topH, w: canvasW / 2, h: botH },
    ];

    bmcLayout.forEach(layout => {
      const block = data.blocks.find(b => b.block_type === layout.type);
      const color = blockColors[layout.type] || [100, 100, 100];

      const bx = margin + layout.x;
      const by = startY + layout.y;

      // Block background
      pdf.setFillColor(255, 255, 255);
      pdf.roundedRect(bx + 1, by + 1, layout.w - 2, layout.h - 2, 3, 3, "F");

      // Header bar
      pdf.setFillColor(color[0], color[1], color[2]);
      pdf.rect(bx + 1, by + 1, layout.w - 2, 8, "F");

      // Title
      pdf.setTextColor(255, 255, 255);
      pdf.setFontSize(8);
      pdf.setFont("helvetica", "bold");
      const blockTitle = block?.title || layout.type;
      pdf.text(blockTitle, bx + 4, by + 7);

      // Content
      if (block?.content) {
        pdf.setTextColor(30, 41, 59);
        pdf.setFontSize(6.5);
        pdf.setFont("helvetica", "normal");
        const text = mdToPlainText(block.content);
        const lines = pdf.splitTextToSize(text, layout.w - 8);
        const maxLines = Math.floor((layout.h - 16) / 3.5);
        pdf.text(lines.slice(0, maxLines), bx + 4, by + 14);
      }
    });
  } else {
    // Lean Canvas layout: 3x3 grid
    const colW = canvasW / 3;
    const rowH = canvasH / 3;
    const leanLayout = [
      { type: "problem", x: 0, y: 0 },
      { type: "solution", x: colW, y: 0 },
      { type: "unique_value", x: colW * 2, y: 0 },
      { type: "unfair_advantage", x: 0, y: rowH },
      { type: "customer_segments", x: colW, y: rowH },
      { type: "key_metrics", x: colW * 2, y: rowH },
      { type: "channels", x: 0, y: rowH * 2 },
      { type: "cost_structure", x: colW, y: rowH * 2 },
      { type: "revenue_streams", x: colW * 2, y: rowH * 2 },
    ];

    leanLayout.forEach(layout => {
      const block = data.blocks.find(b => b.block_type === layout.type);
      const color = blockColors[layout.type] || [100, 100, 100];
      const bx = margin + layout.x;
      const by = startY + layout.y;

      pdf.setFillColor(255, 255, 255);
      pdf.roundedRect(bx + 1, by + 1, colW - 2, rowH - 2, 3, 3, "F");

      pdf.setFillColor(color[0], color[1], color[2]);
      pdf.rect(bx + 1, by + 1, colW - 2, 8, "F");

      pdf.setTextColor(255, 255, 255);
      pdf.setFontSize(8);
      pdf.setFont("helvetica", "bold");
      pdf.text(block?.title || layout.type, bx + 4, by + 7);

      if (block?.content) {
        pdf.setTextColor(30, 41, 59);
        pdf.setFontSize(6.5);
        pdf.setFont("helvetica", "normal");
        const text = mdToPlainText(block.content);
        const lines = pdf.splitTextToSize(text, colW - 8);
        const maxLines = Math.floor((rowH - 16) / 3.5);
        pdf.text(lines.slice(0, maxLines), bx + 4, by + 14);
      }
    });
  }

  pdf.save(`${data.title.replace(/[^a-zA-Z0-9]/g, "_")}_business_model.pdf`);
}
