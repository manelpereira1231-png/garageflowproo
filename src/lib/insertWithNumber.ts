import { supabase } from "@/integrations/supabase/client";

/**
 * Cria um documento numerado (fatura / orçamento / OS) de forma resiliente.
 *
 * A base de dados tem um índice único (shop_id, number). Se dois pedidos
 * simultâneos (ou um duplo clique) tentarem usar o mesmo número, o segundo
 * falha com erro 23505 — aqui voltamos a pedir um número novo e tentamos de novo.
 */
export async function insertWithNumber<T>(opts: {
  getNumber: () => Promise<string>;
  insert: (number: string) => Promise<{ data: T | null; error: { code?: string; message?: string } | null }>;
  attempts?: number;
}): Promise<{ data: T | null; number: string | null; error: { code?: string; message?: string } | null }> {
  const attempts = opts.attempts ?? 4;
  let lastError: { code?: string; message?: string } | null = null;

  for (let i = 0; i < attempts; i++) {
    const number = await opts.getNumber();
    const { data, error } = await opts.insert(number);
    if (!error) return { data, number, error: null };
    lastError = error;
    const isDuplicate =
      error.code === "23505" || /duplicate key|uniq_.*_shop_number/i.test(error.message || "");
    if (!isDuplicate) break;
    // pequena espera para desfasar pedidos concorrentes
    await new Promise((r) => setTimeout(r, 60 * (i + 1)));
  }

  return { data: null, number: null, error: lastError };
}

/** Mensagem amigável para erros de numeração duplicada. */
export function friendlyDocError(error: { code?: string; message?: string } | null): string {
  if (!error) return "";
  if (error.code === "23505" || /duplicate key/i.test(error.message || "")) {
    return "Já existe um documento com este número. Tente novamente.";
  }
  return error.message || "Ocorreu um erro. Tente novamente.";
}

export async function nextInvoiceNumber(shopId: string): Promise<string> {
  const { data } = await supabase.rpc("next_invoice_number", { _shop_id: shopId });
  return data || `FAT-${new Date().getFullYear()}-0001`;
}

export async function nextDocNumber(shopId: string, prefix: "ORC" | "SRV"): Promise<string> {
  const { data } = await supabase.rpc("next_number", { _shop_id: shopId, _prefix: prefix });
  return data || `${prefix}-${Date.now()}`;
}
