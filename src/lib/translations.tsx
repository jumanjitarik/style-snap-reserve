import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

type Dict = Record<string, string>;
let DICT: Dict = {};
let loaded = false;
const listeners = new Set<() => void>();

function notify() {
  listeners.forEach((l) => l());
}

export function getTranslation(text: string): string {
  const key = text?.trim();
  if (!key) return text;
  return DICT[key] ?? text;
}

export async function loadTranslations() {
  try {
    const { data } = await supabase.from("translations").select("source,tr");
    if (data) {
      const next: Dict = {};
      for (const row of data) next[row.source] = row.tr;
      DICT = next;
      loaded = true;
      notify();
      applyToDocument();
    }
  } catch {
    /* ignore */
  }
}

function applyToDocument() {
  if (typeof document === "undefined") return;
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
    acceptNode: (node) => {
      const v = node.nodeValue?.trim();
      if (!v) return NodeFilter.FILTER_REJECT;
      return DICT[v] ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
    },
  });
  const nodes: Text[] = [];
  let n: Node | null;
  while ((n = walker.nextNode())) nodes.push(n as Text);
  for (const node of nodes) {
    const raw = node.nodeValue!;
    const trimmed = raw.trim();
    const tr = DICT[trimmed];
    if (tr) node.nodeValue = raw.replace(trimmed, tr);
  }
}

let observer: MutationObserver | null = null;
export function startTranslationObserver() {
  if (typeof window === "undefined" || observer) return;
  observer = new MutationObserver((muts) => {
    for (const m of muts) {
      m.addedNodes.forEach((node) => {
        if (node.nodeType === 3) {
          const t = node as Text;
          const v = t.nodeValue?.trim();
          if (v && DICT[v]) t.nodeValue = t.nodeValue!.replace(v, DICT[v]);
        } else if (node.nodeType === 1) {
          const el = node as Element;
          const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
          let tn: Node | null;
          while ((tn = walker.nextNode())) {
            const v = tn.nodeValue?.trim();
            if (v && DICT[v]) (tn as Text).nodeValue = tn.nodeValue!.replace(v, DICT[v]);
          }
        }
      });
      if (m.type === "characterData") {
        const t = m.target as Text;
        const v = t.nodeValue?.trim();
        if (v && DICT[v] && t.nodeValue !== DICT[v]) t.nodeValue = t.nodeValue!.replace(v, DICT[v]);
      }
    }
  });
  observer.observe(document.body, { childList: true, subtree: true, characterData: true });
}

export function TranslationsBoot() {
  useEffect(() => {
    if (!loaded) loadTranslations();
    startTranslationObserver();
    // Also intercept window.alert + console for English messages? Keep simple — DOM only.
  }, []);
  return null;
}
