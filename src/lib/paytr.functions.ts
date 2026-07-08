import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { createHmac, randomBytes } from "crypto";

/* ------------ helpers ------------- */

async function loadPaytrCreds() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin
    .from("app_settings")
    .select("key,value")
    .in("key", [
      "paytr_merchant_id",
      "paytr_merchant_key",
      "paytr_merchant_salt",
      "paytr_test_mode",
      "paytr_currency",
    ]);
  const map = Object.fromEntries((data ?? []).map((r) => [r.key, r.value ?? ""])) as Record<string, string>;
  const id = (map.paytr_merchant_id ?? "").trim();
  const key = (map.paytr_merchant_key ?? "").trim();
  const salt = (map.paytr_merchant_salt ?? "").trim();
  if (!id || !key || !salt) {
    throw new Error("PayTR bilgileri henüz girilmemiş. Yönetici panelinden Merchant ID / Key / Salt gir.");
  }
  return {
    id, key, salt,
    testMode: (map.paytr_test_mode ?? "1") === "1" ? "1" : "0",
    currency: (map.paytr_currency ?? "TL").toUpperCase() as "TL" | "USD" | "EUR",
  };
}

function newMerchantOid() {
  // must be alphanumeric per PayTR
  return "KA" + Date.now().toString(36).toUpperCase() + randomBytes(3).toString("hex").toUpperCase();
}

async function assertShopOwnerOrAdmin(supabase: any, userId: string, shopId: string) {
  const { data: roles } = await supabase.from("user_roles").select("role").eq("user_id", userId);
  const isAdmin = !!roles?.some((r: { role: string }) => r.role === "admin");
  if (isAdmin) return;
  const { data: shop } = await supabase.from("barbershops").select("owner_id").eq("id", shopId).maybeSingle();
  if (shop?.owner_id !== userId) throw new Error("Bu salon için yetkiniz yok.");
}

async function insertPendingCharge(input: {
  shopId: string;
  amount: number;
  customerName: string | null;
  customerPhone: string | null;
  description: string | null;
  serviceIds: string[];
  channel: "paytr_iframe" | "paytr_link";
  merchantOid: string;
  userId: string;
}) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin
    .from("virtual_pos_charges")
    .insert({
      shop_id: input.shopId,
      service_ids: input.serviceIds,
      amount: input.amount,
      customer_name: input.customerName,
      customer_phone: input.customerPhone,
      description: input.description,
      status: "pending",
      created_by: input.userId,
      payment_channel: input.channel,
      paytr_merchant_oid: input.merchantOid,
    })
    .select("id")
    .single();
  if (error) throw error;
  return data!.id as string;
}

function getOrigin(): string {
  return process.env.PUBLIC_APP_ORIGIN ?? "https://kuaforapp.antalyasosyal.com";
}


/* ------------- iFrame token ------------- */

const iframeInput = z.object({
  shopId: z.string().uuid(),
  amount: z.number().positive(),
  serviceIds: z.array(z.string().uuid()).default([]),
  customerName: z.string().trim().max(120).optional().nullable(),
  customerPhone: z.string().trim().max(30).optional().nullable(),
  customerEmail: z.string().trim().email().optional().nullable(),
  description: z.string().trim().max(500).optional().nullable(),
  userIp: z.string().trim().max(64).optional().nullable(),
});

