import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

interface PdfLine {
  type: string;
  name: string;
  quantity: number;
  unit_price: number;
  unit_cost: number;
  vat_rate: number;
}

interface PdfData {
  type: 'quote' | 'service';
  number: string;
  date: string;
  validityDate?: string;
  shopName: string;
  shopEmail: string;
  shopPhone: string;
  clientName: string;
  clientEmail?: string;
  clientPhone?: string;
  clientNif?: string;
  vehicleMake: string;
  vehicleModel: string;
  vehiclePlate: string;
  lines: PdfLine[];
  subtotal: number;
  vatTotal: number;
  total: number;
  profit: number;
  notes?: string;
  technician?: string;
  diagnosis?: string;
  laborHours?: number;
  currency: string;
}

export function generatePdf(data: PdfData, watermark: boolean): jsPDF {
  const doc = new jsPDF();
  const cur = data.currency === 'EUR' ? '€' : data.currency;
  const pageW = doc.internal.pageSize.getWidth();

  // Header bar
  doc.setFillColor(38, 38, 38);
  doc.rect(0, 0, pageW, 40, 'F');

  // Brand
  doc.setTextColor(255, 180, 30);
  doc.setFontSize(22);
  doc.setFont("helvetica", "bold");
  doc.text("GarageFlow", 14, 20);

  doc.setTextColor(180, 180, 180);
  doc.setFontSize(9);
  doc.text(data.shopName, 14, 28);
  doc.text(`${data.shopEmail} | ${data.shopPhone}`, 14, 34);

  // Document type + number
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  const typeLabel = data.type === 'quote' ? 'ORÇAMENTO' : 'ORDEM DE SERVIÇO';
  doc.text(typeLabel, pageW - 14, 18, { align: "right" });
  doc.setFontSize(11);
  doc.text(data.number, pageW - 14, 26, { align: "right" });
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.text(`Data: ${data.date}`, pageW - 14, 34, { align: "right" });

  // Client info
  let y = 50;
  doc.setTextColor(38, 38, 38);
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.text("CLIENTE", 14, y);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  y += 6;
  doc.text(data.clientName, 14, y);
  if (data.clientNif) { y += 5; doc.text(`NIF: ${data.clientNif}`, 14, y); }
  if (data.clientEmail) { y += 5; doc.text(data.clientEmail, 14, y); }
  if (data.clientPhone) { y += 5; doc.text(data.clientPhone, 14, y); }

  // Vehicle info
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text("VEÍCULO", pageW / 2, 50);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text(`${data.vehicleMake} ${data.vehicleModel}`, pageW / 2, 56);
  doc.text(`Matrícula: ${data.vehiclePlate}`, pageW / 2, 61);

  if (data.type === 'service') {
    if (data.technician) doc.text(`Técnico: ${data.technician}`, pageW / 2, 66);
    if (data.laborHours) doc.text(`Horas: ${data.laborHours}h`, pageW / 2, 71);
  }

  if (data.validityDate) {
    doc.text(`Válido até: ${data.validityDate}`, pageW / 2, data.type === 'service' ? 76 : 66);
  }

  // Lines table
  const tableY = Math.max(y + 12, 82);
  const tableData = data.lines.map(l => [
    l.type === 'service' ? 'Serviço' : 'Peça',
    l.name,
    String(l.quantity),
    `${cur}${l.unit_price.toFixed(2)}`,
    `${l.vat_rate}%`,
    `${cur}${(l.quantity * l.unit_price).toFixed(2)}`,
  ]);

  autoTable(doc, {
    startY: tableY,
    head: [['Tipo', 'Descrição', 'Qtd', 'Preço', 'IVA', 'Total']],
    body: tableData,
    theme: 'striped',
    headStyles: { fillColor: [38, 38, 38], textColor: [255, 180, 30], fontStyle: 'bold', fontSize: 8 },
    bodyStyles: { fontSize: 8 },
    columnStyles: {
      0: { cellWidth: 22 },
      2: { cellWidth: 16, halign: 'center' },
      3: { cellWidth: 26, halign: 'right' },
      4: { cellWidth: 16, halign: 'center' },
      5: { cellWidth: 28, halign: 'right' },
    },
    margin: { left: 14, right: 14 },
  });

  // Totals
  const finalY = (doc as any).lastAutoTable.finalY + 10;
  const totalsX = pageW - 14;

  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.text(`Subtotal: ${cur}${data.subtotal.toFixed(2)}`, totalsX, finalY, { align: "right" });
  doc.text(`IVA: ${cur}${data.vatTotal.toFixed(2)}`, totalsX, finalY + 6, { align: "right" });

  doc.setFillColor(38, 38, 38);
  doc.rect(pageW - 80, finalY + 9, 66, 10, 'F');
  doc.setTextColor(255, 180, 30);
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.text(`TOTAL: ${cur}${data.total.toFixed(2)}`, totalsX, finalY + 16, { align: "right" });

  // Diagnosis (for services)
  if (data.type === 'service' && data.diagnosis) {
    doc.setTextColor(38, 38, 38);
    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    doc.text("DIAGNÓSTICO", 14, finalY + 28);
    doc.setFont("helvetica", "normal");
    const diagLines = doc.splitTextToSize(data.diagnosis, pageW - 28);
    doc.text(diagLines, 14, finalY + 34);
  }

  // Notes
  if (data.notes) {
    const notesY = data.diagnosis ? finalY + 46 : finalY + 28;
    doc.setTextColor(38, 38, 38);
    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    doc.text("NOTAS", 14, notesY);
    doc.setFont("helvetica", "normal");
    const noteLines = doc.splitTextToSize(data.notes, pageW - 28);
    doc.text(noteLines, 14, notesY + 6);
  }

  // Watermark for free plan
  if (watermark) {
    doc.setTextColor(200, 200, 200);
    doc.setFontSize(50);
    doc.setFont("helvetica", "bold");
    // Rotate and center
    const centerX = pageW / 2;
    const centerY = doc.internal.pageSize.getHeight() / 2;
    doc.saveGraphicsState();
    doc.text("GarageFlow", centerX, centerY, {
      align: "center",
      angle: 45,
    });
    doc.restoreGraphicsState();
  }

  // Footer
  const pageH = doc.internal.pageSize.getHeight();
  doc.setTextColor(150, 150, 150);
  doc.setFontSize(7);
  doc.text(`Gerado por GarageFlow — ${data.shopName}`, pageW / 2, pageH - 8, { align: "center" });

  return doc;
}

export function exportToCsv(data: any[], filename: string) {
  if (data.length === 0) return;
  const headers = Object.keys(data[0]);
  const csvRows = [
    headers.join(';'),
    ...data.map(row => headers.map(h => {
      const val = row[h];
      if (val === null || val === undefined) return '';
      if (typeof val === 'object') return JSON.stringify(val);
      return String(val).replace(/;/g, ',');
    }).join(';'))
  ];
  const blob = new Blob(['\uFEFF' + csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${filename}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}
