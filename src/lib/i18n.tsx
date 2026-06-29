import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

export type Lang = "tr" | "en" | "ru" | "uk" | "fa" | "ar";

export const LANGS: { code: Lang; label: string; flag: string }[] = [
  { code: "tr", label: "Türkçe", flag: "🇹🇷" },
  { code: "en", label: "English", flag: "🇬🇧" },
  { code: "ru", label: "Русский", flag: "🇷🇺" },
  { code: "uk", label: "Українська", flag: "🇺🇦" },
  { code: "fa", label: "فارسی", flag: "🇮🇷" },
  { code: "ar", label: "العربية", flag: "🇸🇦" },
];

type Dict = Record<string, string>;

const DICTS: Record<Lang, Dict> = {
  tr: {
    "nav.home": "Ana",
    "nav.shops": "Salonlar",
    "nav.borsa": "Borsa",
    "nav.book": "Randevu Al",
    "nav.points": "Puan",
    "nav.appointments": "Randevu",
    "nav.account": "Hesap",
    "auth.signin": "Giriş Yap",
    "auth.signup": "Kayıt Ol",
    "auth.email": "E-posta",
    "auth.password": "Şifre",
    "auth.fullname": "Ad Soyad",
    "auth.phone": "Telefon",
    "common.save": "Kaydet",
    "common.cancel": "İptal",
    "common.delete": "Sil",
    "common.edit": "Düzenle",
    "common.add": "Ekle",
    "common.language": "Dil",
    "common.loading": "Yükleniyor...",
    "common.search": "Ara",
  },
  en: {
    "nav.home": "Home",
    "nav.shops": "Salons",
    "nav.borsa": "Market",
    "nav.book": "Book",
    "nav.points": "Points",
    "nav.appointments": "Bookings",
    "nav.account": "Account",
    "auth.signin": "Sign In",
    "auth.signup": "Sign Up",
    "auth.email": "Email",
    "auth.password": "Password",
    "auth.fullname": "Full Name",
    "auth.phone": "Phone",
    "common.save": "Save",
    "common.cancel": "Cancel",
    "common.delete": "Delete",
    "common.edit": "Edit",
    "common.add": "Add",
    "common.language": "Language",
    "common.loading": "Loading...",
    "common.search": "Search",
  },
  ru: {
    "nav.home": "Главная",
    "nav.shops": "Салоны",
    "nav.borsa": "Биржа",
    "nav.book": "Записаться",
    "nav.points": "Баллы",
    "nav.appointments": "Записи",
    "nav.account": "Профиль",
    "auth.signin": "Войти",
    "auth.signup": "Регистрация",
    "auth.email": "Эл. почта",
    "auth.password": "Пароль",
    "auth.fullname": "Имя Фамилия",
    "auth.phone": "Телефон",
    "common.save": "Сохранить",
    "common.cancel": "Отмена",
    "common.delete": "Удалить",
    "common.edit": "Изменить",
    "common.add": "Добавить",
    "common.language": "Язык",
    "common.loading": "Загрузка...",
    "common.search": "Поиск",
  },
  uk: {
    "nav.home": "Головна",
    "nav.shops": "Салони",
    "nav.borsa": "Біржа",
    "nav.book": "Записатися",
    "nav.points": "Бали",
    "nav.appointments": "Записи",
    "nav.account": "Профіль",
    "auth.signin": "Увійти",
    "auth.signup": "Реєстрація",
    "auth.email": "Ел. пошта",
    "auth.password": "Пароль",
    "auth.fullname": "Імʼя та прізвище",
    "auth.phone": "Телефон",
    "common.save": "Зберегти",
    "common.cancel": "Скасувати",
    "common.delete": "Видалити",
    "common.edit": "Редагувати",
    "common.add": "Додати",
    "common.language": "Мова",
    "common.loading": "Завантаження...",
    "common.search": "Пошук",
  },
  fa: {
    "nav.home": "خانه",
    "nav.shops": "سالن‌ها",
    "nav.borsa": "بازار",
    "nav.book": "رزرو",
    "nav.points": "امتیاز",
    "nav.appointments": "نوبت‌ها",
    "nav.account": "حساب",
    "auth.signin": "ورود",
    "auth.signup": "ثبت‌نام",
    "auth.email": "ایمیل",
    "auth.password": "گذرواژه",
    "auth.fullname": "نام و نام خانوادگی",
    "auth.phone": "تلفن",
    "common.save": "ذخیره",
    "common.cancel": "لغو",
    "common.delete": "حذف",
    "common.edit": "ویرایش",
    "common.add": "افزودن",
    "common.language": "زبان",
    "common.loading": "در حال بارگذاری...",
    "common.search": "جستجو",
  },
  ar: {
    "nav.home": "الرئيسية",
    "nav.shops": "الصالونات",
    "nav.borsa": "السوق",
    "nav.book": "احجز",
    "nav.points": "النقاط",
    "nav.appointments": "المواعيد",
    "nav.account": "الحساب",
    "auth.signin": "تسجيل الدخول",
    "auth.signup": "إنشاء حساب",
    "auth.email": "البريد",
    "auth.password": "كلمة المرور",
    "auth.fullname": "الاسم الكامل",
    "auth.phone": "الهاتف",
    "common.save": "حفظ",
    "common.cancel": "إلغاء",
    "common.delete": "حذف",
    "common.edit": "تعديل",
    "common.add": "إضافة",
    "common.language": "اللغة",
    "common.loading": "جارٍ التحميل...",
    "common.search": "بحث",
  },
};

const LS_KEY = "app.lang";

type Ctx = { lang: Lang; setLang: (l: Lang) => void; t: (k: string) => string };
const I18nCtx = createContext<Ctx>({ lang: "tr", setLang: () => {}, t: (k) => k });

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>("tr");

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(LS_KEY) as Lang | null;
      if (stored && DICTS[stored]) setLangState(stored);
    } catch { /* noop */ }
  }, []);

  const setLang = useCallback((l: Lang) => {
    setLangState(l);
    try { window.localStorage.setItem(LS_KEY, l); } catch { /* noop */ }
    if (typeof document !== "undefined") {
      document.documentElement.lang = l;
      document.documentElement.dir = (l === "ar" || l === "fa") ? "rtl" : "ltr";
    }
  }, []);

  useEffect(() => {
    if (typeof document !== "undefined") {
      document.documentElement.lang = lang;
      document.documentElement.dir = (lang === "ar" || lang === "fa") ? "rtl" : "ltr";
    }
  }, [lang]);

  const t = useCallback((k: string) => DICTS[lang]?.[k] ?? DICTS.tr[k] ?? k, [lang]);

  const value = useMemo(() => ({ lang, setLang, t }), [lang, setLang, t]);
  return <I18nCtx.Provider value={value}>{children}</I18nCtx.Provider>;
}

export function useT() {
  return useContext(I18nCtx);
}
