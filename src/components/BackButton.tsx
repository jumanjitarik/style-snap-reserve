import { useRouter } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";

export function BackButton({ to, label }: { to?: string; label?: string }) {
  const router = useRouter();
  return (
    <button
      onClick={() => {
        if (to) router.navigate({ to: to as never });
        else router.history.back();
      }}
      aria-label="Geri"
      className="fixed top-3 left-3 z-40 flex items-center gap-1.5 rounded-full bg-card/90 backdrop-blur border border-border px-3 h-10 text-sm font-medium shadow-lg active:scale-90 transition"
    >
      <ArrowLeft className="h-4 w-4" />
      {label && <span>{label}</span>}
    </button>
  );
}