export const createPaytrIframeToken = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => iframeInput.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as { supabase: any; userId: string };
    await assertShopOwnerOrAdmin(supabase, userId, data.shopId);
    const creds = await loadPaytrCreds();
    const merchantOid = newMerchantOid();
    const chargeId = await insertPendingCharge({
      shopId: data.shopId,
      amount: data.amount,
      customerName: data.customerName ?? null,
      customerPhone: data.customerPhone ?? null,
      description: data.description ?? null,
      serviceIds: data.serviceIds,
      channel: "paytr_iframe",
      merchantOid,
      userId,
    });

    const payment_amount = String(Math.round(data.amount * 100));
    const email = data.customerEmail || "musteri@kuaforapp.local";
    const user_name = data.customerName?.trim() || "Müşteri";
    const user_phone = data.customerPhone?.trim() || "05000000000";
    const user_address = "Salon";
    const user_ip = data.userIp || "127.0.0.1";
    const basket = [[data.description || "Sanal POS", (data.amount).toFixed(2), 1]];
    const user_basket = Buffer.from(JSON.stringify(basket)).toString("base64");
    const no_installment = "0";
    const max_installment = "0";
    const currency = creds.currency;

    const hashStr = creds.id + user_ip + merchantOid + email + payment_amount + user_basket + no_installment + max_installment + currency + creds.testMode;
    const paytr_token = createHmac("sha256", creds.key).update(hashStr + creds.salt).digest("base64");

    const origin = getOrigin();
    const body = new URLSearchParams({
      merchant_id: creds.id,
      user_ip,
      merchant_oid: merchantOid,
      email,
      payment_amount,
      paytr_token,
      user_basket,
      debug_on: creds.testMode,
      no_installment,
      max_installment,
      user_name,
      user_address,
      user_phone,
      merchant_ok_url: `${origin}/hesap?paytr=ok`,
      merchant_fail_url: `${origin}/hesap?paytr=fail`,
      timeout_limit: "30",
      currency,
      test_mode: creds.testMode,
    });

    const res = await fetch("https://www.paytr.com/odeme/api/get-token", { method: "POST", body });
    const json = (await res.json()) as { status?: string; token?: string; reason?: string };
    if (json.status !== "success" || !json.token) {
      throw new Error("PayTR token alınamadı: " + (json.reason ?? "bilinmeyen hata"));
    }
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin
      .from("virtual_pos_charges")
      .update({ paytr_token: json.token })
      .eq("id", chargeId);

    return { chargeId, token: json.token, iframeUrl: `https://www.paytr.com/odeme/guvenli/${json.token}` };
  });

/* ------------- Payment link ------------- */

const linkInput = z.object({
  shopId: z.string().uuid(),
  amount: z.number().positive(),
  serviceIds: z.array(z.string().uuid()).default([]),
  customerName: z.string().trim().max(120).optional().nullable(),
  customerPhone: z.string().trim().max(30).optional().nullable(),
  customerEmail: z.string().trim().email().optional().nullable(),
  description: z.string().trim().max(240).optional().nullable(),
});

export const createPaytrLink = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => linkInput.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as { supabase: any; userId: string };
    await assertShopOwnerOrAdmin(supabase, userId, data.shopId);
    const creds = await loadPaytrCreds();
    const merchantOid = newMerchantOid();
    const chargeId = await insertPendingCharge({
      shopId: data.shopId,
      amount: data.amount,
      customerName: data.customerName ?? null,
      customerPhone: data.customerPhone ?? null,
      description: data.description ?? null,
      serviceIds: data.serviceIds,
      channel: "paytr_link",
      merchantOid,
      userId,
    });

    const price = String(Math.round(data.amount * 100)); // kuruş
    const name = (data.description || "Sanal POS Ödeme").slice(0, 60);
    const currency = creds.currency;
    const max_installment = "0";
    const link_type = "product";
    const lang = "tr";
    const min_count = "1";
    const origin = getOrigin();
    const callback_link = `${origin}/api/public/paytr-callback`;
    const callback_id = merchantOid;
    const email = data.customerEmail || "musteri@kuaforapp.local";

    // hash per PayTR link-create docs
    const hashStr = creds.id + name + price + currency + max_installment + link_type + lang + min_count + creds.salt;
    const paytr_token = createHmac("sha256", creds.key).update(hashStr).digest("base64");

    const body = new URLSearchParams({
      merchant_id: creds.id,
      name,
      price,
      currency,
      max_installment,
      link_type,
      lang,
      min_count,
      email,
      callback_link,
      callback_id,
      get_qr: "1",
      debug_on: creds.testMode,
      paytr_token,
    });

    const res = await fetch("https://www.paytr.com/odeme/api/link/create", { method: "POST", body });
    const json = (await res.json()) as { status?: string; id?: string; link?: string; err_msg?: string };
    if (json.status !== "success" || !json.link) {
      throw new Error("PayTR link oluşturulamadı: " + (json.err_msg ?? "bilinmeyen hata"));
    }
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin
      .from("virtual_pos_charges")
      .update({ paytr_url: json.link, paytr_token: json.id ?? null })
      .eq("id", chargeId);

    return { chargeId, url: json.link };
  });
