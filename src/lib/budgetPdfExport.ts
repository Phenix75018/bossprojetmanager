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

  // ── Charts page ──
  const visibleMonths = Math.min(horizonMonths, 12);
  const catKeys = ["revenue", "fixed_charges", "variable_charges", "treasury", "investments"];
  const catLabels: Record<string, string> = {
    revenue: "Revenus", fixed_charges: "Ch. fixes", variable_charges: "Ch. var.",
    treasury: "Trésorerie", investments: "Invest.",
  };
  const catColors: Record<string, [number, number, number]> = {
    revenue: [34, 153, 100], fixed_charges: [200, 50, 50], variable_charges: [210, 140, 40],
    treasury: [50, 110, 200], investments: [130, 80, 180],
  };

  // Compute monthly totals per category
  const monthlyTotals: Record<string, number[]> = {};
  for (const cat of catKeys) {
    monthlyTotals[cat] = [];
    for (let m = 0; m < visibleMonths; m++) {
      const catLines = lines.filter(l => l.category === cat && !l.is_total);
      monthlyTotals[cat].push(catLines.reduce((s, l) => s + ((l.monthly_values as number[])[m] || 0), 0));
    }
  }

  // ── Page: Bar chart (Revenue vs Charges) ──
  doc.addPage();
  doc.setFillColor(30, 41, 59);
  doc.rect(0, 0, pageW, 20, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.text("Graphique — Revenus vs Charges par mois", 15, 14);

  const barChartX = 30;
  const barChartY = 35;
  const barChartW = pageW - 60;
  const barChartH = 120;
  const barCats = ["revenue", "fixed_charges", "variable_charges"];

  // Find max value for scale
  let barMax = 0;
  for (let m = 0; m < visibleMonths; m++) {
    for (const cat of barCats) {
      barMax = Math.max(barMax, Math.abs(monthlyTotals[cat][m]));
    }
  }
  barMax = barMax || 1;

  // Axes
  doc.setDrawColor(200, 200, 200);
  doc.setLineWidth(0.3);
  doc.line(barChartX, barChartY + barChartH, barChartX + barChartW, barChartY + barChartH);
  doc.line(barChartX, barChartY, barChartX, barChartY + barChartH);

  // Y-axis labels
  doc.setTextColor(100, 100, 100);
  doc.setFontSize(6);
  doc.setFont("helvetica", "normal");
  for (let i = 0; i <= 4; i++) {
    const val = Math.round(barMax * (4 - i) / 4);
    const y = barChartY + (barChartH * i / 4);
    doc.text(val.toLocaleString("fr-FR") + " €", barChartX - 2, y + 1.5, { align: "right" });
    doc.setDrawColor(230, 230, 230);
    doc.line(barChartX, y, barChartX + barChartW, y);
  }

  const groupW = barChartW / visibleMonths;
  const barW = (groupW - 6) / barCats.length;

  for (let m = 0; m < visibleMonths; m++) {
    const gx = barChartX + m * groupW;
    // Month label
    doc.setTextColor(80, 80, 80);
    doc.setFontSize(7);
    doc.text(getMonthLabel(m), gx + groupW / 2, barChartY + barChartH + 6, { align: "center" });

    for (let ci = 0; ci < barCats.length; ci++) {
      const val = Math.abs(monthlyTotals[barCats[ci]][m]);
      const h = (val / barMax) * barChartH;
      const c = catColors[barCats[ci]];
      doc.setFillColor(c[0], c[1], c[2]);
      doc.roundedRect(gx + 3 + ci * barW, barChartY + barChartH - h, barW - 1, h, 1, 1, "F");
    }
  }

  // Legend
  const legendY = barChartY + barChartH + 15;
  let legendX = barChartX;
  doc.setFontSize(7);
  for (const cat of barCats) {
    const c = catColors[cat];
    doc.setFillColor(c[0], c[1], c[2]);
    doc.roundedRect(legendX, legendY, 4, 4, 0.5, 0.5, "F");
    doc.setTextColor(60, 60, 60);
    doc.text(catLabels[cat], legendX + 6, legendY + 3.5);
    legendX += 35;
  }

  // ── Cumulative net result line chart ──
  const lineChartY = legendY + 20;
  const lineChartH = pageH - lineChartY - 20;
  if (lineChartH > 40) {
    doc.setTextColor(30, 41, 59);
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.text("Résultat net cumulé", barChartX, lineChartY - 3);

    let cumulative = 0;
    const cumulData: number[] = [];
    const netData: number[] = [];
    for (let m = 0; m < visibleMonths; m++) {
      const net = (monthlyTotals.revenue[m] || 0) + (monthlyTotals.fixed_charges[m] || 0) + (monthlyTotals.variable_charges[m] || 0);
      cumulative += net;
      cumulData.push(cumulative);
      netData.push(net);
    }

    const allVals = [...cumulData, ...netData];
    let lineMin = Math.min(0, ...allVals);
    let lineMax = Math.max(0, ...allVals);
    const lineRange = lineMax - lineMin || 1;
    lineMin -= lineRange * 0.1;
    lineMax += lineRange * 0.1;
    const totalRange = lineMax - lineMin;

    // Axes
    doc.setDrawColor(200, 200, 200);
    doc.setLineWidth(0.3);
    doc.line(barChartX, lineChartY + lineChartH, barChartX + barChartW, lineChartY + lineChartH);
    doc.line(barChartX, lineChartY, barChartX, lineChartY + lineChartH);

    // Zero line
    const zeroY = lineChartY + ((lineMax - 0) / totalRange) * lineChartH;
    doc.setDrawColor(180, 180, 180);
    doc.setLineDashPattern([2, 2], 0);
    doc.line(barChartX, zeroY, barChartX + barChartW, zeroY);
    doc.setLineDashPattern([], 0);

    const toY = (v: number) => lineChartY + ((lineMax - v) / totalRange) * lineChartH;
    const toX = (m: number) => barChartX + (m / (visibleMonths - 1 || 1)) * barChartW;

    // Draw cumulative line
    doc.setDrawColor(50, 110, 200);
    doc.setLineWidth(0.8);
    for (let m = 1; m < visibleMonths; m++) {
      doc.line(toX(m - 1), toY(cumulData[m - 1]), toX(m), toY(cumulData[m]));
    }
    // Dots
    for (let m = 0; m < visibleMonths; m++) {
      doc.setFillColor(50, 110, 200);
      doc.circle(toX(m), toY(cumulData[m]), 1.2, "F");
    }

    // Draw net result line
    doc.setDrawColor(34, 153, 100);
    doc.setLineWidth(0.5);
    for (let m = 1; m < visibleMonths; m++) {
      doc.line(toX(m - 1), toY(netData[m - 1]), toX(m), toY(netData[m]));
    }
    for (let m = 0; m < visibleMonths; m++) {
      doc.setFillColor(34, 153, 100);
      doc.circle(toX(m), toY(netData[m]), 0.9, "F");
    }

    // X-axis labels
    doc.setTextColor(80, 80, 80);
    doc.setFontSize(7);
    doc.setFont("helvetica", "normal");
    for (let m = 0; m < visibleMonths; m++) {
      doc.text(getMonthLabel(m), toX(m), lineChartY + lineChartH + 5, { align: "center" });
    }

    // Legend
    const ll = lineChartY + lineChartH + 12;
    doc.setFillColor(50, 110, 200);
    doc.roundedRect(barChartX, ll, 4, 4, 0.5, 0.5, "F");
    doc.setTextColor(60, 60, 60);
    doc.text("Résultat cumulé", barChartX + 6, ll + 3.5);
    doc.setFillColor(34, 153, 100);
    doc.roundedRect(barChartX + 45, ll, 4, 4, 0.5, 0.5, "F");
    doc.text("Résultat mensuel", barChartX + 51, ll + 3.5);
  }

  // ── Page: Pie chart (category distribution) ──
  doc.addPage();
  doc.setFillColor(30, 41, 59);
  doc.rect(0, 0, pageW, 20, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.text("Graphique — Répartition par catégorie", 15, 14);

  const pieData = catKeys.map(cat => {
    const total = lines.filter(l => l.category === cat && !l.is_total)
      .reduce((s, l) => s + (l.monthly_values as number[]).reduce((a, b) => a + Math.abs(b), 0), 0);
    return { cat, label: catLabels[cat], value: total, color: catColors[cat] };
  }).filter(d => d.value > 0);

  const pieTotal = pieData.reduce((s, d) => s + d.value, 0) || 1;
  const pieCx = pageW / 3;
  const pieCy = 35 + 65;
  const pieR = 50;
  const pieInnerR = 25;

  let startAngle = -Math.PI / 2;
  for (const slice of pieData) {
    const sweepAngle = (slice.value / pieTotal) * 2 * Math.PI;
    const steps = Math.max(20, Math.ceil(sweepAngle * 30));

    // Draw filled arc (outer - inner donut)
    doc.setFillColor(slice.color[0], slice.color[1], slice.color[2]);

    // Build path points for outer arc then inner arc reversed
    const outerPts: [number, number][] = [];
    const innerPts: [number, number][] = [];
    for (let i = 0; i <= steps; i++) {
      const a = startAngle + (sweepAngle * i / steps);
      outerPts.push([pieCx + Math.cos(a) * pieR, pieCy + Math.sin(a) * pieR]);
      innerPts.push([pieCx + Math.cos(a) * pieInnerR, pieCy + Math.sin(a) * pieInnerR]);
    }
    innerPts.reverse();

    // Draw as filled triangles (approximate)
    const allPts = [...outerPts, ...innerPts];
    if (allPts.length >= 3) {
      // Use triangle fan from center of arc
      const midA = startAngle + sweepAngle / 2;
      const cx2 = pieCx + Math.cos(midA) * ((pieR + pieInnerR) / 2);
      const cy2 = pieCy + Math.sin(midA) * ((pieR + pieInnerR) / 2);
      for (let i = 0; i < allPts.length - 1; i++) {
        doc.triangle(
          cx2, cy2,
          allPts[i][0], allPts[i][1],
          allPts[i + 1][0], allPts[i + 1][1],
          "F"
        );
      }
      // Close the gap
      doc.triangle(cx2, cy2, allPts[allPts.length - 1][0], allPts[allPts.length - 1][1], allPts[0][0], allPts[0][1], "F");
    }

    // Label line
    const labelA = startAngle + sweepAngle / 2;
    const lx = pieCx + Math.cos(labelA) * (pieR + 12);
    const ly = pieCy + Math.sin(labelA) * (pieR + 12);
    doc.setTextColor(60, 60, 60);
    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    const pct = ((slice.value / pieTotal) * 100).toFixed(0);
    doc.text(`${slice.label} (${pct}%)`, lx, ly, { align: lx > pieCx ? "left" : "right" });

    startAngle += sweepAngle;
  }

  // Revenue vs Charges pie on right side
  const pie2Cx = pageW * 2 / 3;
  const pie2Cy = pieCy;
  const revTotal = pieData.find(d => d.cat === "revenue")?.value || 0;
  const chargesTotal = (pieData.find(d => d.cat === "fixed_charges")?.value || 0) + (pieData.find(d => d.cat === "variable_charges")?.value || 0);
  const pie2Data = [
    { label: "Revenus", value: revTotal, color: catColors.revenue as [number, number, number] },
    { label: "Charges totales", value: chargesTotal, color: catColors.fixed_charges as [number, number, number] },
  ].filter(d => d.value > 0);
  const pie2Total = pie2Data.reduce((s, d) => s + d.value, 0) || 1;

  doc.setTextColor(30, 41, 59);
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.text("Répartition par catégorie", pieCx, 30, { align: "center" });
  doc.text("Revenus vs Charges", pie2Cx, 30, { align: "center" });

  let startAngle2 = -Math.PI / 2;
  for (const slice of pie2Data) {
    const sweepAngle = (slice.value / pie2Total) * 2 * Math.PI;
    const steps = Math.max(20, Math.ceil(sweepAngle * 30));
    doc.setFillColor(slice.color[0], slice.color[1], slice.color[2]);

    const outerPts: [number, number][] = [];
    const innerPts: [number, number][] = [];
    for (let i = 0; i <= steps; i++) {
      const a = startAngle2 + (sweepAngle * i / steps);
      outerPts.push([pie2Cx + Math.cos(a) * pieR, pie2Cy + Math.sin(a) * pieR]);
      innerPts.push([pie2Cx + Math.cos(a) * pieInnerR, pie2Cy + Math.sin(a) * pieInnerR]);
    }
    innerPts.reverse();
    const allPts = [...outerPts, ...innerPts];
    if (allPts.length >= 3) {
      const midA = startAngle2 + sweepAngle / 2;
      const cx2 = pie2Cx + Math.cos(midA) * ((pieR + pieInnerR) / 2);
      const cy2 = pie2Cy + Math.sin(midA) * ((pieR + pieInnerR) / 2);
      for (let i = 0; i < allPts.length - 1; i++) {
        doc.triangle(cx2, cy2, allPts[i][0], allPts[i][1], allPts[i + 1][0], allPts[i + 1][1], "F");
      }
      doc.triangle(cx2, cy2, allPts[allPts.length - 1][0], allPts[allPts.length - 1][1], allPts[0][0], allPts[0][1], "F");
    }

    const labelA = startAngle2 + sweepAngle / 2;
    const lx = pie2Cx + Math.cos(labelA) * (pieR + 12);
    const ly = pie2Cy + Math.sin(labelA) * (pieR + 12);
    doc.setTextColor(60, 60, 60);
    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    const pct = ((slice.value / pie2Total) * 100).toFixed(0);
    doc.text(`${slice.label} (${pct}%)`, lx, ly, { align: lx > pie2Cx ? "left" : "right" });

    startAngle2 += sweepAngle;
  }

  doc.save(`budget-${budget.title.replace(/\s+/g, "-").toLowerCase()}.pdf`);
}
