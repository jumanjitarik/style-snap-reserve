import { useEffect } from "react";
import { useRouterState } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/**
 * Reads per-page SEO from `page_seo` and updates document title, meta description, meta keywords.
 * Falls back to the default __root head values when a row is missing/blank.
 */
export function SeoHead() {
  const path = useRouterState({ select: (s) => s.location.pathname });
  const normalized = path === "/" ? "/" : path.replace(/\/+$/g, "") || "/";

  const { data } = useQuery({
    queryKey: ["page-seo", normalized],
    staleTime: 60_000,
    queryFn: async () => {
      const { data } = await supabase
        .from("page_seo")
        .select("title, description, keywords")
        .eq("path", normalized)
        .maybeSingle();
      return data ?? null;
    },
  });

  useEffect(() => {
    if (!data) return;
    if (typeof document === "undefined") return;
    const title = (data.title ?? "").trim();
    const description = (data.description ?? "").trim();
    const keywords = (data.keywords ?? "").trim();

    if (title) document.title = title;

    const setMeta = (name: string, attr: "name" | "property", content: string) => {
      if (!content) return;
      let el = document.head.querySelector<HTMLMetaElement>(`meta[${attr}="${name}"]`);
      if (!el) {
        el = document.createElement("meta");
        el.setAttribute(attr, name);
        document.head.appendChild(el);
      }
      el.setAttribute("content", content);
    };
    setMeta("description", "name", description);
    setMeta("keywords", "name", keywords);
    setMeta("og:title", "property", title);
    setMeta("og:description", "property", description);
    setMeta("twitter:title", "name", title);
    setMeta("twitter:description", "name", description);
  }, [data]);

  return null;
}
