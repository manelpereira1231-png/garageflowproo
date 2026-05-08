import { FileText } from "lucide-react";

const ROWS = [
  { n: "ORC-2025-0142", c: "Maria Silva", v: "BMW 320d", t: "€ 245,00", s: "Aprovado", color: "bg-green-500/15 text-green-600" },
  { n: "ORC-2025-0141", c: "João Pereira", v: "VW Golf", t: "€ 480,50", s: "Pendente", color: "bg-amber-500/15 text-amber-600" },
  { n: "ORC-2025-0140", c: "Ana Costa", v: "Renault Clio", t: "€ 95,00", s: "Aprovado", color: "bg-green-500/15 text-green-600" },
  { n: "ORC-2025-0139", c: "Pedro Sousa", v: "Audi A4", t: "€ 1.230,00", s: "Em revisão", color: "bg-primary/15 text-primary" },
  { n: "ORC-2025-0138", c: "Rui Mendes", v: "Mercedes C220", t: "€ 720,00", s: "Faturado", color: "bg-foreground/10 text-foreground" },
  { n: "ORC-2025-0137", c: "Sofia Lima", v: "Peugeot 308", t: "€ 180,00", s: "Aprovado", color: "bg-green-500/15 text-green-600" },
];

export default function SpreadsheetMockup() {
  return (
    <div className="rounded-2xl overflow-hidden border border-border shadow-xl bg-card">
      <div className="flex items-center gap-2 px-4 py-2.5 border-b border-border bg-muted/40">
        <FileText className="w-4 h-4 text-primary" />
        <span className="text-xs font-semibold">Orçamentos</span>
        <span className="ml-auto text-[10px] text-muted-foreground">142 registos</span>
      </div>
      <div className="overflow-hidden">
        <table className="w-full text-xs">
          <thead className="bg-muted/30 text-[10px] uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="text-left px-3 py-2 font-semibold">Nº</th>
              <th className="text-left px-3 py-2 font-semibold">Cliente</th>
              <th className="text-left px-3 py-2 font-semibold hidden sm:table-cell">Viatura</th>
              <th className="text-right px-3 py-2 font-semibold">Total</th>
              <th className="text-right px-3 py-2 font-semibold">Estado</th>
            </tr>
          </thead>
          <tbody>
            {ROWS.map((r) => (
              <tr key={r.n} className="border-t border-border/60">
                <td className="px-3 py-2 font-mono text-[10px] text-muted-foreground">{r.n}</td>
                <td className="px-3 py-2 font-medium truncate max-w-[120px]">{r.c}</td>
                <td className="px-3 py-2 text-muted-foreground hidden sm:table-cell">{r.v}</td>
                <td className="px-3 py-2 text-right tabular-nums font-semibold">{r.t}</td>
                <td className="px-3 py-2 text-right">
                  <span className={`text-[9px] font-semibold px-2 py-0.5 rounded-full ${r.color}`}>{r.s}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
