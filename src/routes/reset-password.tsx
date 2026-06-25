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
  const [ready, setReady] = useState(false);

  useEffect(() => {
    // Supabase auto-creates a recovery session from the URL hash
    supabase.auth.getSession().then(({ data }) => setReady(!!data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setReady(!!s));
    return () => sub.subscription.unsubscribe();
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (password.length < 6) { toast.error("Şifre en az 6 karakter olmalı"); return; }
    const { error } = await supabase.auth.updateUser({ password });
    if (error) { toast.error(error.message); return; }
    toast.success("Şifre güncellendi");
    navigate({ to: "/" });
  }

  return (
    <AppShell>
      <BackButton to="/auth" />
      <div className="px-6 pt-16 max-w-md mx-auto">
        <h1 className="font-display text-3xl">Yeni Şifre</h1>
        <p className="text-sm text-muted-foreground mt-1">Yeni şifreni belirle ve devam et.</p>
        {!ready ? (
          <p className="mt-6 text-sm text-muted-foreground">Sıfırlama bağlantısını e-postadan açtığından emin ol…</p>
        ) : (
          <form onSubmit={submit} className="mt-6 space-y-3">
            <div>
              <Label>Yeni Şifre (en az 6 karakter)</Label>
              <Input type="password" minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} required />
            </div>
            <Button type="submit" className="w-full h-12">Şifreyi Güncelle</Button>
          </form>
        )}
      </div>
    </AppShell>
  );
}
