// Language registry: everything the app needs to know about a teaching language lives here.
// To add a language: add an entry below, a dictionary in src/locales/<code>.json (English text ->
// translation), and backend/app/teacher/locales/<code>.json for Melo's spoken lines.
// The backend mirror of this table is backend/app/languages.py.

export type Language = "en" | "hi" | "hinglish" | "es" | "fr" | "zh" | "ar";
/** How notes are named when shown and sung: C D E, Sa Re Ga (C = Sa) or Do Re Mi (C = Do). */
export type NoteSystem = "letters" | "sargam" | "solfege";

export interface LangInfo {
  name: string; // in English, for the parent's settings
  native: string;
  notes: NoteSystem;
  rtl?: boolean;
  htmlLang: string;
  /** Speech-synthesis locales to try, best first. */
  voices: string[];
  /** Voice names that sound natural for this language, best first. */
  prefer: RegExp[];
  /** Speech-recognition locale. */
  listen: string;
  /** Translated by machine and not yet reviewed by a native-speaking teacher. */
  beta?: boolean;
}

export const LANGS: Record<Language, LangInfo> = {
  en: { name: "English", native: "English", notes: "letters", htmlLang: "en", voices: ["en-IN", "en-GB", "en-US", "en"],
    prefer: [/neerja/i, /prabhat/i, /heera/i, /ravi/i, /google.*(india|en-in)/i, /sonia|libby|aria|jenny/i], listen: "en-IN" },
  hi: { name: "Hindi", native: "हिंदी", notes: "sargam", htmlLang: "hi", voices: ["hi-IN", "hi"],
    prefer: [/swara/i, /madhur/i, /google\s*हिन्दी|google.*hindi/i, /kalpana/i, /hemant/i], listen: "hi-IN" },
  // Latin-script Hinglish reads best with an Indian English voice
  hinglish: { name: "Hinglish", native: "Hinglish", notes: "sargam", htmlLang: "en", voices: ["en-IN", "hi-IN", "en"],
    prefer: [/neerja/i, /prabhat/i, /swara/i, /heera/i, /ravi/i], listen: "en-IN" },
  es: { name: "Spanish", native: "Español", notes: "solfege", htmlLang: "es", voices: ["es-ES", "es-MX", "es-US", "es"],
    prefer: [/elvira/i, /dalia/i, /paloma/i, /google.*espa/i, /helena|laura|sabina/i], listen: "es-ES", beta: true },
  fr: { name: "French", native: "Français", notes: "solfege", htmlLang: "fr", voices: ["fr-FR", "fr-CA", "fr"],
    prefer: [/denise/i, /eloise/i, /sylvie/i, /google.*fran/i, /hortense|julie/i], listen: "fr-FR", beta: true },
  zh: { name: "Chinese (Mandarin)", native: "中文", notes: "solfege", htmlLang: "zh-Hans", voices: ["zh-CN", "cmn", "zh-TW", "zh"],
    prefer: [/xiaoxiao/i, /xiaoyi/i, /google.*(普通话|mandarin|中文)/i, /huihui|yaoyao/i], listen: "zh-CN", beta: true },
  ar: { name: "Arabic", native: "العربية", notes: "solfege", rtl: true, htmlLang: "ar", voices: ["ar-SA", "ar-EG", "ar-AE", "ar"],
    prefer: [/zariyah/i, /salma/i, /fatima/i, /google.*(عرب|arabic)/i, /hoda|naayf/i], listen: "ar-SA", beta: true },
};

export const LANGUAGE_CODES = Object.keys(LANGS) as Language[];
export const langInfo = (lang: Language): LangInfo => LANGS[lang] ?? LANGS.en;
