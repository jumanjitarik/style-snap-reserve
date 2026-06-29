
function CoverCarousel({ coverUrl, images, alt }: { coverUrl: string | null; images: string[]; alt: string }) {
  const all = useMemo(() => {
    const arr: string[] = [];
    if (coverUrl) arr.push(coverUrl);
    images.forEach((u) => { if (u && u !== coverUrl) arr.push(u); });
    return arr;
  }, [coverUrl, images]);
  const { data: settings } = useQuery({
    queryKey: ["gallery-interval"],
    queryFn: async () => {
      const { data } = await supabase.from("app_settings").select("value").eq("key", "gallery_interval_ms").maybeSingle();
      const ms = Number(data?.value ?? 3000);
      return Number.isFinite(ms) && ms >= 1000 ? ms : 3000;
    },
    staleTime: 60_000,
  });
  const intervalMs = settings ?? 3000;
  const [idx, setIdx] = useState(0);
  const [touchX, setTouchX] = useState<number | null>(null);

  useEffect(() => {
    if (all.length < 2) return;
    const t = setInterval(() => setIdx((i) => (i + 1) % all.length), intervalMs);
    return () => clearInterval(t);
  }, [all.length, intervalMs]);

  if (all.length === 0) return <div className="relative aspect-[16/10] bg-muted" />;

  return (
    <div
      className="relative aspect-[16/10] bg-muted overflow-hidden select-none"
      onTouchStart={(e) => setTouchX(e.touches[0].clientX)}
      onTouchEnd={(e) => {
        if (touchX == null) return;
        const dx = e.changedTouches[0].clientX - touchX;
        if (Math.abs(dx) > 40) {
          setIdx((i) => (i + (dx < 0 ? 1 : all.length - 1)) % all.length);
        }
        setTouchX(null);
      }}
    >
      <div className="flex h-full transition-transform duration-500 ease-out" style={{ transform: `translateX(-${idx * 100}%)`, width: `${all.length * 100}%` }}>
        {all.map((u, i) => (
          <div key={i} className="h-full shrink-0" style={{ width: `${100 / all.length}%` }}>
            <SafeImg src={u} alt={alt} className="h-full w-full object-cover" />
          </div>
        ))}
      </div>
      {all.length > 1 && (
        <>
          <button aria-label="Önceki" onClick={() => setIdx((i) => (i - 1 + all.length) % all.length)} className="absolute left-2 top-1/2 -translate-y-1/2 z-10 rounded-full bg-background/70 backdrop-blur p-1.5 text-foreground active:scale-90">‹</button>
          <button aria-label="Sonraki" onClick={() => setIdx((i) => (i + 1) % all.length)} className="absolute right-2 top-1/2 -translate-y-1/2 z-10 rounded-full bg-background/70 backdrop-blur p-1.5 text-foreground active:scale-90">›</button>
          <div className="absolute bottom-2 left-1/2 -translate-x-1/2 z-10 flex gap-1">
            {all.map((_, i) => (
              <span key={i} className={`h-1.5 rounded-full transition-all ${i === idx ? "w-6 bg-primary" : "w-1.5 bg-background/70"}`} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
