import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Download, FileSpreadsheet, FileText } from "lucide-react";
import { toast } from "sonner";

const REPORTS = [
  { id: "revenue", label: "Receita (todos os pagamentos)" },
  { id: "shops", label: "Oficinas registadas" },
  { id: "conversions", label: "Conversões (subscrições ativas)" },
  { id: "retention", label: "Retenção (last_seen)" },
  { id: "growth", label: "Crescimento (registos por mês)" },
  { id: "activity", label: "Atividade comercial (leads + reuniões)" },
];

function toCSV(rows: any[]) {
  if (!rows.length) return "";
  const headers = Object.keys(rows[0]);
  const esc = (v: any) => {
    const s = v === null || v === undefined ? "" : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [headers.join(","), ...rows.map((r) => headers.map((h) => esc(r[h])).join(","))].join("\n");
}

function download(filename: string, content: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

async function buildReport(id: string): Promise<any[]> {
  switch (id) {
    case "revenue": {
      const { data } = await supabase.from("payments").select("paid_at, amount, method, shop_id").order("paid_at", { ascending: false });
      return data || [];
    }
    case "shops": {
      const { data } = await supabase.from("shops").select("id, name, email, phone, country, status, created_at, last_seen_at").order("created_at", { ascending: false });
      return data || [];
    }
    case "conversions": {
      const { data } = await supabase.from("subscriptions").select("shop_id, plan, status, created_at, current_period_end");
      return data || [];
    }
    case "retention": {
      const { data } = await supabase.from("shops").select("id, name, email, last_seen_at, status");
      return data || [];
    }
    case "growth": {
      const { data } = await supabase.from("shops").select("created_at");
      const map: Record<string, number> = {};
      (data || []).forEach((s: any) => {
        const d = new Date(s.created_at);
        const k = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
        map[k] = (map[k] || 0) + 1;
      });
      return Object.entries(map).sort().map(([month, count]) => ({ month, new_shops: count }));
    }
    case "activity": {
      const [leads, meetings] = await Promise.all([
        supabase.from("crm_leads" as any).select("*"),
        supabase.from("crm_meetings" as any).select("*"),
      ]);
      return [
        ...((leads.data || []) as any[]).map((l) => ({ type: "lead", ...l })),
        ...((meetings.data || []) as any[]).map((m) => ({ type: "meeting", ...m })),
      ];
    }
  }
  return [];
}

export default function CommercialReports() {
  const [busy, setBusy] = useState<string | null>(null);

  const handle = async (id: string, format: "csv" | "xlsx" | "pdf") => {
    setBusy(id + format);
    try {
      const rows = await buildReport(id);
      if (!rows.length) { toast.error("Sem dados para este relatório."); return; }
      if (format === "csv") {
        download(`${id}.csv`, toCSV(rows), "text/csv;charset=utf-8");
      } else if (format === "xlsx") {
        // Excel reads CSV with .xls extension natively; avoids extra deps.
        download(`${id}.xls`, toCSV(rows), "application/vnd.ms-excel");
      } else {
        // Simple printable HTML → user prints to PDF
        const headers = Object.keys(rows[0]);
        const html = `<html><head><meta charset="utf-8"><title>${id}</title>
          <style>body{font-family:sans-serif;padding:24px}table{border-collapse:collapse;width:100%;font-size:11px}th,td{border:1px solid #ccc;padding:4px 6px;text-align:left}th{background:#f3f4f6}</style>
          </head><body><h1>Relatório: ${id}</h1>
          <table><thead><tr>${headers.map(h => `<th>${h}</th>`).join("")}</tr></thead>
          <tbody>${rows.map(r => `<tr>${headers.map(h => `<td>${(r[h] ?? "") + ""}</td>`).join("")}</tr>`).join("")}</tbody></table>
          <script>window.print()</script></body></html>`;
        const w = window.open("", "_blank");
        if (w) { w.document.write(html); w.document.close(); }
      }
      toast.success("Relatório gerado");
    } catch (e: any) {
      toast.error(e?.message || "Erro a gerar relatório");
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-2xl font-bold">Relatórios</h2>
        <p className="text-sm text-muted-foreground">Exporte dados reais em CSV, Excel ou PDF.</p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {REPORTS.map((r) => (
          <Card key={r.id}>
            <CardHeader><CardTitle className="text-sm">{r.label}</CardTitle></CardHeader>
            <CardContent className="flex flex-wrap gap-2">
              <Button size="sm" variant="outline" disabled={busy === r.id + "csv"} onClick={() => handle(r.id, "csv")}><Download className="w-4 h-4 mr-1" /> CSV</Button>
              <Button size="sm" variant="outline" disabled={busy === r.id + "xlsx"} onClick={() => handle(r.id, "xlsx")}><FileSpreadsheet className="w-4 h-4 mr-1" /> Excel</Button>
              <Button size="sm" variant="outline" disabled={busy === r.id + "pdf"} onClick={() => handle(r.id, "pdf")}><FileText className="w-4 h-4 mr-1" /> PDF</Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
