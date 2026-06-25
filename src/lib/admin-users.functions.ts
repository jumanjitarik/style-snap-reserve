import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const updateInput = z.object({
  user_id: z.string().uuid(),
  full_name: z.string().trim().min(1).max(120).optional(),
  email: z.string().email().optional(),
  phone: z.string().trim().min(1).max(40).optional().nullable(),
  password: z.string().min(6).max(72).optional(),
});

export const adminUpdateUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => updateInput.parse(data))
  .handler(async ({ data, context }) => {
    const { data: roleRows, error: roleErr } = await context.supabase
      .from("user_roles").select("role").eq("user_id", context.userId).eq("role", "admin");
    if (roleErr) throw new Error(roleErr.message);
    if (!roleRows || roleRows.length === 0) throw new Error("Yetkisiz: yalnızca admin");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const authPatch: { email?: string; password?: string } = {};
    if (data.email) authPatch.email = data.email;
    if (data.password) authPatch.password = data.password;
    if (Object.keys(authPatch).length > 0) {
      const { error } = await supabaseAdmin.auth.admin.updateUserById(data.user_id, authPatch);
      if (error) throw new Error(error.message);
    }

    const profilePatch: { full_name?: string; email?: string | null; phone?: string | null } = {};
    if (data.full_name !== undefined) profilePatch.full_name = data.full_name;
    if (data.email !== undefined) profilePatch.email = data.email;
    if (data.phone !== undefined) profilePatch.phone = data.phone;
    if (Object.keys(profilePatch).length > 0) {
      const { error } = await supabaseAdmin.from("profiles").update(profilePatch).eq("id", data.user_id);
      if (error) throw new Error(error.message);
    }
    return { ok: true };
  });
