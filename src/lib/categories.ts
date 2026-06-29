import { Scissors, Sparkles, Hand, Heart, Zap, Flower2, Activity, Leaf, Dumbbell } from "lucide-react";

// DB enum values
export type ShopCategory =
  | "male_barber" | "female_barber" | "laser" | "nail" | "skin" | "aesthetic"
  | "spa_massage" | "yoga_pilates" | "slimming" | "fitness";

// UI categories — `skin` and `aesthetic` are merged under one button.
// `dbValues` is what gets used to filter shops in DB queries.
export type UiCategory = {
  key: string;
  label: string;
  icon: typeof Scissors;
  dbValues: ShopCategory[];
};

export const CATEGORIES: UiCategory[] = [
  { key: "male_barber",   label: "Erkek Kuaförü",        icon: Scissors,  dbValues: ["male_barber"] },
  { key: "female_barber", label: "Kadın Kuaförü",        icon: Sparkles,  dbValues: ["female_barber"] },
  { key: "laser",         label: "Lazer Epilasyon",       icon: Zap,       dbValues: ["laser"] },
  { key: "nail",          label: "Tırnak Bakımı",         icon: Hand,      dbValues: ["nail"] },
  { key: "skin_aesthetic",label: "Cilt Bakımı & Estetik", icon: Heart,     dbValues: ["skin", "aesthetic"] },
  { key: "fitness",       label: "Fitness Salonu",        icon: Dumbbell,  dbValues: ["fitness"] },
  { key: "spa_massage",   label: "Spa & Masaj",           icon: Flower2,   dbValues: ["spa_massage"] },
  { key: "yoga_pilates",  label: "Yoga & Pilates",        icon: Activity,  dbValues: ["yoga_pilates"] },
  { key: "slimming",      label: "İncelme",               icon: Leaf,      dbValues: ["slimming"] },
];

// Map a raw DB category to its UI label.
export const categoryLabel = (c: ShopCategory | string): string => {
  const cat = CATEGORIES.find((x) => x.dbValues.includes(c as ShopCategory));
  return cat?.label ?? String(c);
};

// Lookup a UI category entry by its key (used by filter URLs).
export const findUiCategory = (key: string) => CATEGORIES.find((c) => c.key === key);
