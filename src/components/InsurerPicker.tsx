import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Check, ChevronsUpDown } from "lucide-react";

/**
 * Seletor único de seguradora (lista central do Admin + seguradoras da oficina + "Outra").
 * Valor: { insurerId } (seguradora da oficina), { catalogId } (lista central) ou { other: nome }.
 * Use resolveInsurerId() ao guardar para obter o id da seguradora da oficina.
 */
export type InsurerSelection = { insurerId?: string; catalogId?: string; other?: string } | null;

type Opt = { key: string; label: string; sel: InsurerSelection };

export function InsurerPicker({
  shopId, value, onChange, label = "Seguradora",
}: { shopId: string | null; value: InsurerSelection; onChange: (v: InsurerSelection) => void; label?: string }) {
  const [catalog, setCatalog] = useState<any[]>([]);
  const [shopIns, setShopIns] = useState<any[]>([]);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!shopId) return;
    Promise.all([
      supabase.from("insurer_catalog").select("id, name").eq("active", true).order("sort_order").order("name"),
      supabase.from("insurers").select("id, name, catalog_id, active").eq("shop_id", shopId).order("name"),
    ]).then(([c, s]) => { setCatalog(c.data || []); setShopIns(s.data || []); });
  }, [shopId]);

  const options: Opt[] = useMemo(() => {
    const out: Opt[] = [];
    const linked = new Map(shopIns.filter((i) => i.catalog_id).map((i) => [i.catalog_id, i]));
    for (const c of catalog) {
      const s = linked.get(c.id);
      out.push({ key: "c" + c.id, label: c.name, sel: s ? { insurerId: s.id } : { catalogId: c.id } });
    }
    const names = new Set(catalog.map((c) => c.name.toLowerCase()));
    for (const s of shopIns) {
      if (s.catalog_id || !s.active || names.has(s.name.toLowerCase())) continue;
      out.push({ key: "s" + s.id, label: s.name, sel: { insurerId: s.id } });
    }
    return out;
  }, [catalog, shopIns]);

  const current = value?.other !== undefined
    ? "Outra seguradora"
    : options.find((o) => (value?.insurerId && o.sel?.insurerId === value.insurerId) || (value?.catalogId && o.sel?.catalogId === value.catalogId))?.label
      ?? shopIns.find((s) => s.id === value?.insurerId)?.name;

  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button type="button" variant="outline" className="w-full justify-between min-h-[44px] font-normal">
            {current || "Pesquisar/selecionar seguradora"}
            <ChevronsUpDown className="w-4 h-4 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="p-0 w-[--radix-popover-trigger-width]" align="start">
          <Command>
            <CommandInput placeholder="Pesquisar seguradora…" />
            <CommandList>
              <CommandEmpty>Sem resultados. Escolha "Outra seguradora".</CommandEmpty>
              <CommandGroup>
                <CommandItem value="__none" onSelect={() => { onChange(null); setOpen(false); }}>
                  — Ainda não sei —
                </CommandItem>
                {options.map((o) => (
                  <CommandItem key={o.key} value={o.label} onSelect={() => { onChange(o.sel); setOpen(false); }}>
                    <Check className={`w-4 h-4 mr-2 ${current === o.label ? "opacity-100" : "opacity-0"}`} />
                    {o.label}
                  </CommandItem>
                ))}
                <CommandItem value="Outra seguradora" onSelect={() => { onChange({ other: "" }); setOpen(false); }}>
                  Outra seguradora…
                </CommandItem>
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
      {value?.other !== undefined && (
        <Input placeholder="Nome da seguradora" value={value.other} onChange={(e) => onChange({ other: e.target.value })} />
      )}
    </div>
  );
}

/** Devolve o id da seguradora da oficina (cria-a a partir da lista central ou do nome, sem duplicar). */
export async function resolveInsurerId(shopId: string, sel: InsurerSelection): Promise<string | null> {
  if (!sel) return null;
  if (sel.insurerId) return sel.insurerId;
  if (sel.catalogId || (sel.other && sel.other.trim())) {
    const { data, error } = await supabase.rpc("ensure_shop_insurer" as any, {
      _shop_id: shopId, _catalog_id: sel.catalogId ?? null, _name: sel.other ?? null,
    });
    if (error) throw error;
    return data as unknown as string;
  }
  return null;
}
