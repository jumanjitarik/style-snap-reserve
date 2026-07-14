import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Store } from "lucide-react";

export type DbCategory = {
  id: string;
  slug: string;
  name: string;
  icon_url: string | null;
  sort_order: number;
  active: boolean;
};

export function useCustomCategories(opts?: { includeInactive?: boolean }) {
  return useQuery({
    queryKey: ["custom-categories", opts?.includeInactive ?? false],
    queryFn: async () => {
      let q = supabase
        .from("custom_categories")
        .select("*")
        .order("sort_order", { ascending: true })
        .order("name", { ascending: true });
      if (!opts?.includeInactive) q = q.eq("active", true);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as DbCategory[];
    },
    staleTime: 30_000,
  });
}

// Return list of shop ids assigned to the category with the given slug.
// Returns [] when the category exists but has no shops, null when the slug is unknown.
export async function fetchShopIdsForCategorySlug(slug: string): Promise<string[] | null> {
  const { data: cat } = await supabase
    .from("custom_categories")
    .select("id")
    .eq("slug", slug)
    .maybeSingle();
  if (!cat) return null;
  const { data } = await supabase
    .from("barbershop_categories")
    .select("shop_id")
    .eq("category_id", cat.id);
  return (data ?? []).map((r) => r.shop_id);
}

export const CategoryFallbackIcon = Store;
