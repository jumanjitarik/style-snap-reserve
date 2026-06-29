import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const SafeUrl = z
  .string()
  .default("")
  .refine((v) => {
    if (!v) return true;
    if (v.startsWith("/") && !v.startsWith("//")) return true;
    try {
      const u = new URL(v);
      return u.protocol === "http:" || u.protocol === "https:";
    } catch {
      return false;
    }
  }, { message: "Geçersiz URL (yalnızca http(s) veya / ile başlayan yollar)" });

const InputSchema = z.object({
  title: z.string().min(1),
  body: z.string().default(""),
  image_url: SafeUrl,
  link_url: SafeUrl,
  audience: z.enum(["all", "customers", "owners", "staff", "others"]),
});

export const adminBroadcast = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => InputSchema.parse(data))
  .handler(async ({ data, context }) => {
    // Verify admin role using the user-scoped client (RLS-respecting)
    const { data: roleRow, error: roleErr } = await context.supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId)
      .eq("role", "admin")
      .maybeSingle();
    if (roleErr) throw new Error(roleErr.message);
    if (!roleRow) throw new Error("Yetkisiz");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Resolve target user_ids by audience
    let targets: string[] = [];
    if (data.audience === "all") {
      const { data: rows, error } = await supabaseAdmin.from("profiles").select("id");
      if (error) throw new Error(error.message);
      targets = (rows ?? []).map((r) => r.id);
    } else if (data.audience === "others") {
      const { data: rows, error } = await supabaseAdmin.from("profiles").select("id");
      if (error) throw new Error(error.message);
      const { data: excluded, error: e2 } = await supabaseAdmin
        .from("user_roles")
        .select("user_id")
        .in("role", ["owner", "staff"]);
      if (e2) throw new Error(e2.message);
      const ex = new Set((excluded ?? []).map((r) => r.user_id));
      targets = (rows ?? []).map((r) => r.id).filter((id) => !ex.has(id));
    } else {
      const roleMap = { customers: "customer", owners: "owner", staff: "staff" } as const;
      const role = roleMap[data.audience as keyof typeof roleMap];
      const { data: rows, error } = await supabaseAdmin
        .from("user_roles")
        .select("user_id")
        .eq("role", role);
      if (error) throw new Error(error.message);
      targets = Array.from(new Set((rows ?? []).map((r) => r.user_id)));
    }

    if (targets.length === 0) return 0;
    const payload = targets.map((uid) => ({
      user_id: uid,
      title: data.title,
      body: data.body || null,
      image_url: data.image_url || null,
      link_url: data.link_url || null,
    }));
    const { error: insErr } = await supabaseAdmin.from("notifications").insert(payload);
    if (insErr) throw new Error(insErr.message);
    return targets.length;
  });
