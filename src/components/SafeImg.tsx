import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

const cache = new Map<string, string>();
const inflight = new Map<string, Promise<string>>();

function extractPath(src: string): string | null {
  // Matches /object/public/barbershop-photos/<path> or /object/sign/barbershop-photos/<path>
  const m = src.match(/\/object\/(?:public|sign|authenticated)\/barbershop-photos\/([^?]+)/);
  if (m) return decodeURIComponent(m[1]);
  // Or raw path like "shop-cover/xxx.jpg"
  if (!src.startsWith("http") && !src.startsWith("/") && !src.startsWith("data:")) return src;
  return null;
}

async function resolveSrc(src: string): Promise<string> {
  if (cache.has(src)) return cache.get(src)!;
  const path = extractPath(src);
  if (!path) {
    cache.set(src, src);
    return src;
  }
  if (inflight.has(src)) return inflight.get(src)!;
  const p = (async () => {
    const { data, error } = await supabase.storage
      .from("barbershop-photos")
      .createSignedUrl(path, 60 * 60 * 6);
    const out = error || !data?.signedUrl ? src : data.signedUrl;
    cache.set(src, out);
    inflight.delete(src);
    return out;
  })();
  inflight.set(src, p);
  return p;
}

export function SafeImg({
  src,
  alt = "",
  className,
}: {
  src?: string | null;
  alt?: string;
  className?: string;
}) {
  const [resolved, setResolved] = useState<string | null>(() => {
    if (!src) return null;
    const cached = cache.get(src);
    if (cached) return cached;
    // If no signing needed (plain URL / data URI), use src directly to avoid a flash.
    if (extractPath(src) === null) {
      cache.set(src, src);
      return src;
    }
    return null;
  });

  useEffect(() => {
    let active = true;
    if (!src) {
      setResolved(null);
      return;
    }
    resolveSrc(src).then((u) => {
      if (active) setResolved(u);
    });
    return () => {
      active = false;
    };
  }, [src]);

  if (!src) return null;
  if (!resolved) return <div className={className} />;
  return <img src={resolved} alt={alt} className={className} loading="lazy" />;
}
