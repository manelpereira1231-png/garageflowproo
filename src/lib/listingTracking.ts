import { supabase } from "@/integrations/supabase/client";

function getSessionId(): string {
  let id = localStorage.getItem("gf_session_id");
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem("gf_session_id", id);
  }
  return id;
}

export async function trackListingView(listingId: string) {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    await supabase.from("listing_views" as any).insert({
      listing_id: listingId,
      session_id: user ? null : getSessionId(),
      user_id: user?.id || null,
    });
  } catch {
    // silent (duplicate per day is ignored)
  }
}

export async function getListingViewCount(listingId: string): Promise<{ today: number; total: number }> {
  const today = new Date().toISOString().slice(0, 10);
  const [{ count: total }, { count: todayCount }] = await Promise.all([
    supabase.from("listing_views" as any).select("id", { count: "exact", head: true }).eq("listing_id", listingId),
    supabase.from("listing_views" as any).select("id", { count: "exact", head: true }).eq("listing_id", listingId).eq("viewed_date", today),
  ]);
  return { today: todayCount || 0, total: total || 0 };
}

export async function isFavorite(listingId: string, userId: string): Promise<boolean> {
  const { data } = await supabase
    .from("listing_favorites" as any)
    .select("id")
    .eq("listing_id", listingId)
    .eq("user_id", userId)
    .maybeSingle();
  return !!data;
}

export async function toggleFavorite(listingId: string, userId: string): Promise<boolean> {
  const fav = await isFavorite(listingId, userId);
  if (fav) {
    await supabase.from("listing_favorites" as any).delete().eq("listing_id", listingId).eq("user_id", userId);
    return false;
  }
  await supabase.from("listing_favorites" as any).insert({ listing_id: listingId, user_id: userId });
  return true;
}
