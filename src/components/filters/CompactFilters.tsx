/**
 * Filtros compactos reutilizáveis (apenas UI).
 * - Desktop: uma única linha de controlos compactos.
 * - Mobile: pesquisa + botão "Filtros" que abre um painel (Sheet) com os mesmos controlos.
 * Não contém lógica de filtragem — apenas apresentação.
 */
import * as React from "react";
import { Check, ChevronsUpDown, CalendarDays, SlidersHorizontal, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

/* ── Combobox pesquisável (Estado, Cliente, Técnico…) ─────────────── */
export function FilterCombobox({
  value, onChange, options, placeholder, searchPlaceholder, className, fullWidth,
}: {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  placeholder: string;
  searchPlaceholder?: string;
  className?: string;
  fullWidth?: boolean;
}) {
  const [open, setOpen] = React.useState(false);
  const selected = options.find((o) => o.value === value);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          size="sm"
          className={cn("h-9 justify-between gap-1 font-normal", fullWidth ? "w-full" : "min-w-[130px]", className)}
        >
          <span className={cn("truncate", !selected && "text-muted-foreground")}>
            {selected ? selected.label : placeholder}
          </span>
          <ChevronsUpDown className="w-3.5 h-3.5 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="p-0 w-[240px]" align="start">
        <Command>
          <CommandInput placeholder={searchPlaceholder || "Pesquisar…"} className="h-9" />
          <CommandList>
            <CommandEmpty>Sem resultados.</CommandEmpty>
            <CommandGroup>
              {options.map((o) => (
                <CommandItem
                  key={o.value || "__all"}
                  value={o.label}
                  onSelect={() => { onChange(o.value); setOpen(false); }}
                >
                  <Check className={cn("mr-2 h-4 w-4", o.value === value ? "opacity-100" : "opacity-0")} />
                  <span className="truncate">{o.label}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

/* ── Intervalo de datas num único botão ───────────────────────────── */
const fmt = (d: string) => (d ? d.split("-").reverse().join("/") : "");

export function FilterDateRange({
  from, to, onFrom, onTo, fullWidth,
}: {
  from: string; to: string; onFrom: (v: string) => void; onTo: (v: string) => void; fullWidth?: boolean;
}) {
  const label = from || to ? `${fmt(from) || "…"} – ${fmt(to) || "…"}` : "Data";
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className={cn("h-9 justify-between gap-1 font-normal", fullWidth ? "w-full" : "min-w-[130px]")}
        >
          <span className={cn("truncate flex items-center gap-1.5", !from && !to && "text-muted-foreground")}>
            <CalendarDays className="w-3.5 h-3.5" /> {label}
          </span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[240px] space-y-2" align="start">
        <div className="space-y-1">
          <label className="text-[11px] text-muted-foreground">Data desde</label>
          <Input type="date" value={from} onChange={(e) => onFrom(e.target.value)} className="h-9" />
        </div>
        <div className="space-y-1">
          <label className="text-[11px] text-muted-foreground">Data até</label>
          <Input type="date" value={to} onChange={(e) => onTo(e.target.value)} className="h-9" />
        </div>
        {(from || to) && (
          <Button variant="ghost" size="sm" className="w-full" onClick={() => { onFrom(""); onTo(""); }}>
            Limpar datas
          </Button>
        )}
      </PopoverContent>
    </Popover>
  );
}

/* ── Barra: desktop inline / mobile em painel ─────────────────────── */
export function CompactFilterBar({
  search, filters, activeCount, onClear,
}: {
  /** Campo de pesquisa (sempre visível). */
  search?: React.ReactNode;
  /** Render dos controlos; `stacked` indica painel mobile. */
  filters: (stacked: boolean) => React.ReactNode;
  activeCount: number;
  onClear?: () => void;
}) {
  const [open, setOpen] = React.useState(false);
  return (
    <div className="mb-3">
      {/* Desktop / tablet */}
      <div className="hidden md:flex flex-wrap items-center gap-2">
        {search && <div className="relative w-full max-w-[260px]">{search}</div>}
        {filters(false)}
        {activeCount > 0 && onClear && (
          <Button variant="ghost" size="sm" className="h-9 px-2" onClick={onClear} title="Limpar filtros">
            <X className="w-4 h-4" />
          </Button>
        )}
      </div>

      {/* Mobile */}
      <div className="flex md:hidden items-center gap-2">
        {search && <div className="relative flex-1 min-w-0">{search}</div>}
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger asChild>
            <Button variant="outline" size="sm" className="h-10 shrink-0 gap-1.5">
              <SlidersHorizontal className="w-4 h-4" />
              Filtros
              {activeCount > 0 && (
                <Badge variant="secondary" className="ml-0.5 h-5 min-w-5 px-1 text-[11px]">{activeCount}</Badge>
              )}
            </Button>
          </SheetTrigger>
          <SheetContent side="bottom" className="max-h-[85vh] overflow-y-auto">
            <SheetHeader className="text-left">
              <SheetTitle>Filtros{activeCount > 0 ? ` · ${activeCount} ativos` : ""}</SheetTitle>
            </SheetHeader>
            <div className="mt-4 space-y-3">{filters(true)}</div>
            <div className="mt-4 flex gap-2">
              {onClear && (
                <Button variant="outline" className="flex-1" onClick={onClear} disabled={activeCount === 0}>
                  Limpar filtros
                </Button>
              )}
              <Button className="flex-1" onClick={() => setOpen(false)}>Ver resultados</Button>
            </div>
          </SheetContent>
        </Sheet>
      </div>
    </div>
  );
}
