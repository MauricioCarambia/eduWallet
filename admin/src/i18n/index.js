import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import LanguageDetector from 'i18next-browser-languagedetector'
import es from './locales/es.json'
import en from './locales/en.json'

// Idioma elegido antes del cambio de nombre (EduWallet → EduPass)
try {
  const viejo = localStorage.getItem('eduwallet_idioma')
  if (viejo && !localStorage.getItem('edupass_idioma')) localStorage.setItem('edupass_idioma', viejo)
} catch { /* sin localStorage */ }

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      es: { translation: es },
      en: { translation: en },
    },
    fallbackLng: 'es',
    supportedLngs: ['es', 'en'],
    interpolation: { escapeValue: false },
    detection: {
      order: ['localStorage', 'navigator'],
      caches: ['localStorage'],
      lookupLocalStorage: 'edupass_idioma',
    },
  })

export default i18n
