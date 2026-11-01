import { useState } from 'react'
import { t } from './i18n'
import { speechSupported, useDictation } from './speech'
import { useStore } from './state'
import { QuietButton } from './ui'

/** Voice answers, after a one-time notice about where the audio goes. */
export function Dictate({ lang, onText }: { lang: string; onText: (t: string) => void }) {
  const { prefs, updatePrefs } = useStore()
  const dictation = useDictation(lang, onText)
  const [asking, setAsking] = useState(false)
  if (!speechSupported()) return null

  if (asking) {
    return (
      <div className="flex flex-col gap-2 border-l border-[var(--rule)] pl-4 text-sm">
        <p>
          {t(
            'La dettatura usa il riconoscimento vocale del browser: in Chrome ed Edge l’audio viene trascritto dai server di Google o Microsoft. Vector non lo registra.',
          )}
        </p>
        <div className="flex gap-2">
          <QuietButton
            className="text-[var(--fg)] underline"
            onClick={() => {
              void updatePrefs({ ...prefs, study: { ...prefs.study, voiceConsent: true } })
              setAsking(false)
              dictation.start()
            }}
          >
            {t('Ho capito, detta')}
          </QuietButton>
          <QuietButton onClick={() => setAsking(false)}>{t('No, scrivo')}</QuietButton>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-wrap items-center gap-2 text-sm">
      {dictation.listening ? (
        <QuietButton className="text-[var(--fg)] underline" onClick={dictation.stop}>
          {t('Smetti di dettare')}
        </QuietButton>
      ) : (
        <QuietButton
          onClick={() => (prefs.study.voiceConsent ? dictation.start() : setAsking(true))}
        >
          {t('Rispondi a voce')}
        </QuietButton>
      )}
      {dictation.interim && <span className="text-[var(--fg-quiet)]">{dictation.interim}…</span>}
      {dictation.error && <span role="alert">{dictation.error}</span>}
    </div>
  )
}
