/**
 * useFeaturedTestimonials — loads approved + featured + publicly-displayable
 * testimonials for the landing page. RLS ensures anon visitors only see
 * this exact subset. Consumers hide the section entirely when the list is
 * empty so no placeholder / dev copy is ever visible in production.
 */
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type PublicTestimonial = {
  id: string;
  author_name: string;
  workshop_name: string | null;
  rating: number;
  content: string;
  created_at: string;
};

export function useFeaturedTestimonials(limit = 6) {
  const [items, setItems] = useState<PublicTestimonial[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      // Reads from `testimonials_public` — a security-invoker view that exposes
      // only the safe subset of columns (no admin_notes / submitted_by / shop_id).
      const { data } = await supabase
        .from("testimonials_public" as any)
        .select("id, author_name, workshop_name, rating, content, created_at")
        .order("created_at", { ascending: false })
        .limit(limit);
      if (cancelled) return;
      setItems((data as unknown as PublicTestimonial[]) || []);
      setLoaded(true);
    })();
    return () => { cancelled = true; };
  }, [limit]);

  return { items, loaded };
}
