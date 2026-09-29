/**
 * Nome oficial do cliente: Empresa (entidade fiscal) quando preenchida; senão Nome.
 * O Nome passa a ser apenas contacto secundário quando existe Empresa.
 */
export function clientDisplayName(c?: { name?: string | null; company?: string | null } | null): string {
  if (!c) return "";
  const company = (c.company || "").trim();
  return company || (c.name || "").trim();
}

/** Pessoa de contacto — só devolve algo quando é diferente do nome oficial. */
export function clientContactName(c?: { name?: string | null; company?: string | null } | null): string {
  if (!c) return "";
  const company = (c.company || "").trim();
  const name = (c.name || "").trim();
  return company && name && name.toLowerCase() !== company.toLowerCase() ? name : "";
}
