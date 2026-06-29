// Legacy BackButton — kept as a no-op so existing imports keep working.
// The active "back" affordance now lives inside <TopBar /> on the far left.
export function BackButton(_props?: { to?: string; label?: string }) {
  return null;
}
