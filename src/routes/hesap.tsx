import { SafeImg } from "@/components/SafeImg";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { BackButton } from "@/components/BackButton";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { User, LogOut, Heart, Bell, CalendarDays, Shield, Upload, Save, Trash2, BellRing, CreditCard, MessageCircle, Phone, Receipt, MessageSquare, KeyRound } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/hesap")({
  component: AccountPage,
});

function AccountPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [userId, setUserId] = useState<string | null>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [feedbackMsg, setFeedbackMsg] = useState("");
  const [feedbackSending, setFeedbackSending] = useState(false);
  const [pwOpen, setPwOpen] = useState(false);
  const [pwCurrent, setPwCurrent] = useState("");
  const [pwNew, setPwNew] = useState("");
  const [pwNew2, setPwNew2] = useState("");
  const [pwSaving, setPwSaving] = useState(false);

  async function changePassword() {
    if (pwNew.length < 6) { toast.error("Yeni şifre en az 6 hane olmalı"); return; }
    if (pwNew !== pwNew2) { toast.error("Yeni şifreler eşleşmiyor"); return; }
    const email = profile?.email;
    if (!email) { toast.error("E-posta bulunamadı"); return; }
    setPwSaving(true);
    const { error: signErr } = await supabase.auth.signInWithPassword({ email, password: pwCurrent });
    if (signErr) { setPwSaving(false); toast.error("Mevcut şifre hatalı"); return; }
    const { error } = await supabase.auth.updateUser({ password: pwNew });
    setPwSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Şifre güncellendi");
    setPwCurrent(""); setPwNew(""); setPwNew2("");
    setPwOpen(false);
  }


  async function sendFeedback() {
    const msg = feedbackMsg.trim();
    if (msg.length < 3) { toast.error("Lütfen görüşünü yaz"); return; }
    if (!userId) { toast.error("Giriş gerekli"); return; }
    setFeedbackSending(true);
    const { error } = await (supabase.from as unknown as (t: string) => { insert: (row: Record<string, unknown>) => Promise<{ error: { message: string } | null }> })("feedback").insert({ user_id: userId, message: msg });
    setFeedbackSending(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Başarıyla gönderilmiştir");
    setFeedbackMsg("");
    setFeedbackOpen(false);
  }

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUserId(data.user?.id ?? null);
      setAuthChecked(true);
      if (!data.user) navigate({ to: "/auth" });
    });
  }, [navigate]);

  const { data: profile } = useQuery({
    queryKey: ["profile", userId],
    enabled: !!userId,
    queryFn: async () => (await supabase.from("profiles").select("*").eq("id", userId!).maybeSingle()).data,
  });
  const { data: roles } = useQuery({
    queryKey: ["roles", userId],
    enabled: !!userId,
    queryFn: async () => (await supabase.from("user_roles").select("role").eq("user_id", userId!)).data ?? [],
  });

  const isAdmin = roles?.some((r) => r.role === "admin");
  const isOwner = roles?.some((r) => r.role === "owner" || r.role === "admin");
  const isOwnerOnly = roles?.some((r) => r.role === "owner");
  const isStaff = roles?.some((r) => r.role === "staff");
  const showSupport = true;
  void isStaff;
  const SUPPORT_PHONE = "+905536764855";
  const roleLabelMap: Record<string, string> = { admin: "Yönetici", owner: "Salon Sahibi", staff: "Personel", customer: "Müşteri" };

  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ full_name: "", email: "", phone: "", avatar_url: "" });
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (profile) {
      setForm({
        full_name: profile.full_name ?? "",
        email: profile.email ?? "",
        phone: (profile.phone ?? "").replace(/^\+90/, ""),
        avatar_url: profile.avatar_url ?? "",
      });
    }
  }, [profile]);

  const save = useMutation({
    mutationFn: async () => {
      if (!userId) return;
      const phone = form.phone ? "+90" + form.phone.replace(/\D/g, "") : null;
      const { error } = await supabase.from("profiles").update({
        full_name: form.full_name.trim(),
        phone,
        avatar_url: form.avatar_url || null,
      }).eq("id", userId);
      if (error) throw error;
      if (form.email && form.email !== profile?.email) {
        const { error: e2 } = await supabase.auth.updateUser({ email: form.email });
        if (e2) throw e2;
        toast.info("E-posta değişikliği için onay e-postası gönderildi");
      }
    },
    onSuccess: () => {
      toast.success("Profil güncellendi");
      qc.invalidateQueries({ queryKey: ["profile", userId] });
      setEditing(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  async function uploadAvatar(file: File) {
    if (!userId) return;
    const ext = file.name.split(".").pop();
    const path = `${userId}/avatar-${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from("barbershop-photos").upload(path, file, { upsert: true });
    if (error) { toast.error(error.message); return; }
    const { data } = supabase.storage.from("barbershop-photos").getPublicUrl(path);
    setForm((f) => ({ ...f, avatar_url: data.publicUrl }));
    toast.success("Fotoğraf yüklendi, kaydet'e bas");
  }

  async function signOut() {
    await supabase.auth.signOut();
    toast.success("Çıkış yapıldı");
    navigate({ to: "/" });
  }

  async function deleteAccount() {
    if (!userId) return;
    if (!confirm("Hesabını ve tüm verilerini kalıcı olarak silmek istediğine emin misin?")) return;
    try {
      const { adminDeleteSelf } = await import("@/lib/admin-users.functions");
      await adminDeleteSelf();
      await supabase.auth.signOut();
      toast.success("Hesabın silindi");
      navigate({ to: "/" });
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  async function removeAvatar() {
    setForm((f) => ({ ...f, avatar_url: "" }));
    toast.info("Fotoğraf kaldırıldı, kaydet'e bas");
  }

  async function saveAvatar() {
    if (!userId) return;
    const { error } = await supabase.from("profiles").update({ avatar_url: form.avatar_url || null }).eq("id", userId);
    if (error) { toast.error(error.message); return; }
    toast.success("Fotoğraf kaydedildi");
    qc.invalidateQueries({ queryKey: ["profile", userId] });
  }


  if (!authChecked || !userId) {
    return (
      <AppShell>
        <BackButton to="/" />
        <header className="px-4 pt-4 pb-3"><h1 className="font-display text-3xl">Hesap</h1></header>
        <p className="px-4 text-sm text-muted-foreground">Giriş sayfasına yönlendiriliyorsun…</p>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <BackButton to="/" />
      <header className="px-4 pt-4 pb-3">
        <h1 className="font-display text-3xl">Hesap</h1>
      </header>
      <div className="px-4 space-y-3">
        <div className="rounded-xl border border-primary/30 bg-gradient-to-br from-primary/10 to-transparent p-4">
          <div className="flex items-center gap-3">
            <button onClick={() => fileRef.current?.click()} className="relative h-16 w-16 rounded-full bg-primary/20 flex items-center justify-center overflow-hidden active:scale-95 transition">
              {form.avatar_url ? (
                <SafeImg src={form.avatar_url} alt="" className="h-full w-full object-cover" />
              ) : (
                <User className="h-7 w-7 text-primary" />
              )}
              <span className="absolute inset-0 bg-black/40 opacity-0 hover:opacity-100 flex items-center justify-center">
                <Upload className="h-5 w-5 text-white" />
              </span>
            </button>
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadAvatar(f); }} />
            <div className="min-w-0 flex-1">
              <p className="font-display text-xl truncate">{profile?.full_name ?? "Kullanıcı"}</p>
              <p className="text-xs text-muted-foreground truncate">{profile?.email}</p>
              {profile?.phone && <p className="text-xs text-muted-foreground">{profile.phone}</p>}
              <div className="mt-1.5 inline-flex items-center gap-1.5 rounded-full border border-primary/40 bg-primary/10 px-2.5 py-1">
                <span className="text-[10px] uppercase tracking-wider text-primary">Puanlarım</span>
                <span className="font-display text-sm text-primary">{Number(profile?.points ?? 0)}P</span>
              </div>
            </div>
          </div>
          <PointsBreakdown userId={userId} />
          <div className="mt-3 flex gap-2">
            <Button size="sm" variant="outline" className="flex-1" onClick={() => fileRef.current?.click()}>
              <Upload className="h-4 w-4 mr-1" /> Fotoğraf Yükle
            </Button>
            <Button size="sm" className="flex-1" onClick={saveAvatar}>
              <Save className="h-4 w-4 mr-1" /> Kaydet
            </Button>
            <Button size="sm" variant="destructive" onClick={removeAvatar} aria-label="Profil fotoğrafını sil">
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
          {roles && roles.length > 0 && (
            <div className="mt-3 flex gap-1 flex-wrap">
              {roles.map((r) => (
                <span key={r.role} className="rounded-full bg-primary/20 text-primary text-[10px] uppercase tracking-wider px-2 py-0.5 font-bold">
                  {roleLabelMap[r.role] ?? r.role}
                </span>
              ))}
            </div>
          )}

        </div>

        <div className="rounded-xl border border-border bg-card p-4 space-y-3">
          <div className="flex items-center justify-between">
            <p className="font-display text-lg">Profil Bilgileri</p>
            {!editing && <Button size="sm" variant="ghost" onClick={() => setEditing(true)}>Düzenle</Button>}
          </div>
          {editing ? (
            <>
              <div><Label>Ad Soyad</Label><Input value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} /></div>
              <div><Label>E-posta</Label><Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
              <div>
                <Label>Telefon</Label>
                <div className="flex">
                  <span className="inline-flex items-center px-3 rounded-l-md border border-r-0 border-input bg-muted text-sm font-semibold text-primary">+90</span>
                  <Input type="tel" inputMode="numeric" maxLength={10} className="rounded-l-none"
                    value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value.replace(/\D/g, "") })} />
                </div>
              </div>
              <div className="flex gap-2 pt-1">
                <Button variant="outline" className="flex-1" onClick={() => setEditing(false)}>İptal</Button>
                <Button className="flex-1" disabled={save.isPending} onClick={() => save.mutate()}><Save className="h-4 w-4 mr-1" />Kaydet</Button>
              </div>
            </>
          ) : (
            <div className="space-y-1 text-sm">
              <p><span className="text-muted-foreground">Ad:</span> {profile?.full_name ?? "-"}</p>
              <p><span className="text-muted-foreground">E-posta:</span> {profile?.email ?? "-"}</p>
              <p><span className="text-muted-foreground">Telefon:</span> {profile?.phone ?? "-"}</p>
            </div>
          )}
        </div>

        <button
          onClick={() => setPwOpen(true)}
          className="w-full flex items-center gap-3 rounded-xl border border-primary/30 bg-card p-4 active:scale-[0.98] transition text-left"
        >
          <KeyRound className="h-5 w-5 text-primary" />
          <span className="font-semibold">Şifre Değiştir</span>
        </button>

        <Dialog open={pwOpen} onOpenChange={setPwOpen}>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle>Şifre Değiştir</DialogTitle>
              <DialogDescription>Mevcut şifreni ve yeni şifreni gir.</DialogDescription>
            </DialogHeader>
            <div className="space-y-2">
              <div><Label>Mevcut Şifre</Label><Input type="password" value={pwCurrent} onChange={(e) => setPwCurrent(e.target.value)} /></div>
              <div><Label>Yeni Şifre (en az 6 hane)</Label><Input type="password" value={pwNew} onChange={(e) => setPwNew(e.target.value)} /></div>
              <div><Label>Yeni Şifre (tekrar)</Label><Input type="password" value={pwNew2} onChange={(e) => setPwNew2(e.target.value)} /></div>
              <Button className="w-full" disabled={pwSaving} onClick={changePassword}>
                {pwSaving ? "Kaydediliyor..." : "Şifreyi Güncelle"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>



        <Link to="/randevularim" className="flex items-center gap-3 rounded-xl border border-border bg-card p-4 active:scale-[0.98] transition">
          <CalendarDays className="h-5 w-5 text-primary" /><span>Randevularım</span>
        </Link>
        <div className="grid grid-cols-2 gap-2">
          <Link to="/bildirimler" className="flex items-center justify-center gap-2 rounded-xl border border-border bg-card p-4 active:scale-[0.98] transition">
            <Bell className="h-5 w-5 text-primary" /><span className="text-sm font-medium">Bildirimler</span>
          </Link>
          <Button variant="outline" className="w-full h-full min-h-[56px]" onClick={async () => {
            try {
              if (!("Notification" in window) && !("serviceWorker" in navigator)) {
                toast.error("Bu tarayıcı sistem bildirimini desteklemiyor. Uygulamayı ana ekrana ekleyip PWA olarak açmayı dene.");
                return;
              }
              let perm: NotificationPermission = "default";
              if ("Notification" in window) {
                perm = Notification.permission;
                if (perm === "default") perm = await Notification.requestPermission();
                if (perm !== "granted") { toast.error("Bildirim izni reddedildi. Telefon ayarlarından izin verebilirsin."); return; }
              }
              const reg = await navigator.serviceWorker?.ready.catch(() => null);
              const opts: NotificationOptions = {
                body: "Bildirim sistemi çalışıyor ✅",
                icon: "/favicon.ico",
                badge: "/favicon.ico",
                tag: "test-notif",
                data: { url: "/bildirimler" },
              };
              (opts as NotificationOptions & { vibrate?: number[]; renotify?: boolean }).vibrate = [200, 100, 200];
              (opts as NotificationOptions & { vibrate?: number[]; renotify?: boolean }).renotify = true;
              let shown = false;
              if (reg && typeof reg.showNotification === "function") {
                try { await reg.showNotification("Test Bildirimi", opts); shown = true; } catch { /* fall through */ }
              }
              if (!shown && "Notification" in window) {
                try { new Notification("Test Bildirimi", opts); shown = true; } catch { /* fall through */ }
              }
              if (!shown) {
                toast.error("Bu cihaz sistem bildirimini desteklemiyor. Uygulamayı ana ekrana ekleyip PWA olarak açmayı dene.");
                return;
              }
              // Also create a row so it appears in the in-app list.
              const { data: u } = await supabase.auth.getUser();
              if (u.user) {
                await supabase.from("notifications").insert({
                  user_id: u.user.id,
                  title: "Test Bildirimi",
                  body: "Bildirim sistemi çalışıyor ✅",
                });
              }
              toast.success("Test bildirimi gönderildi");
            } catch (e) {
              toast.error("Bildirim gönderilemedi: " + (e as Error).message);
            }
          }}>
            <BellRing className="h-4 w-4 mr-1" /> <span className="text-sm">Bildirim Testi</span>
          </Button>
        </div>
        <Link to="/favoriler" className="flex items-center gap-3 rounded-xl border border-border bg-card p-4 active:scale-[0.98] transition">
          <Heart className="h-5 w-5 text-primary" /><span>Favoriler</span>
        </Link>
        {isOwner && (
          <>
            <Link to="/salon-yonetimi" className="flex items-center gap-3 rounded-xl border border-primary/40 bg-card p-4 active:scale-[0.98] transition">
              <Shield className="h-5 w-5 text-primary" /><span className="font-semibold">Salon Yönetimi</span>
            </Link>
            <Link
              to="/salon-yonetimi"
              onClick={() => window.localStorage.setItem("salon.mgmt.tab", "pos")}
              className="flex items-center gap-3 rounded-xl border border-primary/40 bg-card p-4 active:scale-[0.98] transition"
            >
              <CreditCard className="h-5 w-5 text-primary" /><span className="font-semibold">Sanal POS</span>
            </Link>
            {isOwnerOnly && (
              <Link to="/muhasebe" className="flex items-center gap-3 rounded-xl border border-primary/40 bg-card p-4 active:scale-[0.98] transition">
                <Receipt className="h-5 w-5 text-primary" /><span className="font-semibold">Muhasebe</span>
              </Link>
            )}
          </>
        )}
        {isAdmin && (
          <Link to="/admin" className="flex items-center gap-3 rounded-xl border border-primary/40 bg-card p-4 active:scale-[0.98] transition">
            <Shield className="h-5 w-5 text-primary" /><span className="font-semibold">Yönetici Paneli</span>
          </Link>
        )}

        {showSupport && (
          <div className="rounded-xl border border-primary/30 bg-card p-3 space-y-2">
            <p className="text-xs uppercase tracking-wider text-muted-foreground">Destek</p>
            <div className="grid grid-cols-2 gap-2">
              <a
                href={`https://wa.me/${SUPPORT_PHONE.replace("+", "")}`}
                target="_blank" rel="noreferrer"
                className="flex flex-col items-center gap-1 rounded-lg border border-emerald-500/40 bg-emerald-500/10 p-3 text-emerald-400 active:scale-95 transition"
              >
                <MessageCircle className="h-5 w-5" />
                <span className="text-xs font-semibold">WhatsApp Destek</span>
                <span className="text-[10px] text-muted-foreground">{SUPPORT_PHONE}</span>
              </a>
              <a
                href={`tel:${SUPPORT_PHONE}`}
                className="flex flex-col items-center gap-1 rounded-lg border border-primary/40 bg-primary/10 p-3 text-primary active:scale-95 transition"
              >
                <Phone className="h-5 w-5" />
                <span className="text-xs font-semibold">Müşteri Hizmetleri</span>
                <span className="text-[10px] text-muted-foreground">{SUPPORT_PHONE}</span>
              </a>
            </div>
          </div>
        )}

        <button
          onClick={() => setFeedbackOpen(true)}
          className="w-full flex items-center gap-3 rounded-xl border border-primary/30 bg-card p-4 active:scale-[0.98] transition text-left"
        >
          <MessageSquare className="h-5 w-5 text-primary" />
          <span className="font-semibold">Geri Bildirim</span>
        </button>

        <Dialog open={feedbackOpen} onOpenChange={setFeedbackOpen}>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle>Geri Bildirim</DialogTitle>
              <DialogDescription>Görüş ve önerini bize ilet.</DialogDescription>
            </DialogHeader>
            <Textarea
              value={feedbackMsg}
              onChange={(e) => setFeedbackMsg(e.target.value)}
              placeholder="Görüş / öneri..."
              rows={5}
              maxLength={2000}
            />
            <Button onClick={sendFeedback} disabled={feedbackSending}>
              {feedbackSending ? "Gönderiliyor..." : "Gönder"}
            </Button>
          </DialogContent>
        </Dialog>

        {!isAdmin && (
          <Button variant="destructive" onClick={deleteAccount} className="w-full h-12">
            <Trash2 className="h-4 w-4 mr-2" /> Hesabımı Sil
          </Button>
        )}
        <Button variant="outline" onClick={signOut} className="w-full h-12 mt-2">
          <LogOut className="h-4 w-4 mr-2" /> Çıkış Yap
        </Button>

      </div>
    </AppShell>
  );
}

function PointsBreakdown({ userId }: { userId: string | null }) {
  const { data } = useQuery({
    queryKey: ["points-breakdown", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data } = await supabase
        .from("appointments")
        .select("points_earned, points_used")
        .eq("user_id", userId!);
      let earned = 0, used = 0;
      (data ?? []).forEach((r: any) => { earned += Number(r.points_earned ?? 0); used += Number(r.points_used ?? 0); });
      return { earned, used };
    },
  });
  if (!data || (data.earned === 0 && data.used === 0)) return null;
  return (
    <div className="mt-3 grid grid-cols-2 gap-2">
      <div className="rounded-lg border border-border bg-card p-2 text-center">
        <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Kazanılan</p>
        <p className="font-display text-lg text-primary">+{data.earned}P</p>
      </div>
      <div className="rounded-lg border border-border bg-card p-2 text-center">
        <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Kullanılan</p>
        <p className="font-display text-lg">-{data.used}P</p>
      </div>
    </div>
  );
}
