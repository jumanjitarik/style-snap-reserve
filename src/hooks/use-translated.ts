import { useQuery } from "@tanstack/react-query";
import { useT } from "@/lib/i18n";
import { translateBatch } from "@/lib/translate.functions";

/**
 * Translates a batch of TR strings to the user's current language.
 * Returns a map (source -> translated) plus a tr(src) helper.
 * Cached per language across the app.
 */
export function useTranslated(texts: (string | null | undefined)[]) {
  const { lang } = useT();
  const clean = Array.from(new Set(texts.filter((t): t is string => !!t && t.trim().length > 0)));
  const key = clean.slice().sort().join("|");

  const { data } = useQuery({
    queryKey: ["i18n", lang, key],
    enabled: lang !== "tr" && clean.length > 0,
    staleTime: 1000 * 60 * 60,
    queryFn: async () => {
      const res = await translateBatch({ data: { texts: clean, target_lang: lang, source_lang: "tr" } });
      return res as Record<string, string>;
    },
  });

  return {
    tr: (src: string | null | undefined) => {
      if (!src) return "";
      if (lang === "tr") return src;
      return data?.[src] ?? src;
    },
  };
}
