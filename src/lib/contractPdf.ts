import { jsPDF } from "jspdf";

interface ContractData {
  contract: any;
  listing: any;
  buyer: any;
  seller: any;
  amount: number;
}

export function generateContractPDF({ contract, listing, buyer, seller, amount }: ContractData) {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 18;
  let y = 20;

  // Header
  doc.setFillColor(15, 23, 42);
  doc.rect(0, 0, pageWidth, 32, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(20);
  doc.setFont("helvetica", "bold");
  doc.text("GarageFlow Market", margin, 14);
  doc.setFontSize(11);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(251, 191, 36);
  doc.text("CONTRATO DE COMPRA E VENDA DE VEÍCULO USADO", margin, 22);
  doc.setTextColor(203, 213, 225);
  doc.setFontSize(8);
  doc.text(`Nº ${contract.contract_number}`, pageWidth - margin, 14, { align: "right" });
  doc.text(`Emitido em ${new Date(contract.created_at).toLocaleDateString("pt-PT")}`, pageWidth - margin, 19, { align: "right" });

  y = 42;
  doc.setTextColor(15, 23, 42);

  // Intro
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(71, 85, 105);
  const intro = "Pelo presente contrato, celebrado entre as partes abaixo identificadas e através da plataforma GarageFlow Market, é acordada a compra e venda do veículo automóvel usado descrito infra, nas condições e termos seguintes:";
  const introLines = doc.splitTextToSize(intro, pageWidth - margin * 2);
  doc.text(introLines, margin, y);
  y += introLines.length * 4 + 6;

  // Section: Parties
  drawSectionTitle(doc, "PRIMEIRO OUTORGANTE — VENDEDOR", margin, y, pageWidth);
  y += 8;
  doc.setFontSize(9);
  doc.setTextColor(15, 23, 42);
  drawKV(doc, "Nome", seller?.name || "—", margin, y); y += 5;
  drawKV(doc, "NIF", seller?.nif || "—", margin, y); y += 5;
  drawKV(doc, "Documento", `${docTypeLabel(seller?.document_type)} nº ${seller?.document_number || "—"}`, margin, y); y += 5;
  drawKV(doc, "Morada", seller?.address || seller?.location || "—", margin, y); y += 5;
  drawKV(doc, "Telefone", seller?.phone || "—", margin, y); y += 8;

  drawSectionTitle(doc, "SEGUNDO OUTORGANTE — COMPRADOR", margin, y, pageWidth);
  y += 8;
  drawKV(doc, "Nome", buyer?.name || buyer?.full_name || "—", margin, y); y += 5;
  drawKV(doc, "NIF", buyer?.nif || "—", margin, y); y += 5;
  drawKV(doc, "Email", buyer?.email || "—", margin, y); y += 5;
  drawKV(doc, "Telefone", buyer?.phone || "—", margin, y); y += 5;
  drawKV(doc, "Morada", buyer?.address || "—", margin, y); y += 8;

  // Section: Vehicle
  drawSectionTitle(doc, "OBJETO DO CONTRATO — VEÍCULO", margin, y, pageWidth);
  y += 8;
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(margin, y, pageWidth - margin * 2, 32, 2, 2, "FD");
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.text(`${listing.make} ${listing.model} (${listing.year})`, margin + 4, y + 7);
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(71, 85, 105);
  doc.text(`Matrícula: ${listing.plate || "—"}`, margin + 4, y + 14);
  doc.text(`Quilometragem: ${listing.mileage?.toLocaleString("pt-PT") || "—"} km`, margin + 4, y + 19);
  doc.text(`Combustível: ${listing.fuel || "—"}`, margin + 4, y + 24);
  doc.text(`VIN/Chassi: ${listing.vin || "n/d"}`, margin + 70, y + 14);
  doc.text(`Cor: ${listing.color || "n/d"}`, margin + 70, y + 19);
  y += 38;

  // Section: Price
  drawSectionTitle(doc, "PREÇO E CONDIÇÕES DE PAGAMENTO", margin, y, pageWidth);
  y += 8;
  doc.setFillColor(254, 252, 232);
  doc.setDrawColor(254, 215, 170);
  doc.roundedRect(margin, y, pageWidth - margin * 2, 22, 2, 2, "FD");
  doc.setFontSize(9);
  doc.setTextColor(120, 53, 15);
  doc.setFont("helvetica", "bold");
  doc.text("PREÇO ACORDADO", margin + 4, y + 6);
  doc.setFontSize(18);
  doc.setTextColor(15, 23, 42);
  doc.text(`${amount.toLocaleString("pt-PT", { minimumFractionDigits: 2 })} €`, margin + 4, y + 16);
  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(71, 85, 105);
  doc.text("Pagamento via Pagamento Protegido (Escrow Stripe)", pageWidth - margin - 4, y + 10, { align: "right" });
  doc.text("Fundos retidos até confirmação de entrega pelo comprador", pageWidth - margin - 4, y + 15, { align: "right" });
  y += 28;

  // Clauses
  if (y > 220) { doc.addPage(); y = 20; }
  drawSectionTitle(doc, "CLÁUSULAS GERAIS", margin, y, pageWidth);
  y += 7;
  const clauses = [
    "1. O Vendedor declara ser o legítimo proprietário do veículo, livre de ónus, encargos ou penhoras, e que o veículo não se encontra penhorado, hipotecado ou apreendido.",
    "2. O Comprador declara que examinou o veículo, tomou conhecimento do relatório de inspeção técnica emitido por oficina parceira da GarageFlow, e aceita o estado em que se encontra.",
    "3. O preço acordado é pago via plataforma GarageFlow Market através de sistema de Pagamento Protegido (Escrow). Os fundos só são libertados ao Vendedor após confirmação de entrega pelo Comprador ou esgotamento do prazo de 7 dias.",
    "4. A propriedade e o risco do veículo transferem-se para o Comprador no momento da entrega física e da apresentação dos documentos (Livrete, DUA/DUV, IUC).",
    "5. O Vendedor obriga-se a entregar o veículo nas condições descritas no anúncio e no relatório de inspeção. Qualquer divergência relevante constitui fundamento de disputa.",
    "6. O Comprador pode abrir disputa formal nos primeiros 7 dias após a entrega, em caso de divergência grave. A GarageFlow atua como mediador imparcial.",
    "7. A GarageFlow Market cobra uma comissão de 2% sobre o valor da venda, deduzida do montante a entregar ao Vendedor.",
    "8. Este contrato rege-se pela lei portuguesa, sendo competente para resolver litígios o Tribunal Judicial da Comarca de Lisboa, com expressa renúncia a qualquer outro.",
  ];
  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(15, 23, 42);
  clauses.forEach((c) => {
    if (y > 270) { doc.addPage(); y = 20; }
    const lines = doc.splitTextToSize(c, pageWidth - margin * 2);
    doc.text(lines, margin, y);
    y += lines.length * 4 + 2;
  });

  // Signatures
  if (y > 240) { doc.addPage(); y = 20; }
  y += 6;
  drawSectionTitle(doc, "ASSINATURAS DIGITAIS", margin, y, pageWidth);
  y += 8;

  const sigBoxW = (pageWidth - margin * 2 - 6) / 2;
  drawSignatureBox(doc, "VENDEDOR", seller?.name || "—", contract.seller_signed_at, margin, y, sigBoxW);
  drawSignatureBox(doc, "COMPRADOR", buyer?.name || buyer?.full_name || "—", contract.buyer_signed_at, margin + sigBoxW + 6, y, sigBoxW);
  y += 32;

  // Integrity
  if (y > 250) { doc.addPage(); y = 20; }
  doc.setFillColor(240, 253, 244);
  doc.setDrawColor(187, 247, 208);
  doc.roundedRect(margin, y, pageWidth - margin * 2, 26, 2, 2, "FD");
  doc.setFontSize(8);
  doc.setTextColor(22, 101, 52);
  doc.setFont("helvetica", "bold");
  doc.text("CERTIFICAÇÃO DE INTEGRIDADE", margin + 4, y + 6);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(15, 23, 42);
  doc.text("Este contrato foi gerado e selado digitalmente pelo sistema GarageFlow Market.", margin + 4, y + 11);
  if (contract.contract_hash) {
    doc.setFont("courier", "normal");
    doc.setFontSize(7);
    doc.setTextColor(71, 85, 105);
    doc.text(`SHA-256: ${contract.contract_hash}`, margin + 4, y + 17);
  }
  doc.setFont("helvetica", "italic");
  doc.setFontSize(7);
  doc.setTextColor(100, 116, 139);
  doc.text(`Verificável em garageflow.pt/contract/${contract.id}`, margin + 4, y + 22);

  // Footer
  const pages = doc.getNumberOfPages();
  for (let p = 1; p <= pages; p++) {
    doc.setPage(p);
    doc.setFontSize(7);
    doc.setTextColor(148, 163, 184);
    doc.text(
      `Contrato GarageFlow Market · ${contract.contract_number} · Página ${p}/${pages}`,
      pageWidth / 2, 290, { align: "center" }
    );
  }

  doc.save(`Contrato_${contract.contract_number}.pdf`);
}

function drawSectionTitle(doc: jsPDF, title: string, x: number, y: number, pageWidth: number) {
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(15, 23, 42);
  doc.text(title, x, y);
  doc.setDrawColor(251, 191, 36);
  doc.setLineWidth(0.6);
  doc.line(x, y + 1.5, pageWidth - x, y + 1.5);
  doc.setLineWidth(0.2);
}

function drawKV(doc: jsPDF, key: string, value: string, x: number, y: number) {
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139);
  doc.text(`${key}:`, x, y);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(15, 23, 42);
  doc.setFontSize(9);
  doc.text(value, x + 28, y);
}

