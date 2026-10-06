/** Only the claim's linked vehicle identifies an expert request. */
export function claimVehicleLabel(vehicle: { make?: string | null; model?: string | null; version?: string | null; plate?: string | null; year?: number | null } | null | undefined): string {
  if (!vehicle) return "";
  return [[vehicle.make, vehicle.model, vehicle.version].filter(Boolean).join(" "), vehicle.plate, vehicle.year].filter(Boolean).join(" · ");
}