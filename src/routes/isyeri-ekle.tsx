import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { AppShell } from "@/components/AppShell";
import { BackButton } from "@/components/BackButton";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { Store, Send, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/isyeri-ekle")({
  head: () => ({ meta: [{ title: "İş Yeri Ekle — KuaförApp" }] }),
  component: BusinessRequestPage,
});

function BusinessRequestPage() {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    business_name: "",
    address: "",
    services: "",
    subject: "",
    phone: "",
  });
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  async function submit() {
    if (!form.business_name.trim() || !form.address.trim() || !form.services.trim() || !form.subject.trim() || !form.phone.trim()) {
      toast.error("Tüm alanları doldur.");
      return;
    }
    setSending(true);
    const { data: u } = await supabase.auth.getUser();
    const phone = "+90" + form.phone.replace(/\D/g, "").replace(/^90/, "");
    const { error } = await supabase.from("business_requests" as never).insert({
      business_name: form.business_name.trim(),
      address: form.address.trim(),
      services: form.services.trim(),
      subject: form.subject.trim(),
      phone,
      created_by: u.user?.id ?? null,
    } as never);
    setSending(false);
    if (error) { toast.error(error.message); return; }
    setSent(true);
  }

  if (sent) {
    return (
      <AppShell>
        <BackButton to="/" />
        <div className="px-4 pt-16 flex flex-col items-center gap-4 text-center">
          <div className="h-20 w-20 rounded-full bg-primary/15 flex items-center justify-center">
            <CheckCircle2 className="h-12 w-12 text-primary" />
          </div>
          <h1 className="font-display text-2xl">Talebiniz iletilmiştir</h1>
          <p className="text-sm text-muted-foreground max-w-xs">
            Yönetici ekibimiz kısa süre içinde iş yerinizle iletişime geçecek.
          </p>
          <Button className="mt-2 w-full max-w-xs" onClick={() => navigate({ to: "/" })}>Ana Sayfaya Dön</Button>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <BackButton to="/" />
      <header className="px-4 pt-4 pb-3 flex items-center gap-2">
        <Store className="h-6 w-6 text-primary" />
        <h1 className="font-display text-3xl">İş Yeri Ekle</h1>
      </header>
      <p className="px-4 text-sm text-muted-foreground">
        İş yeri bilgilerinizi bize iletin, ekibimiz sizinle iletişime geçsin.
      </p>
      <div className="px-4 pt-4 pb-8 space-y-3">
        <div>
          <Label>İş Yeri Adı</Label>
          <Input value={form.business_name} onChange={(e) => setForm({ ...form, business_name: e.target.value })} placeholder="Örn: Ali Kuaför" />
        </div>
        <div>
          <Label>İş Yeri Adresi</Label>
          <Textarea rows={2} value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} placeholder="Mahalle, cadde, no, ilçe/şehir" />
        </div>
        <div>
          <Label>Verilen Hizmetler</Label>
          <Textarea rows={3} value={form.services} onChange={(e) => setForm({ ...form, services: e.target.value })} placeholder="Örn: saç kesim, sakal, cilt bakımı..." />
        </div>
        <div>
          <Label>İletmek İstediğiniz Konu</Label>
          <Textarea rows={4} value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} placeholder="Kısa bir açıklama yazın" />
        </div>
        <div>
          <Label>Telefon Numarası</Label>
          <div className="flex">
            <span className="inline-flex items-center px-3 rounded-l-md border border-r-0 border-input bg-muted text-sm font-semibold text-primary">+90</span>
            <Input type="tel" inputMode="numeric" maxLength={10} className="rounded-l-none"
              value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value.replace(/\D/g, "") })} placeholder="5xxxxxxxxx" />
          </div>
        </div>
        <Button className="w-full h-12" disabled={sending} onClick={submit}>
          <Send className="h-4 w-4 mr-2" /> {sending ? "Gönderiliyor…" : "Formu Gönder"}
        </Button>
      </div>
    </AppShell>
  );
}