function drawSignatureBox(doc: jsPDF, role: string, name: string, signedAt: string | null, x: number, y: number, w: number) {
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(x, y, w, 28, 2, 2, "S");
  doc.setFontSize(7);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(100, 116, 139);
  doc.text(role, x + 3, y + 5);
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(15, 23, 42);
  doc.text(name, x + 3, y + 13);
  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  if (signedAt) {
    doc.setTextColor(22, 163, 74);
    doc.text(`✓ Assinado digitalmente`, x + 3, y + 20);
    doc.setFontSize(7);
    doc.setTextColor(100, 116, 139);
    doc.text(new Date(signedAt).toLocaleString("pt-PT"), x + 3, y + 25);
  } else {
    doc.setTextColor(217, 119, 6);
    doc.text(`Aguardando assinatura`, x + 3, y + 20);
  }
}

function docTypeLabel(t?: string) {
  if (t === "passport") return "Passaporte";
  if (t === "driver_license") return "Carta de Condução";
  return "Cartão de Cidadão";
}

export async function computeContractHash(payload: object): Promise<string> {
  const json = JSON.stringify(payload, Object.keys(payload).sort());
  const buf = new TextEncoder().encode(json);
  const hashBuf = await crypto.subtle.digest("SHA-256", buf);
  return Array.from(new Uint8Array(hashBuf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
