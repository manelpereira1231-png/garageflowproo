/**
 * Operação de oficina numa linha (ex.: "Pintura"). Ordem fixa e global:
 * "<peça/serviço> <Operação>" — a peça e o lado (D)/(E) ficam sempre primeiro.
 * Só altera o texto da linha; não muda nomes do catálogo.
 */
export const LINE_OPERATIONS = ["Pintura", "Bate-chapa", "Reparação", "Substituição", "Desmontagem/Montagem", "Polimento"];

const opRe = new RegExp(`\\s*(?:[·—-]\\s*)?(${LINE_OPERATIONS.map((o) => o.replace("/", "\\/")).join("|")})\\s*$`, "i");

export function splitLineOperation(name: string): { base: string; op: string | null } {
  const raw = name || "";
  const minutes = /\s*\(\d+\s*min\)\s*$/i.exec(raw)?.[0] || "";
  const noMin = minutes ? raw.slice(0, -minutes.length) : raw;
  // Aceita também a forma antiga "Pintura <peça>"
  const lead = new RegExp(`^(${LINE_OPERATIONS.join("|").replace("/", "\\/")})\\s+`, "i").exec(noMin);
  if (lead) return { base: noMin.slice(lead[0].length).trim() + minutes, op: LINE_OPERATIONS.find((o) => o.toLowerCase() === lead[1].toLowerCase()) || null };
  const m = opRe.exec(noMin);
  if (!m) return { base: raw, op: null };
  return { base: noMin.slice(0, m.index).trim() + minutes, op: LINE_OPERATIONS.find((o) => o.toLowerCase() === m[1].toLowerCase()) || null };
}

export function applyLineOperation(name: string, op: string | null): string {
  const { base } = splitLineOperation(name);
  if (!op) return base;
  const minutes = /\s*\(\d+\s*min\)\s*$/i.exec(base)?.[0] || "";
  const core = minutes ? base.slice(0, -minutes.length).trim() : base.trim();
  return `${core} ${op}${minutes}`;
}

export function LineOperationChips({ name, onChange }: { name: string; onChange: (n: string) => void }) {
  const { op } = splitLineOperation(name);
  return (
    <div className="flex flex-wrap gap-1.5" aria-label="Operação">
      <span className="text-[11px] text-muted-foreground self-center mr-1">Operação:</span>
      {LINE_OPERATIONS.map((o) => (
        <button key={o} type="button" aria-pressed={op === o}
          onClick={() => onChange(applyLineOperation(name, op === o ? null : o))}
          className={`text-[11px] rounded-full border px-2.5 min-h-[28px] transition-colors ${op === o ? "bg-primary text-primary-foreground border-primary" : "bg-card border-border hover:border-primary/60"}`}>
          {o}
        </button>
      ))}
    </div>
  );
}
