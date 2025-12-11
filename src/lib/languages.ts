/**
 * Supported Languages Configuration
 * 
 * Language definitions with RTL support and native names.
 */

export interface Language {
  code: string
  name: string
  nativeName: string
  isRTL: boolean
  locale?: string // Full locale code (e.g., 'es-ES')
}

export const LANGUAGES: Language[] = [
  { code: 'en', name: 'English', nativeName: 'English', isRTL: false, locale: 'en-US' },
  { code: 'es', name: 'Spanish', nativeName: 'Español', isRTL: false, locale: 'es-ES' },
  { code: 'fr', name: 'French', nativeName: 'Français', isRTL: false, locale: 'fr-FR' },
  { code: 'de', name: 'German', nativeName: 'Deutsch', isRTL: false, locale: 'de-DE' },
  { code: 'it', name: 'Italian', nativeName: 'Italiano', isRTL: false, locale: 'it-IT' },
  { code: 'pt', name: 'Portuguese', nativeName: 'Português', isRTL: false, locale: 'pt-BR' },
  { code: 'zh', name: 'Chinese', nativeName: '中文', isRTL: false, locale: 'zh-CN' },
  { code: 'ja', name: 'Japanese', nativeName: '日本語', isRTL: false, locale: 'ja-JP' },
  { code: 'ko', name: 'Korean', nativeName: '한국어', isRTL: false, locale: 'ko-KR' },
  { code: 'ru', name: 'Russian', nativeName: 'Русский', isRTL: false, locale: 'ru-RU' },
  { code: 'ar', name: 'Arabic', nativeName: 'العربية', isRTL: true, locale: 'ar-SA' },
  { code: 'he', name: 'Hebrew', nativeName: 'עברית', isRTL: true, locale: 'he-IL' },
  { code: 'fa', name: 'Persian', nativeName: 'فارسی', isRTL: true, locale: 'fa-IR' },
  { code: 'hi', name: 'Hindi', nativeName: 'हिन्दी', isRTL: false, locale: 'hi-IN' },
  { code: 'vi', name: 'Vietnamese', nativeName: 'Tiếng Việt', isRTL: false, locale: 'vi-VN' },
  { code: 'th', name: 'Thai', nativeName: 'ไทย', isRTL: false, locale: 'th-TH' },
  { code: 'tr', name: 'Turkish', nativeName: 'Türkçe', isRTL: false, locale: 'tr-TR' },
  { code: 'pl', name: 'Polish', nativeName: 'Polski', isRTL: false, locale: 'pl-PL' },
  { code: 'nl', name: 'Dutch', nativeName: 'Nederlands', isRTL: false, locale: 'nl-NL' },
  { code: 'uk', name: 'Ukrainian', nativeName: 'Українська', isRTL: false, locale: 'uk-UA' },
]

/**
 * Get language name by code
 */
export const getLanguageName = (code: string): string =>
  LANGUAGES.find(lang => lang.code === code)?.name || code

/**
 * Get native language name by code
 */
export const getNativeLanguageName = (code: string): string =>
  LANGUAGES.find(lang => lang.code === code)?.nativeName || code

/**
 * Check if a language code is RTL
 */
export const isRTL = (code: string): boolean =>
  LANGUAGES.find(lang => lang.code === code)?.isRTL ?? false

/**
 * Get language by code
 */
export const getLanguage = (code: string): Language | undefined =>
  LANGUAGES.find(lang => lang.code === code)

/**
 * Get full locale code (e.g., 'en-US')
 */
export const getLocale = (code: string): string =>
  LANGUAGES.find(lang => lang.code === code)?.locale || code

/**
 * RTL languages list for quick checks
 */
export const RTL_LANGUAGE_CODES = LANGUAGES
  .filter(lang => lang.isRTL)
  .map(lang => lang.code)
