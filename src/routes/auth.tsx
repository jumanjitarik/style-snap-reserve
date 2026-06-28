import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { AppShell } from "@/components/AppShell";
import { BackButton } from "@/components/BackButton";
import { toast } from "sonner";
import { Scissors, Apple } from "lucide-react";
import { z } from "zod";
import { logActivity } from "@/lib/activity";

export const Route = createFileRoute("/auth")({
  head: () => ({ meta: [{ title: "Giriş / Kayıt — BarberApp" }] }),
  component: AuthPage,
});

const signupSchema = z.object({
  full_name: z.string().trim().min(2, "İsim en az 2 karakter").max(80),
  email: z.string().trim().email("Geçerli bir e-posta gir"),
  password: z.string().min(4, "Şifre en az 4 karakter").max(72),
  phone: z.string().trim().regex(/^\d{10}$/, "10 haneli numara (5XXXXXXXXX)"),
  gender: z.enum(["male", "female", "other"]),
});

const EMAIL_DOMAINS = ["@gmail.com", "@hotmail.com", "@yandex.com"];

function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [loginMethod, setLoginMethod] = useState<"email" | "phone">("email");
  const [loading, setLoading] = useState(false);
  const [forgotOpen, setForgotOpen] = useState(false);
  const [forgotEmail, setForgotEmail] = useState("");
  const [form, setForm] = useState({
    full_name: "", email: "", password: "", phone: "", gender: "male" as const,
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
            },
          },
        });
        if (error) throw error;
        toast.success("Kayıt başarılı!");
        logActivity("signup");
        navigate({ to: "/" });
      } else {
        if (loginMethod === "phone") {
          if (!/^\d{10}$/.test(form.phone)) { toast.error("Telefon: 5XXXXXXXXX"); return; }
          const { data } = await supabase.from("profiles").select("email").eq("phone", "+90" + form.phone).maybeSingle();
          if (!data?.email) { toast.error("Bu telefonla kayıtlı kullanıcı yok"); return; }
          const { error } = await supabase.auth.signInWithPassword({ email: data.email, password: form.password });
          if (error) throw error;
        } else {
          const { error } = await supabase.auth.signInWithPassword({ email: form.email, password: form.password });
          if (error) throw error;
        }
        toast.success("Giriş yapıldı");
        logActivity("login");
        navigate({ to: "/" });
      }
    } catch (err) {
      toast.error(translateAuthError(err instanceof Error ? err.message : "Bir hata oluştu"));
    } finally {
      setLoading(false);
    }
  }

  async function handleGoogle() {
    const res = await lovable.auth.signInWithOAuth("google", { redirect_uri: window.location.origin });
    if (res.error) toast.error(translateAuthError(res.error.message));
    else if (!res.redirected) { logActivity("login"); navigate({ to: "/" }); }
  }
  async function handleApple() {
    const res = await lovable.auth.signInWithOAuth("apple", { redirect_uri: window.location.origin });
    if (res.error) toast.error(translateAuthError(res.error.message));
    else if (!res.redirected) { logActivity("login"); navigate({ to: "/" }); }
  }

  async function handleForgot() {
    if (!forgotEmail.trim()) { toast.error("E-posta gir"); return; }
    const { error } = await supabase.auth.resetPasswordForEmail(forgotEmail.trim(), {
      redirectTo: window.location.origin + "/reset-password",
    });
    if (error) toast.error(translateAuthError(error.message));
    else { toast.success("Şifre sıfırlama bağlantısı e-posta adresine gönderildi"); setForgotOpen(false); }
  }

  const emailLocal = form.email.split("@")[0] ?? "";
  function addDomain(d: string) {
    setForm({ ...form, email: emailLocal + d });
  }

  return (
    <AppShell>
      <BackButton to="/" />
      <div className="flex flex-col px-6 pt-4 pb-32 max-w-md mx-auto">
        <Link to="/" className="mb-6 flex items-center gap-2 text-primary">
          <Scissors className="h-6 w-6" />
          <span className="font-display text-2xl tracking-wider">BARBERAPP</span>
        </Link>

        <h1 className="font-display text-4xl">{mode === "login" ? "Tekrar Hoş Geldin" : "Aramıza Katıl"}</h1>
        <p className="text-sm text-muted-foreground mt-1">{mode === "login" ? "Hesabına giriş yap" : "Yeni bir hesap oluştur"}</p>

        {mode === "login" && (
          <Tabs value={loginMethod} onValueChange={(v) => setLoginMethod(v as "email" | "phone")} className="mt-5">
            <TabsList className="grid grid-cols-2 w-full">
              <TabsTrigger value="email">E-posta</TabsTrigger>
              <TabsTrigger value="phone">Telefon</TabsTrigger>
            </TabsList>
            <TabsContent value="email" />
            <TabsContent value="phone" />
          </Tabs>
        )}

        <form onSubmit={handleSubmit} className="mt-4 space-y-3">
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
            </>
          )}

          {(mode === "signup" || loginMethod === "phone") && (
            <div>
              <Label>Telefon</Label>
              <div className="flex">
                <span className="inline-flex items-center px-3 rounded-l-md border border-r-0 border-input bg-muted text-sm font-semibold text-primary">+90</span>
                <Input
                  type="tel" inputMode="numeric" maxLength={10} required
                  className="rounded-l-none"
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value.replace(/\D/g, "") })}
                  placeholder="5XXXXXXXXX"
                />
              </div>
            </div>
          )}

          {(mode === "signup" || loginMethod === "email") && (
            <div>
              <Label>E-posta</Label>
              <Input type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="ornek" />
              <div className="mt-1.5 grid grid-cols-3 gap-1.5">
                {EMAIL_DOMAINS.map((d) => (
                  <button key={d} type="button" onClick={() => addDomain(d)}
                    className="rounded-full border border-border bg-card px-2 py-1 text-[11px] text-muted-foreground hover:border-primary/50 hover:text-primary active:scale-95 transition truncate">
                    {d}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div>
            <div className="flex items-center justify-between">
              <Label>Şifre <span className="text-[10px] text-muted-foreground">(en az 4 karakter)</span></Label>
              {mode === "login" && (
                <button type="button" onClick={() => { setForgotEmail(form.email); setForgotOpen(true); }}
                  className="text-[11px] text-primary">Şifremi unuttum</button>
              )}
            </div>
            <Input type="password" required minLength={4} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
          </div>

          <Button type="submit" disabled={loading} className="w-full h-12 font-semibold bg-gradient-to-r from-primary to-primary/80">
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
        <Button variant="outline" onClick={handleApple} className="w-full h-12 mt-2">
          <Apple className="h-4 w-4 mr-2" /> Apple ile devam et
        </Button>

        <p className="mt-6 text-center text-sm text-muted-foreground">
          {mode === "login" ? "Hesabın yok mu?" : "Hesabın var mı?"}{" "}
          <button onClick={() => setMode(mode === "login" ? "signup" : "login")} className="text-primary font-medium">
            {mode === "login" ? "Kayıt ol" : "Giriş yap"}
          </button>
        </p>
      </div>

      <Dialog open={forgotOpen} onOpenChange={setForgotOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Şifremi Unuttum</DialogTitle>
            <DialogDescription>E-posta adresine sıfırlama bağlantısı gönderelim.</DialogDescription>
          </DialogHeader>
          <Input type="email" placeholder="E-posta" value={forgotEmail} onChange={(e) => setForgotEmail(e.target.value)} />
          <Button onClick={handleForgot}>Bağlantı Gönder</Button>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}

function translateAuthError(msg: string): string {
  const m = msg.toLowerCase();
  if (m.includes("invalid login")) return "E-posta veya şifre hatalı";
  if (m.includes("email not confirmed")) return "E-postanı onayla";
  if (m.includes("user already registered") || m.includes("already exists")) return "Bu e-posta zaten kayıtlı";
  if (m.includes("password should be")) return "Şifre çok kısa (en az 4 karakter)";
  if (m.includes("rate limit")) return "Çok fazla deneme, biraz bekle";
  if (m.includes("network")) return "Ağ hatası, internetini kontrol et";
  return msg;
}
