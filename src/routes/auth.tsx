import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Scissors } from "lucide-react";
import { z } from "zod";

export const Route = createFileRoute("/auth")({
  head: () => ({ meta: [{ title: "Giriş / Kayıt — BarberApp" }] }),
  component: AuthPage,
});

const signupSchema = z.object({
  full_name: z.string().trim().min(2).max(80),
  email: z.string().trim().email(),
  password: z.string().min(6).max(72),
  phone: z.string().trim().regex(/^\d{10}$/, "10 haneli numara (5XXXXXXXXX)"),
  gender: z.enum(["male", "female", "other"]),
  role: z.enum(["customer", "staff", "owner"]),
});

function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    full_name: "", email: "", password: "", phone: "", gender: "male" as const, role: "customer" as "customer" | "staff" | "owner",
  });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      if (mode === "signup") {
        const parsed = signupSchema.safeParse(form);
        if (!parsed.success) { toast.error(parsed.error.issues[0].message); return; }
        const { error } = await supabase.auth.signUp({
          email: form.email,
          password: form.password,
          options: {
            emailRedirectTo: window.location.origin,
            data: {
              full_name: form.full_name,
              phone: "+90" + form.phone,
              gender: form.gender,
              role: form.role,
            },
          },
        });
        if (error) throw error;
        toast.success("Kayıt başarılı!");
        navigate({ to: "/" });
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email: form.email, password: form.password });
        if (error) throw error;
        toast.success("Giriş yapıldı");
        navigate({ to: "/" });
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Hata");
    } finally {
      setLoading(false);
    }
  }

  async function handleGoogle() {
    const res = await lovable.auth.signInWithOAuth("google", { redirect_uri: window.location.origin });
    if (res.error) toast.error(res.error.message);
    else if (!res.redirected) navigate({ to: "/" });
  }

  return (
    <div className="min-h-screen flex flex-col px-6 py-10 max-w-md mx-auto">
      <Link to="/" className="mb-6 flex items-center gap-2 text-primary">
        <Scissors className="h-6 w-6" />
        <span className="font-display text-2xl tracking-wider">BARBERAPP</span>
      </Link>

      <h1 className="font-display text-4xl">{mode === "login" ? "Tekrar Hoş Geldin" : "Aramıza Katıl"}</h1>
      <p className="text-sm text-muted-foreground mt-1">{mode === "login" ? "Hesabına giriş yap" : "Yeni bir hesap oluştur"}</p>

      <form onSubmit={handleSubmit} className="mt-6 space-y-3">
        {mode === "signup" && (
          <>
            <div>
              <Label>Ad Soyad</Label>
              <Input value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} required maxLength={80} />
            </div>
            <div>
              <Label>Cinsiyet</Label>
              <RadioGroup value={form.gender} onValueChange={(v) => setForm({ ...form, gender: v as "male" })} className="flex gap-4 mt-1">
                <label className="flex items-center gap-2 text-sm"><RadioGroupItem value="male" /> Erkek</label>
                <label className="flex items-center gap-2 text-sm"><RadioGroupItem value="female" /> Kadın</label>
                <label className="flex items-center gap-2 text-sm"><RadioGroupItem value="other" /> Diğer</label>
              </RadioGroup>
            </div>
            <div>
              <Label>Telefon</Label>
              <div className="flex">
                <span className="inline-flex items-center px-3 rounded-l-md border border-r-0 border-input bg-muted text-sm">+90</span>
                <Input
                  type="tel" inputMode="numeric" maxLength={10} required
                  className="rounded-l-none"
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value.replace(/\D/g, "") })}
                  placeholder="5XXXXXXXXX"
                />
              </div>
            </div>
            <div>
              <Label>Hesap Tipi</Label>
              <Select value={form.role} onValueChange={(v) => setForm({ ...form, role: v as "customer" })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="customer">Müşteri — randevu al</SelectItem>
                  <SelectItem value="staff">Çalışan — salon çalışanıyım</SelectItem>
                  <SelectItem value="owner">Salon Sahibi — salonumu yönet</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </>
        )}
        <div>
          <Label>E-posta</Label>
          <Input type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
        </div>
        <div>
          <Label>Şifre</Label>
          <Input type="password" required minLength={6} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
        </div>

        <Button type="submit" disabled={loading} className="w-full h-12 font-semibold">
          {mode === "login" ? "Giriş Yap" : "Kayıt Ol"}
        </Button>
      </form>

      <div className="relative my-5">
        <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-border" /></div>
        <div className="relative flex justify-center text-xs uppercase"><span className="bg-background px-2 text-muted-foreground">veya</span></div>
      </div>

      <Button variant="outline" onClick={handleGoogle} className="w-full h-12">
        Google ile devam et
      </Button>

      <p className="mt-6 text-center text-sm text-muted-foreground">
        {mode === "login" ? "Hesabın yok mu?" : "Hesabın var mı?"}{" "}
        <button onClick={() => setMode(mode === "login" ? "signup" : "login")} className="text-primary font-medium">
          {mode === "login" ? "Kayıt ol" : "Giriş yap"}
        </button>
      </p>
    </div>
  );
}
