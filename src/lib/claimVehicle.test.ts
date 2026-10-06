import { describe, expect, it } from "vitest";
import { claimVehicleLabel } from "./claimVehicle";

describe("Expert vehicle identity", () => {
  it("includes make, model, version, plate and year", () => {
    expect(claimVehicleLabel({ make: "BMW", model: "320d", version: "Touring", plate: "12-AB-34", year: 2020 })).toBe("BMW 320d Touring · 12-AB-34 · 2020");
  });
  it("does not invent missing vehicle data or separators", () => {
    expect(claimVehicleLabel(null)).toBe("");
    expect(claimVehicleLabel({ plate: "ABC1D23" })).toBe("ABC1D23");
  });
});