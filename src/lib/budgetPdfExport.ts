import jsPDF from "jspdf";
import type { BudgetRow, BudgetLineRow } from "@/hooks/useBudgets";

const CATEGORIES: Record<string, string> = {
  revenue: "Revenus / Chiffre d'affaires",
  fixed_charges: "Charges fixes",
  variable_charges: "Charges variables",
  treasury: "Trésorerie",
  investments: "Investissements",
};

const MONTH_LABELS = ["Jan", "Fév", "Mar", "Avr", "Mai", "Jun", "Jul", "Aoû", "Sep", "Oct", "Nov", "Déc"];

function getMonthLabel(index: number): string {
  return MONTH_LABELS[index % 12] + (index >= 12 ? ` A${Math.floor(index / 12) + 1}` : "");
}

export function exportBudgetPDF(budget: BudgetRow, lines: BudgetLineRow[]) {
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a3" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();

  // Cover page
  doc.setFillColor(30, 41, 59);
  doc.rect(0, 0, pageW, pageH, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(36);
  doc.setFont("helvetica", "bold");
  doc.text("Budget Prévisionnel", pageW / 2, pageH / 2 - 20, { align: "center" });
  doc.setFontSize(20);
  doc.setFont("helvetica", "normal");
  doc.text(budget.title, pageW / 2, pageH / 2 + 10, { align: "center" });
  doc.setFontSize(12);
  doc.text(`Horizon : ${budget.horizon_months} mois`, pageW / 2, pageH / 2 + 30, { align: "center" });
  doc.text(`Généré le ${new Date().toLocaleDateString("fr-FR")}`, pageW / 2, pageH / 2 + 42, { align: "center" });

  // Data pages per category
  const categories = [...new Set(lines.map(l => l.category))];
  const horizonMonths = budget.horizon_months;
  const colsPerPage = Math.min(horizonMonths, 12);

  for (const cat of categories) {
    const catLines = lines.filter(l => l.category === cat);
    const totalPages = Math.ceil(horizonMonths / colsPerPage);

    for (let page = 0; page < totalPages; page++) {
      doc.addPage();
      const startMonth = page * colsPerPage;
      const endMonth = Math.min(startMonth + colsPerPage, horizonMonths);
      const numCols = endMonth - startMonth;

      // Header
      doc.setFillColor(30, 41, 59);
      doc.rect(0, 0, pageW, 20, "F");
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(14);
      doc.setFont("helvetica", "bold");
      doc.text(`${CATEGORIES[cat] || cat} — Mois ${startMonth + 1} à ${endMonth}`, 15, 14);

      // Table
      const tableX = 15;
      let tableY = 30;
      const labelColW = 60;
      const dataColW = (pageW - 30 - labelColW - 30) / numCols;
      const totalColW = 30;
      const rowH = 8;

      // Column headers
      doc.setFillColor(241, 245, 249);
      doc.rect(tableX, tableY, pageW - 30, rowH, "F");
      doc.setTextColor(30, 41, 59);
      doc.setFontSize(8);
      doc.setFont("helvetica", "bold");
      doc.text("Libellé", tableX + 3, tableY + 5.5);
      for (let m = 0; m < numCols; m++) {
        doc.text(getMonthLabel(startMonth + m), tableX + labelColW + m * dataColW + dataColW / 2, tableY + 5.5, { align: "center" });
      }
      doc.text("Total", tableX + labelColW + numCols * dataColW + totalColW / 2, tableY + 5.5, { align: "center" });
      tableY += rowH;

      // Rows
      for (const line of catLines) {
        if (tableY + rowH > pageH - 15) {
          doc.addPage();
          tableY = 20;
        }

        if (line.is_total) {
          doc.setFillColor(226, 232, 240);
          doc.rect(tableX, tableY, pageW - 30, rowH, "F");
          doc.setFont("helvetica", "bold");
        } else {
          if (catLines.indexOf(line) % 2 === 0) {
            doc.setFillColor(248, 250, 252);
            doc.rect(tableX, tableY, pageW - 30, rowH, "F");
          }
          doc.setFont("helvetica", "normal");
        }

        doc.setTextColor(30, 41, 59);
        doc.setFontSize(7);
        doc.text(line.label, tableX + 3, tableY + 5.5, { maxWidth: labelColW - 6 });

        const values = (line.monthly_values as number[]) || [];
        let rowTotal = 0;
        for (let m = 0; m < numCols; m++) {
          const val = values[startMonth + m] || 0;
          rowTotal += val;
          const color = val < 0 ? [220, 38, 38] : [30, 41, 59];
          doc.setTextColor(color[0], color[1], color[2]);
          doc.text(
            val.toLocaleString("fr-FR", { minimumFractionDigits: 0, maximumFractionDigits: 0 }) + " €",
            tableX + labelColW + m * dataColW + dataColW - 3,
            tableY + 5.5,
            { align: "right" }
          );
        }

        const totalColor = rowTotal < 0 ? [220, 38, 38] : [30, 41, 59];
        doc.setTextColor(totalColor[0], totalColor[1], totalColor[2]);
        doc.setFont("helvetica", "bold");
        doc.text(
          rowTotal.toLocaleString("fr-FR", { minimumFractionDigits: 0, maximumFractionDigits: 0 }) + " €",
          tableX + labelColW + numCols * dataColW + totalColW - 3,
          tableY + 5.5,
          { align: "right" }
        );

        tableY += rowH;
      }
    }
  }

  doc.save(`budget-${budget.title.replace(/\s+/g, "-").toLowerCase()}.pdf`);
}
