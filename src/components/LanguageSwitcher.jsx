import { useTranslation } from 'react-i18next'
import { Globe } from 'lucide-react'

const LANGS = [
  { code: 'de', label: 'DE', flag: '🇩🇪' },
  { code: 'en', label: 'EN', flag: '🇬🇧' },
  { code: 'tr', label: 'TR', flag: '🇹🇷' },
]

export default function LanguageSwitcher() {
  const { i18n } = useTranslation()

  return (
    <div className="flex items-center gap-1">
      <Globe size={13} className="text-teal-200" />
      {LANGS.map(lang => (
        <button
          key={lang.code}
          onClick={() => i18n.changeLanguage(lang.code)}
          className={`text-xs px-1.5 py-0.5 rounded transition-colors ${
            i18n.language === lang.code
              ? 'bg-white text-teal-700 font-bold'
              : 'text-teal-100 hover:text-white'
          }`}
        >
          {lang.flag} {lang.label}
        </button>
      ))}
    </div>
  )
}
