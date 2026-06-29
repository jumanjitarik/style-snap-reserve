import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const InputSchema = z.object({
  texts: z.array(z.string().min(1)).min(1).max(50),
  target_lang: z.enum(["tr", "en", "ru", "uk", "fa", "ar"]),
  source_lang: z.string().default("tr"),
});

const LANG_NAME: Record<string, string> = {
  tr: "Turkish", en: "English", ru: "Russian", uk: "Ukrainian", fa: "Persian (Farsi)", ar: "Arabic",
};

/**
 * Translate an array of short strings (shop/service/staff names, descriptions) into the
 * target language, caching results in public.content_translations. Returns { [source]: translation }.
 */
export const translateBatch = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => InputSchema.parse(data))
  .handler(async ({ data }) => {
    const { texts, target_lang, source_lang } = data;
    const out: Record<string, string> = {};
    if (source_lang === target_lang) {
      texts.forEach((t) => { out[t] = t; });
      return out;
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Look up cached translations
    const { data: cached } = await supabaseAdmin
      .from("content_translations")
      .select("source_text, translation")
      .eq("source_lang", source_lang)
      .eq("target_lang", target_lang)
      .in("source_text", texts);
    const cacheMap = new Map<string, string>((cached ?? []).map((r) => [r.source_text, r.translation]));
    const missing = texts.filter((t) => !cacheMap.has(t));

    if (missing.length === 0) {
      texts.forEach((t) => { out[t] = cacheMap.get(t) ?? t; });
      return out;
    }

    // Call Lovable AI Gateway
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) {
      // Without AI key: return source text as fallback
      texts.forEach((t) => { out[t] = cacheMap.get(t) ?? t; });
      return out;
    }

    const sys = `You are a professional translator. Translate each input line from ${LANG_NAME[source_lang] ?? source_lang} into ${LANG_NAME[target_lang]}. Output ONLY the translations, one per line, in the same order. No numbering, no quotes, no explanations.`;
    const userMsg = missing.join("\n");

    let translations: string[] = [];
    try {
      const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash-lite",
          messages: [{ role: "system", content: sys }, { role: "user", content: userMsg }],
          temperature: 0.2,
        }),
      });
      if (res.ok) {
        const json = await res.json();
        const content: string = json?.choices?.[0]?.message?.content ?? "";
        translations = content.split("\n").map((l) => l.trim()).filter(Boolean);
      }
    } catch {
      translations = [];
    }

    // Pair up; pad with source text if mismatched
    const rows: { source_text: string; source_lang: string; target_lang: string; translation: string }[] = [];
    missing.forEach((src, i) => {
      const tr = translations[i] ?? src;
      cacheMap.set(src, tr);
      rows.push({ source_text: src, source_lang, target_lang, translation: tr });
    });

    if (rows.length > 0) {
      await supabaseAdmin
        .from("content_translations")
        .upsert(rows, { onConflict: "source_lang,target_lang,source_text", ignoreDuplicates: true });
    }

    texts.forEach((t) => { out[t] = cacheMap.get(t) ?? t; });
    return out;
  });
