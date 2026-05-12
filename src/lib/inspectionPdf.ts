import { jsPDF } from "jspdf";

interface ReportData {
  listing: any;
  report: any;
  shop?: any;
  seller?: any;
}

const STATUS_LABEL: Record<string, string> = {
  ok: "Conforme",
  problems: "Anomalia detetada",
  critical: "Reprovado",
};

const COMPONENTS: Array<{ key: string; label: string }> = [
  { key: "engine_status", label: "Motor" },
  { key: "transmission_status", label: "Transmissão" },
  { key: "brakes_status", label: "Travões" },
  { key: "suspension_status", label: "Suspensão" },
  { key: "steering_status", label: "Direção" },
  { key: "tires_status", label: "Pneus" },
  { key: "electrical_status", label: "Sistema elétrico" },
];

export function generateInspectionPDF({ listing, report, shop, seller }: ReportData) {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 15;
  let y = 18;

  // Header band
  doc.setFillColor(15, 23, 42);
  doc.rect(0, 0, pageWidth, 28, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(18);
  doc.setFont("helvetica", "bold");
  doc.text("GarageFlow Market", margin, 12);
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(251, 191, 36);
  doc.text("CERTIFICADO DE INSPEÇÃO TÉCNICA", margin, 19);
  doc.setTextColor(203, 213, 225);
  doc.setFontSize(8);
  doc.text(`Emitido em ${new Date().toLocaleString("pt-PT")}`, pageWidth - margin, 12, { align: "right" });
  doc.text(`Ref: ${report.id?.slice(0, 8).toUpperCase()}`, pageWidth - margin, 17, { align: "right" });

  y = 38;
  doc.setTextColor(15, 23, 42);

  // Vehicle title
  doc.setFontSize(16);
  doc.setFont("helvetica", "bold");
  doc.text(`${listing.make} ${listing.model} (${listing.year})`, margin, y);
  y += 6;
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(100, 116, 139);
  doc.text(`Matrícula ${listing.plate || "—"}  ·  ${listing.mileage?.toLocaleString("pt-PT")} km  ·  ${listing.fuel}  ·  VIN ${listing.vin || "n/d"}`, margin, y);
  y += 8;

  // Score card
  const score = (report.overall_score / 10).toFixed(1);
  const scoreColor: [number, number, number] =
    report.overall_score >= 80 ? [22, 163, 74] : report.overall_score >= 60 ? [217, 119, 6] : [220, 38, 38];
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(margin, y, pageWidth - margin * 2, 26, 2, 2, "FD");
  doc.setFontSize(9);
  doc.setTextColor(100, 116, 139);
  doc.setFont("helvetica", "bold");
  doc.text("CLASSIFICAÇÃO GERAL", margin + 4, y + 6);
  doc.setFontSize(28);
  doc.setTextColor(...scoreColor);
  doc.text(`${score}`, margin + 4, y + 20);
  doc.setFontSize(11);
  doc.setTextColor(100, 116, 139);
  doc.text("/10", margin + 26, y + 20);

  // Risk + recommendation (right side)
  const riskLabel = report.overall_score >= 80 ? "Baixo" : report.overall_score >= 60 ? "Moderado" : "Elevado";
  const recLabel: Record<string, string> = {
    recommended: "Aprovado — recomendado para compra",
    acceptable: "Aprovado com reservas",
    not_recommended: "Não recomendado para compra",
  };
  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139);
  doc.setFont("helvetica", "bold");
  doc.text("RISCO", margin + 65, y + 6);
  doc.text("ANOMALIAS", margin + 95, y + 6);
  doc.text("RECOMENDAÇÃO", margin + 130, y + 6);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  doc.setTextColor(15, 23, 42);
  doc.text(riskLabel, margin + 65, y + 14);
  doc.text(`${report.defects?.length || 0} reg.`, margin + 95, y + 14);
  doc.setFontSize(8);
  const rec = recLabel[report.recommendation] || report.recommendation || "—";
  doc.text(doc.splitTextToSize(rec, 55), margin + 130, y + 13);
  y += 32;

  // Workshop
  if (shop) {
    doc.setFillColor(254, 252, 232);
    doc.setDrawColor(254, 215, 170);
    doc.roundedRect(margin, y, pageWidth - margin * 2, 26, 2, 2, "FD");
    doc.setFontSize(8);
    doc.setTextColor(120, 53, 15);
    doc.setFont("helvetica", "bold");
    doc.text("INSPEÇÃO REALIZADA POR", margin + 4, y + 6);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(11);
    doc.setTextColor(15, 23, 42);
    doc.text(shop.name || "Oficina parceira", margin + 4, y + 12);
    doc.setFontSize(8);
    doc.setTextColor(100, 116, 139);
    doc.text(`ID oficina: ${shop.id?.slice(0, 8).toUpperCase() || "—"}${shop.nif ? `  ·  NIF ${shop.nif}` : ""}`, margin + 4, y + 17);
    if (report.technician_name) {
      doc.text(`Técnico responsável: ${report.technician_name}`, margin + 4, y + 21);
    }
    y += 30;
  }

  // Audit / location block
  if (report.inspection_lat || report.mileage_at_inspection || report.started_at) {
    doc.setFillColor(239, 246, 255);
    doc.setDrawColor(191, 219, 254);
    doc.roundedRect(margin, y, pageWidth - margin * 2, 26, 2, 2, "FD");
    doc.setFontSize(8);
    doc.setTextColor(30, 64, 175);
    doc.setFont("helvetica", "bold");
    doc.text("AUDITORIA FÍSICA DA INSPEÇÃO", margin + 4, y + 6);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(15, 23, 42);
    if (report.mileage_at_inspection) {
      doc.text(`Km registada: ${Number(report.mileage_at_inspection).toLocaleString("pt-PT")} km`, margin + 4, y + 11);
    }
    if (report.inspection_lat && report.inspection_lng) {
      const loc = [report.inspection_city, report.inspection_country].filter(Boolean).join(", ");
      doc.text(
        `GPS: ${Number(report.inspection_lat).toFixed(5)}, ${Number(report.inspection_lng).toFixed(5)}${loc ? "  ·  " + loc : ""}`,
        margin + 4, y + 16
      );
    }
    if (report.started_at && report.completed_at) {
      doc.text(
        `Início: ${new Date(report.started_at).toLocaleString("pt-PT")}  ·  Conclusão: ${new Date(report.completed_at).toLocaleString("pt-PT")}`,
        margin + 4, y + 21
      );
    }
    y += 30;
  }

  // Mechanical checklist
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(15, 23, 42);
  doc.text("Checklist Mecânico", margin, y);
  y += 5;
  doc.setDrawColor(226, 232, 240);
  doc.line(margin, y, pageWidth - margin, y);
  y += 4;

  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  COMPONENTS.forEach(({ key, label }, i) => {
    const status = report[key] || "ok";
    const statusColor: [number, number, number] =
      status === "ok" ? [22, 163, 74] : status === "problems" ? [217, 119, 6] : [220, 38, 38];
    const xCol = i % 2 === 0 ? margin : margin + (pageWidth - margin * 2) / 2;
    if (i % 2 === 0 && i > 0) y += 6;
    doc.setTextColor(15, 23, 42);
    doc.text(label, xCol, y);
    doc.setTextColor(...statusColor);
    doc.setFont("helvetica", "bold");
    doc.text(STATUS_LABEL[status] || status, xCol + 50, y);
    doc.setFont("helvetica", "normal");
  });
  y += 10;

  // Defects
  if (report.defects?.length > 0) {
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(15, 23, 42);
    doc.text(`Anomalias Registadas (${report.defects.length})`, margin, y);
    y += 5;
    doc.line(margin, y, pageWidth - margin, y);
    y += 4;
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    report.defects.forEach((d: any, idx: number) => {
      if (y > 260) { doc.addPage(); y = 20; }
      const text = typeof d === "string" ? d : (d.description || JSON.stringify(d));
      const lines = doc.splitTextToSize(`${idx + 1}. ${text}`, pageWidth - margin * 2);
      doc.setTextColor(15, 23, 42);
      doc.text(lines, margin, y);
      y += lines.length * 4.5 + 2;
    });
    y += 4;
  }

  // Inspector notes
  if (report.inspector_notes) {
    if (y > 240) { doc.addPage(); y = 20; }
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(15, 23, 42);
    doc.text("Notas do Inspetor", margin, y);
    y += 5;
    doc.line(margin, y, pageWidth - margin, y);
    y += 4;
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    const notes = doc.splitTextToSize(report.inspector_notes, pageWidth - margin * 2);
    doc.text(notes, margin, y);
    y += notes.length * 4.5 + 6;
  }

  // Integrity / hash footer
  if (y > 240) { doc.addPage(); y = 20; }
  doc.setFillColor(240, 253, 244);
  doc.setDrawColor(187, 247, 208);
  doc.roundedRect(margin, y, pageWidth - margin * 2, 30, 2, 2, "FD");
  doc.setFontSize(8);
  doc.setTextColor(22, 101, 52);
  doc.setFont("helvetica", "bold");
  doc.text("CERTIFICAÇÃO DE INTEGRIDADE", margin + 4, y + 6);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(15, 23, 42);
  doc.setFontSize(8);
  doc.text("Este relatório foi selado digitalmente pelo sistema GarageFlow.", margin + 4, y + 11);
  doc.text("Qualquer alteração invalida o hash criptográfico abaixo.", margin + 4, y + 15);
  if (report.report_hash) {
    doc.setFont("courier", "normal");
    doc.setFontSize(7);
    doc.setTextColor(71, 85, 105);
    doc.text(`SHA-256: ${report.report_hash}`, margin + 4, y + 22);
  }
  doc.setFontSize(7);
  doc.setFont("helvetica", "italic");
  doc.setTextColor(100, 116, 139);
  const verifyUrl = report.verification_token
    ? `garageflow.pt/market/verify/${report.verification_token}`
    : `garageflow.pt/market/car/${listing.id}`;
  doc.text(
    `Verificar autenticidade: ${verifyUrl}  ·  Selado em ${
      report.locked_at ? new Date(report.locked_at).toLocaleString("pt-PT") : "—"
    }`,
    margin + 4,
    y + 27
  );

  // Page footer
  const pages = doc.getNumberOfPages();
  for (let p = 1; p <= pages; p++) {
    doc.setPage(p);
    doc.setFontSize(7);
    doc.setTextColor(148, 163, 184);
    doc.text(
      `GarageFlow Market · Certificado emitido eletronicamente · Página ${p}/${pages}`,
      pageWidth / 2,
      290,
      { align: "center" }
    );
  }

  const fileName = `Inspecao_${listing.make}_${listing.model}_${listing.year}_${listing.id?.slice(0, 6)}.pdf`
    .replace(/\s+/g, "_");
  doc.save(fileName);
}
