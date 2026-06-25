import { Scissors, Sparkles, Hand, Heart, Zap, Crown, Flower2, Activity, Leaf } from "lucide-react";

export type ShopCategory =
  | "male_barber" | "female_barber" | "laser" | "nail" | "skin" | "aesthetic"
  | "spa_massage" | "yoga_pilates" | "slimming";

export const CATEGORIES: { value: ShopCategory; label: string; icon: typeof Scissors }[] = [
  { value: "male_barber", label: "Erkek Kuaförü", icon: Scissors },
  { value: "female_barber", label: "Kadın Kuaförü", icon: Sparkles },
  { value: "laser", label: "Lazer Epilasyon", icon: Zap },
  { value: "nail", label: "Tırnak Bakımı", icon: Hand },
  { value: "skin", label: "Cilt Bakımı", icon: Heart },
  { value: "aesthetic", label: "Estetik", icon: Crown },
  { value: "spa_massage", label: "Spa & Masaj", icon: Flower2 },
  { value: "yoga_pilates", label: "Yoga & Pilates", icon: Activity },
  { value: "slimming", label: "İncelme", icon: Leaf },
];

export const categoryLabel = (c: ShopCategory) =>
  CATEGORIES.find((x) => x.value === c)?.label ?? c;
