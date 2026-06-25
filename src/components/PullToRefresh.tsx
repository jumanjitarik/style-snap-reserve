import { useEffect, useRef, useState } from "react";
import { useRouter } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { Loader2, ArrowDown } from "lucide-react";

const THRESHOLD = 70;

export function PullToRefresh() {
  const router = useRouter();
  const qc = useQueryClient();
  const startY = useRef<number | null>(null);
  const [pull, setPull] = useState(0);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    function onStart(e: TouchEvent) {
      if (window.scrollY > 0 || refreshing) { startY.current = null; return; }
      startY.current = e.touches[0].clientY;
    }
    function onMove(e: TouchEvent) {
      if (startY.current == null) return;
      const dy = e.touches[0].clientY - startY.current;
      if (dy > 0) {
        setPull(Math.min(dy * 0.5, 100));
      }
    }
    async function onEnd() {
      if (startY.current == null) return;
      const current = pull;
      startY.current = null;
      if (current >= THRESHOLD) {
        setRefreshing(true);
        try {
          await Promise.all([router.invalidate(), qc.invalidateQueries()]);
        } finally {
          setRefreshing(false);
          setPull(0);
        }
      } else {
        setPull(0);
      }
    }
    window.addEventListener("touchstart", onStart, { passive: true });
    window.addEventListener("touchmove", onMove, { passive: true });
    window.addEventListener("touchend", onEnd);
    return () => {
      window.removeEventListener("touchstart", onStart);
      window.removeEventListener("touchmove", onMove);
      window.removeEventListener("touchend", onEnd);
    };
  }, [pull, refreshing, router, qc]);

  if (pull === 0 && !refreshing) return null;
  const h = refreshing ? 56 : pull;
  return (
    <div
      className="fixed left-0 right-0 top-0 z-[60] flex items-center justify-center text-primary transition-[height] duration-150 pointer-events-none"
      style={{ height: h }}
    >
      {refreshing ? (
        <Loader2 className="h-5 w-5 animate-spin" />
      ) : (
        <ArrowDown
          className="h-5 w-5 transition-transform"
          style={{ transform: `rotate(${Math.min(pull * 2.5, 180)}deg)` }}
        />
      )}
    </div>
  );
}
