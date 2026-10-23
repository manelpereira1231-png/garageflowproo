import { describe, expect, it, vi } from "vitest";
vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));
vi.mock("@/hooks/useOwnedShops", () => ({ invalidateOwnedShops: vi.fn() }));
import { validateShopLogo } from "./shopLogo";
describe("workshop logo validation", () => {
  it("allows a PNG at the existing 2 MB limit", () => expect(() => validateShopLogo({ type: "image/png", size: 2 * 1024 * 1024 })).not.toThrow());
  it("rejects a file above 2 MB", () => expect(() => validateShopLogo({ type: "image/png", size: 2 * 1024 * 1024 + 1 })).toThrow());
  it("rejects unsupported image formats", () => expect(() => validateShopLogo({ type: "image/svg+xml", size: 100 })).toThrow());
});