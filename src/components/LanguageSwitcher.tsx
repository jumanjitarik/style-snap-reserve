import { LANGS, useT, type Lang } from "@/lib/i18n";
import { useState, useEffect, useRef } from "react";
import { Globe } from "lucide-react";

export function LanguageSwitcher({ variant = "compact" }: { variant?: "compact" | "row" }) {
  const { lang, setLang } = useT();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  if (variant === "row") {
    return (
      <div className="flex flex-wrap gap-1.5">
        {LANGS.map((l) => (
          <button
            key={l.code}
            onClick={() => setLang(l.code as Lang)}
            aria-label={l.label}
            className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm transition ${
              lang === l.code ? "border-primary bg-primary/15 text-primary" : "border-border bg-card text-muted-foreground"
            }`}
          >
            <span className="text-base leading-none">{l.flag}</span>
            <span>{l.label}</span>
          </button>
        ))}
      </div>
    );
  }

  const cur = LANGS.find((l) => l.code === lang) ?? LANGS[0];
  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label="Language"
        className="flex items-center gap-1 rounded-full bg-card/80 border border-primary/20 px-2 py-1 text-sm active:scale-95 transition"
      >
        <Globe className="h-3.5 w-3.5 text-primary" />
        <span className="text-base leading-none">{cur.flag}</span>
      </button>
      {open && (
        <div className="absolute right-0 mt-1 z-50 min-w-[140px] rounded-xl border border-primary/20 bg-card/95 backdrop-blur-xl shadow-lg overflow-hidden">
          {LANGS.map((l) => (
            <button
              key={l.code}
              onClick={() => { setLang(l.code as Lang); setOpen(false); }}
              className={`flex w-full items-center gap-2 px-3 py-2 text-sm hover:bg-primary/10 ${lang === l.code ? "text-primary" : ""}`}
            >
              <span className="text-base leading-none">{l.flag}</span>
              <span>{l.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
