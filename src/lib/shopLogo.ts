import { supabase } from "@/integrations/supabase/client";
import { invalidateOwnedShops } from "@/hooks/useOwnedShops";
import { broadcastShopContextChange } from "@/lib/shopContextSync";

export const LOGO_MAX_BYTES = 2 * 1024 * 1024;
const extensions: Record<string, string> = { "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp", "image/gif": "gif" };

export function validateShopLogo(file: Pick<File, "type" | "size">): void {
  if (!extensions[file.type]) throw new Error("Escolha uma imagem PNG, JPEG, WebP ou GIF.");
  if (file.size <= 0 || file.size > LOGO_MAX_BYTES) throw new Error("O logótipo deve ter até 2 MB.");
}

/** Immutable object names keep old references intact and invalidate image caches naturally. */
export async function uploadShopLogo(shopId: string, file: File): Promise<string> {
  validateShopLogo(file);
  const path = `${shopId}/logo-${crypto.randomUUID()}.${extensions[file.type]}`;
  const { data, error } = await supabase.storage.from("shop-logos").upload(path, file, { upsert: false, contentType: file.type });
  if (error || !data?.path) throw error || new Error("Não foi possível carregar o logótipo.");
  return supabase.storage.from("shop-logos").getPublicUrl(data.path).data.publicUrl;
}

export async function confirmShopLogo(shopId: string, logoUrl: string): Promise<void> {
  const { data, error } = await supabase.from("shops").select("logo_url").eq("id", shopId).single();
  if (error || data?.logo_url !== logoUrl) throw error || new Error("Não foi possível confirmar a gravação do logótipo. Volte a tentar.");
}

export function refreshShopBranding(): void {
  invalidateOwnedShops();
  broadcastShopContextChange({ reason: "branding-updated" });
}