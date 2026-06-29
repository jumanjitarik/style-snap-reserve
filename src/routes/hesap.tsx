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
import { User, LogOut, Heart, Bell, CalendarDays, Shield, LogIn, Upload, Save, Trash2, BellRing } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/hesap")({
  component: AccountPage,
});

function AccountPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [userId, setUserId] = useState<string | null>(null);
  const [authChecked, setAuthChecked] = useState(false);
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
                  {r.role}
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

        <Link to="/randevularim" className="flex items-center gap-3 rounded-xl border border-border bg-card p-4 active:scale-[0.98] transition">
          <CalendarDays className="h-5 w-5 text-primary" /><span>Randevularım</span>
        </Link>
        <Link to="/bildirimler" className="flex items-center gap-3 rounded-xl border border-border bg-card p-4 active:scale-[0.98] transition">
          <Bell className="h-5 w-5 text-primary" /><span>Bildirimler</span>
        </Link>
        <Button variant="outline" className="w-full h-12" onClick={async () => {
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
          <BellRing className="h-4 w-4 mr-2" /> Bildirim Testi Yap
        </Button>
        <Link to="/favoriler" className="flex items-center gap-3 rounded-xl border border-border bg-card p-4 active:scale-[0.98] transition">
          <Heart className="h-5 w-5 text-primary" /><span>Favoriler</span>
        </Link>
        {isOwner && (
          <Link to="/salon-yonetimi" className="flex items-center gap-3 rounded-xl border border-primary/40 bg-card p-4 active:scale-[0.98] transition">
            <Shield className="h-5 w-5 text-primary" /><span className="font-semibold">Salon Yönetimi</span>
          </Link>
        )}
        {isAdmin && (
          <Link to="/admin" className="flex items-center gap-3 rounded-xl border border-primary/40 bg-card p-4 active:scale-[0.98] transition">
            <Shield className="h-5 w-5 text-primary" /><span className="font-semibold">Yönetici Paneli</span>
          </Link>
        )}

        <Button variant="outline" onClick={signOut} className="w-full h-12 mt-4">
          <LogOut className="h-4 w-4 mr-2" /> Çıkış Yap
        </Button>
        {!isAdmin && (
          <Button variant="destructive" onClick={deleteAccount} className="w-full h-12">
            <Trash2 className="h-4 w-4 mr-2" /> Hesabımı Sil
          </Button>
        )}

      </div>
    </AppShell>
  );
}
