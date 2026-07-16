import { SafeImg } from "@/components/SafeImg";
import { CategoryFallbackIcon } from "@/lib/dynamic-categories";
import { cn } from "@/lib/utils";

export const EMOJI_PRESETS: string[] = [
  "💈","💇","💇‍♀️","💇‍♂️","💅","💄","💋","👄","👁️","👀",
  "🦷","🧖","🧖‍♀️","🧖‍♂️","🧘","🧘‍♀️","🧘‍♂️","🏋️","🏋️‍♀️","🤸",
  "🤸‍♀️","⛹️","🚴","🤺","🥊","🥋","🏓","⚽","🏀","🎾",
  "🏸","⛳","🎳","🎯","🏹","🚵","🏇","✂️","🪮","🪒",
  "🧴","🧼","🪥","🧽","🧻","🌿","🍃","🌱","🌸","🌺",
  "🌻","🌷","🌹","💐","🌼","🌾","🍀","🌳","🌴","🌵",
  "⭐","✨","⚡","🔥","💫","💧","💎","💍","👑","🎀",
  "🎗️","🎁","🛍️","🕯️","🪷","🪴","🥥","🥑","🍋","🍎",
  "🫐","🍇","🥒","🥕","🎨","🖌️","🪞","🛁","🚿","🛀",
  "🧊","❄️","☀️","🌙","⚙️","🔬","💊","🩹","🩺","❤️",
  "💗","💖","🌈","🦋",
];

export const EMOJI_PREFIX = "emoji:";

export function isEmojiIcon(v: string | null | undefined): v is string {
  return !!v && v.startsWith(EMOJI_PREFIX);
}

export function CategoryIcon({
  icon,
  className,
  alt = "",
  emojiClassName,
}: {
  icon: string | null | undefined;
  className?: string;
  alt?: string;
  emojiClassName?: string;
}) {
  if (isEmojiIcon(icon)) {
    return (
      <span
        aria-label={alt || undefined}
        className={cn("inline-flex items-center justify-center leading-none", className, emojiClassName)}
        style={{ fontSize: "1em" }}
      >
        {icon.slice(EMOJI_PREFIX.length)}
      </span>
    );
  }
  if (icon) {
    return <SafeImg src={icon} alt={alt} className={cn("object-contain", className)} />;
  }
  return <CategoryFallbackIcon className={className} />;
}
