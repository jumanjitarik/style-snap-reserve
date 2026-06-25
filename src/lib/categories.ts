import { Scissors, Sparkles, Hand, Heart, Zap, Crown } from "lucide-react";

export type ShopCategory = "male_barber" | "female_barber" | "laser" | "nail" | "skin" | "aesthetic";

export const CATEGORIES: { value: ShopCategory; label: string; icon: typeof Scissors }[] = [
  { value: "male_barber", label: "Erkek Kuaförü", icon: Scissors },
  { value: "female_barber", label: "Kadın Kuaförü", icon: Sparkles },
  { value: "laser", label: "Lazer Epilasyon", icon: Zap },
  { value: "nail", label: "Tırnak Bakımı", icon: Hand },
  { value: "skin", label: "Cilt Bakımı", icon: Heart },
  { value: "aesthetic", label: "Estetik", icon: Crown },
];

export const categoryLabel = (c: ShopCategory) =>
  CATEGORIES.find((x) => x.value === c)?.label ?? c;
