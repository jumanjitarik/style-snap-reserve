import { supabase } from "@/integrations/supabase/client";

let lastLogged = 0;

export async function logActivity(action: "login" | "signup" | "view" | "logout") {
  try {
    if (Date.now() - lastLogged < 5000 && action === "view") return;
    lastLogged = Date.now();
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return;

    let geo: { ip?: string; city?: string; region?: string; country_name?: string } = {};
    try {
      const r = await fetch("https://ipapi.co/json/");
      if (r.ok) geo = await r.json();
    } catch { /* offline / blocked */ }

    await supabase.from("user_activity").insert({
      user_id: u.user.id,
      action,
      ip: geo.ip ?? null,
      city: geo.city ?? null,
      region: geo.region ?? null,
      country: geo.country_name ?? null,
      user_agent: typeof navigator !== "undefined" ? navigator.userAgent : null,
    });

    if (action === "login" || action === "signup") {
      await supabase.from("profiles").update({
        last_seen_at: new Date().toISOString(),
        last_ip: geo.ip ?? null,
        last_city: geo.city ?? null,
        last_country: geo.country_name ?? null,
      }).eq("id", u.user.id);
    }
  } catch { /* silent */ }
}
