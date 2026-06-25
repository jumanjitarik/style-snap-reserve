import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { BackButton } from "@/components/BackButton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

export const Route = createFileRoute("/reset-password")({
  component: ResetPasswordPage,
});

function ResetPasswordPage() {
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [password2, setPassword2] = useState("");
  const [ready, setReady] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setReady(!!data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setReady(!!s));
    return () => sub.subscription.unsubscribe();
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (password.length < 4) { toast.error("Şifre en az 4 karakter olmalı"); return; }
    if (password !== password2) { toast.error("Şifreler aynı değil"); return; }
    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Şifre güncellendi, giriş yapıldı");
    navigate({ to: "/" });
  }

  return (
    <AppShell>
      <BackButton to="/auth" />
      <div className="px-6 pt-16 max-w-md mx-auto">
        <h1 className="font-display text-3xl">Yeni Şifre Belirle</h1>
        <p className="text-sm text-muted-foreground mt-1">İki kez aynı şifreyi gir ve devam et.</p>
        {!ready ? (
          <p className="mt-6 text-sm text-muted-foreground">Sıfırlama bağlantısını e-postadan açtığından emin ol…</p>
        ) : (
          <form onSubmit={submit} className="mt-6 space-y-3">
            <div>
              <Label>Yeni Şifre (en az 6 karakter)</Label>
              <Input type="password" minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} required />
            </div>
            <div>
              <Label>Yeni Şifre (tekrar)</Label>
              <Input type="password" minLength={6} value={password2} onChange={(e) => setPassword2(e.target.value)} required />
            </div>
            <Button type="submit" disabled={loading} className="w-full h-12 font-semibold">
              {loading ? "Kaydediliyor…" : "Şifreyi Belirle"}
            </Button>
          </form>
        )}
      </div>
    </AppShell>
  );
}
