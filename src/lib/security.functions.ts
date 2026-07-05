import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const FIVE_MIN_MS = 5 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;
const SHORT_THRESHOLD = 3;
const DAILY_THRESHOLD = 10;

const preInput = z.object({
  email: z.string().trim().toLowerCase().optional().nullable(),
  ip: z.string().trim().optional().nullable(),
});

export const preLoginCheck = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => preInput.parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const email = data.email || null;
    const ip = data.ip || null;

    // Active blocks
    const values = [email, ip].filter(Boolean) as string[];
    if (values.length) {
      const { data: blocks } = await supabaseAdmin
        .from("security_blocks")
        .select("block_type,value,reason,expires_at")
        .in("value", values)
        .is("unblocked_at", null);
      const now = Date.now();
      const active = (blocks ?? []).find((b) => {
        if (b.block_type === "email" && email && b.value === email) return !b.expires_at || new Date(b.expires_at).getTime() > now;
        if (b.block_type === "ip" && ip && b.value === ip) return !b.expires_at || new Date(b.expires_at).getTime() > now;
        return false;
      });
      if (active) {
        const waitS = active.expires_at ? Math.max(0, Math.ceil((new Date(active.expires_at).getTime() - now) / 1000)) : 0;
        return { blocked: true as const, reason: active.reason ?? "Erişim engellendi", waitSeconds: waitS };
      }
    }
    return { blocked: false as const };
  });

const failInput = z.object({
  email: z.string().trim().toLowerCase().optional().nullable(),
  ip: z.string().trim().optional().nullable(),
  reason: z.string().max(200).optional(),
});

export const recordLoginFailure = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => failInput.parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const email = data.email || null;
    const ip = data.ip || null;
    await supabaseAdmin.from("login_attempts").insert({ email, ip, success: false, reason: data.reason ?? null });

    const now = Date.now();
    // 5-minute rolling: 3+ fails on same email → temp email block 5 min
    if (email) {
      const since5 = new Date(now - FIVE_MIN_MS).toISOString();
      const { count } = await supabaseAdmin
        .from("login_attempts")
        .select("id", { count: "exact", head: true })
        .eq("email", email).eq("success", false)
        .gte("created_at", since5);
      if ((count ?? 0) >= SHORT_THRESHOLD) {
        await supabaseAdmin.from("security_blocks").upsert({
          block_type: "email", value: email,
          reason: `5 dakika içinde ${count} hatalı giriş`,
          expires_at: new Date(now + FIVE_MIN_MS).toISOString(),
        }, { onConflict: "block_type,value" }).select();
      }
    }
    // Daily 10+ from same IP or email → permanent block
    const sinceDay = new Date(now - DAY_MS).toISOString();
    if (ip) {
      const { count } = await supabaseAdmin
        .from("login_attempts").select("id", { count: "exact", head: true })
        .eq("ip", ip).eq("success", false).gte("created_at", sinceDay);
      if ((count ?? 0) >= DAILY_THRESHOLD) {
        await supabaseAdmin.from("security_blocks").insert({
          block_type: "ip", value: ip,
          reason: `24 saat içinde ${count} hatalı giriş (IP)`,
        }).select();
      }
    }
    // Daily email block removed per policy — only IP is blocked on daily threshold.

    return { ok: true };
  });

const okInput = z.object({
  email: z.string().trim().toLowerCase().optional().nullable(),
  ip: z.string().trim().optional().nullable(),
});
export const recordLoginSuccess = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => okInput.parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("login_attempts").insert({
      email: data.email || null, ip: data.ip || null, success: true,
    });
    return { ok: true };
  });

// --------- Admin ---------

export const adminSecurityOverview = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: roleRows } = await context.supabase
      .from("user_roles").select("role").eq("user_id", context.userId).eq("role", "admin");
    if (!roleRows || roleRows.length === 0) throw new Error("Yetkisiz");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const now = Date.now();
    const dayAgo = new Date(now - DAY_MS).toISOString();
    const [blocksRes, attemptsRes, dayFailRes, daySuccRes] = await Promise.all([
      supabaseAdmin.from("security_blocks").select("*").is("unblocked_at", null).order("created_at", { ascending: false }),
      supabaseAdmin.from("login_attempts").select("id,email,ip,success,reason,created_at").order("created_at", { ascending: false }).limit(50),
      supabaseAdmin.from("login_attempts").select("id", { count: "exact", head: true }).eq("success", false).gte("created_at", dayAgo),
      supabaseAdmin.from("login_attempts").select("id", { count: "exact", head: true }).eq("success", true).gte("created_at", dayAgo),
    ]);

    return {
      blocks: blocksRes.data ?? [],
      attempts: attemptsRes.data ?? [],
      counts: {
        failedLast24h: dayFailRes.count ?? 0,
        successLast24h: daySuccRes.count ?? 0,
      },
    };
  });

export const adminRemoveBlock = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: roleRows } = await context.supabase
      .from("user_roles").select("role").eq("user_id", context.userId).eq("role", "admin");
    if (!roleRows || roleRows.length === 0) throw new Error("Yetkisiz");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("security_blocks")
      .update({ unblocked_at: new Date().toISOString() })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const adminBlockUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ user_id: z.string().uuid(), reason: z.string().max(200).optional() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: roleRows } = await context.supabase
      .from("user_roles").select("role").eq("user_id", context.userId).eq("role", "admin");
    if (!roleRows || roleRows.length === 0) throw new Error("Yetkisiz");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("profiles").update({ is_blocked: true }).eq("id", data.user_id);
    await supabaseAdmin.from("security_blocks").upsert({
      block_type: "user", value: data.user_id,
      reason: data.reason ?? "Yönetici tarafından engellendi",
    }, { onConflict: "block_type,value" });
    return { ok: true };
  });
