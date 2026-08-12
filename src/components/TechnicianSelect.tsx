import { Link } from "react-router-dom";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useShopTechnicians, technicianDisplay } from "@/hooks/useShopTechnicians";

interface Props {
  shopId?: string | null;
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
  /** Permite a opção "sem técnico atribuído" */
  allowEmpty?: boolean;
  placeholder?: string;
  className?: string;
}

/**
 * Seletor de técnico — apenas técnicos registados na oficina.
 * Nunca permite escrever nomes livres.
 */
export default function TechnicianSelect({
  shopId,
  value,
  onChange,
  disabled,
  allowEmpty = true,
  placeholder = "Selecionar técnico",
  className,
}: Props) {
  const { technicians, byEmail, loading } = useShopTechnicians(shopId);
  const current = technicianDisplay(value, byEmail);

  if (!loading && technicians.length === 0) {
    return (
      <p className="text-xs text-muted-foreground">
        Sem técnicos registados nesta oficina.{" "}
        <Link to="/team" className="underline text-primary">Adicionar na Equipa</Link>
      </p>
    );
  }

  return (
    <Select
      value={value || "__none__"}
      onValueChange={(v) => onChange(v === "__none__" ? "" : v)}
      disabled={disabled || loading}
    >
      <SelectTrigger className={className}>
        <SelectValue placeholder={loading ? "A carregar…" : placeholder} />
      </SelectTrigger>
      <SelectContent>
        {allowEmpty && <SelectItem value="__none__">— Sem técnico atribuído —</SelectItem>}
        {technicians.map((n) => (
          <SelectItem key={n} value={n}>{n}</SelectItem>
        ))}
        {value && !technicians.includes(value) && (
          <SelectItem value={value}>{current} (histórico)</SelectItem>
        )}
      </SelectContent>
    </Select>
  );
}
