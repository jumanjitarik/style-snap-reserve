import type { ReactNode } from "react";
import { BottomNav } from "./BottomNav";

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen pb-24">
      <div className="mx-auto max-w-md">{children}</div>
      <BottomNav />
    </div>
  );
}
