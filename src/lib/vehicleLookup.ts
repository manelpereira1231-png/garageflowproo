import { supabase } from "@/integrations/supabase/client";
import { getModelsForMake } from "@/components/VehicleMakeModelSelector";

export interface VehicleTechData {
  make?: string; model?: string; version?: string; description?: string; year?: number;
  registration_date?: string; fuel?: string; engine_cc?: number; seats?: number; vin?: string;
  colour?: string; gross_weight_kg?: number; net_weight_kg?: number; imported?: boolean; image_url?: string;
}

export interface LookupResult {
  status: string;
  message: string;
  source?: "api" | "cache";
  fetched_at?: string;
  data?: VehicleTechData;
}

const GENERIC_ERROR = "Não foi possível consultar esta matrícula neste momento. Pode preencher os dados manualmente ou tentar novamente mais tarde.";

/** Consulta server-side (a credencial do provider nunca chega ao browser). */
export async function lookupPlate(params: { shopId: string; plate: string; vehicleId?: string | null; force?: boolean }): Promise<LookupResult> {
  try {
    const { data, error } = await supabase.functions.invoke("vehicle-lookup", {
      body: { shop_id: params.shopId, plate: params.plate, vehicle_id: params.vehicleId ?? null, force: !!params.force },
    });
    if (error || !data) return { status: "error", message: (data as any)?.message || GENERIC_ERROR };
    return data as LookupResult;
  } catch {
    return { status: "error", message: GENERIC_ERROR };
  }
}

const norm = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]/g, "");

/** Faz corresponder o modelo devolvido ("Serie-3") ao catálogo do GarageFlow ("Série 3"). */
export function matchCatalogModel(make: string | undefined, model: string | undefined): string | undefined {
  if (!make || !model) return model;
  const list: string[] = getModelsForMake(make) || [];
  return list.find((m) => norm(m) === norm(model)) || model;
}

/** Converte o combustível do provider para os valores usados nos formulários. */
export function mapFuel(fuel?: string): string | undefined {
  if (!fuel) return undefined;
  const f = norm(fuel);
  if (f.includes("diesel") || f.includes("gasoleo")) return "Gasóleo";
  if (f.includes("gasolina")) return "Gasolina";
  if (f.includes("hibrid")) return "Híbrido";
  if (f.includes("eletric") || f.includes("electric")) return "Elétrico";
  if (f.includes("gpl")) return "GPL";
  return undefined;
}

export const TECH_LABELS: [keyof VehicleTechData, string, (v: any) => string][] = [
  ["make", "Marca", String],
  ["model", "Modelo", String],
  ["version", "Versão", String],
  ["year", "Ano", String],
  ["registration_date", "Data de matrícula", String],
  ["fuel", "Combustível", String],
  ["engine_cc", "Cilindrada", (v) => `${v} cm³`],
  ["seats", "Lugares", String],
  ["vin", "VIN / Chassis", String],
  ["colour", "Cor", String],
  ["gross_weight_kg", "Peso bruto", (v) => `${v} kg`],
  ["net_weight_kg", "Peso", (v) => `${v} kg`],
  ["imported", "Importado", (v) => (v ? "Sim" : "Não")],
];
