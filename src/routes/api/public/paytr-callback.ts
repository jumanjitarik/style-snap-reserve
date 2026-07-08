import { createFileRoute } from "@tanstack/react-router";
import { createHmac } from "crypto";

export const Route = createFileRoute("/api/public/paytr-callback")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const raw = await request.text();
          const params = new URLSearchParams(raw);
          const merchant_oid = params.get("merchant_oid") ?? "";
          const status = params.get("status") ?? "";
          const total_amount = params.get("total_amount") ?? "";
          const hash = params.get("hash") ?? "";
          const payment_type = params.get("payment_type") ?? null;
          const currency = params.get("currency") ?? null;
          const test_mode = params.get("test_mode") ?? null;
          const failed_reason_code = params.get("failed_reason_code") ?? null;
          const failed_reason_msg = params.get("failed_reason_msg") ?? null;

          if (!merchant_oid || !status || !hash) return new Response("PARAM", { status: 200 });

          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          const { data: settings } = await supabaseAdmin
            .from("app_settings")
            .select("key,value")
            .in("key", ["paytr_merchant_key", "paytr_merchant_salt"]);
          const map = Object.fromEntries((settings ?? []).map((r) => [r.key, r.value ?? ""])) as Record<string, string>;
          const key = (map.paytr_merchant_key ?? "").trim();
          const salt = (map.paytr_merchant_salt ?? "").trim();
          if (!key || !salt) return new Response("NOCREDS", { status: 200 });

          const expected = createHmac("sha256", key)
            .update(merchant_oid + salt + status + total_amount)
            .digest("base64");
          if (expected !== hash) return new Response("BADHASH", { status: 200 });

          await supabaseAdmin
            .from("virtual_pos_charges")
            .update({
              status: status === "success" ? "paid" : "failed",
              paytr_raw: {
                status, total_amount, payment_type, currency, test_mode,
                failed_reason_code, failed_reason_msg,
                received_at: new Date().toISOString(),
              },
            })
            .eq("paytr_merchant_oid", merchant_oid);

          return new Response("OK", { status: 200 });
        } catch (e) {
          console.error("paytr callback error", e);
          return new Response("OK", { status: 200 });
        }
      },
    },
  },
});
