import type React from 'react'
import { useEffect, useState } from 'react'
import { msg } from '../../core/i18n'
import {
  buildProfile,
  dayPartLabel,
  type Profile as ProfileData,
  profileHints,
} from '../../core/profile'
import { clearLearningHistory, loadAttempts, loadFocusRecords, loadLookups } from '../data/db'
import { t } from '../i18n'
import { hrefFor } from '../router'
import { useStore } from '../state'
import { Page, percent, QuietButton } from '../ui'

const kindLabel = {
  recall: msg('Richiamo'),
  reasoning: msg('Ragionamento'),
  calculation: msg('Calcolo'),
  open: msg('Domande aperte'),
} as const

/** "Cosa so di te": everything Vector derived from the learner's history, in plain sight. */
export function Profile() {
  const { course, prefs } = useStore()
  const [profile, setProfile] = useState<ProfileData | null>(null)
  const [armed, setArmed] = useState(false)

  useEffect(() => {
    void Promise.all([loadAttempts(), loadFocusRecords(), loadLookups()]).then(([a, f, l]) =>
      setProfile(buildProfile(a, f, l, course)),
    )
  }, [course])

  if (!profile) return null
  const hints = profileHints(profile)

  return (
    <Page title={t('Cosa so di te')}>
      <p className="text-[var(--fg-quiet)]">
        {t(
          'Tutto quello che Vector ha capito di come studi, calcolato su questo dispositivo dalle tue risposte. Niente esce da qui, tranne le note in fondo se chiedi una spiegazione all’IA',
        )}
        {prefs.study.personalize ? '' : t(' (disattivate nelle impostazioni)')}.
      </p>

      {profile.attempts === 0 ? (
        <p>{t('Ancora niente: rispondi a qualche domanda e torna qui.')}</p>
      ) : (
        <>
          <Section title={t('Risposte')}>
            <Row label={t('Risposte date')} value={String(profile.attempts)} />
            <Row label={t('Concetti capiti davvero')} value={percent(profile.understood)} />
            <Row
              label={t('Domande riconosciute invece che ragionate')}
              value={percent(profile.recognized)}
            />
            <Row
              label={t('Giuste per caso o con il perché sbagliato')}
              value={percent(profile.lucky)}
            />
            <Row
              label={t('Tempo tipico per risposta')}
              value={`${Math.round(profile.medianSeconds)} s`}
            />
          </Section>

          {profile.subjects.length > 0 && (
            <Section title={t('Materie, dalla più difficile')}>
              {profile.subjects.map((s) => (
                <Row
                  key={s.subjectId}
                  label={t(s.name)}
                  value={t('{share} · {attempts} risposte', {
                    share: percent(s.understood),
                    attempts: s.attempts,
                  })}
                  href={hrefFor({ name: 'subjects', subjectId: s.subjectId })}
                />
              ))}
            </Section>
          )}

          {profile.kinds.length > 1 && (
            <Section title={t('Tipi di domanda')}>
              {profile.kinds.map((k) => (
                <Row
                  key={k.kind}
                  label={t(kindLabel[k.kind])}
                  value={`${percent(k.understood)} · ${k.attempts}`}
                />
              ))}
            </Section>
          )}

          {profile.hardest.length > 0 && (
            <Section title={t('Concetti che sbagli più spesso')}>
              {profile.hardest.map((h) => (
                <Row
                  key={h.conceptId}
                  label={t(h.title)}
                  value={t('{misses} volte', { misses: h.misses })}
                />
              ))}
            </Section>
          )}

          {profile.dayParts.length > 1 && (
            <Section title={t('Quando rendi meglio')}>
              {profile.dayParts.map((d) => (
                <Row
                  key={d.part}
                  label={t(dayPartLabel[d.part])}
                  value={`${percent(d.understood)} · ${d.attempts}`}
                />
              ))}
            </Section>
          )}
        </>
      )}

      {profile.focus.sessions > 0 && (
        <Section title={t('Concentrazione')}>
          <Row label={t('Sessioni misurate')} value={String(profile.focus.sessions)} />
          {profile.focus.score !== null && (
            <Row label={t('Attenzione media')} value={percent(profile.focus.score)} />
          )}
          <Row
            label={t('Ultime sessioni')}
            value={profile.focus.recentScores.map((s) => Math.round(s * 100)).join(' · ')}
          />
          {profile.focus.phoneSessions > 0 && (
            <Row
              label={t('Sessioni con il telefono in vista')}
              value={String(profile.focus.phoneSessions)}
            />
          )}
        </Section>
      )}

      {profile.topLookups.length > 0 && (
        <Section title={t('Termini che cerchi più spesso')}>
          <p className="text-sm">
            {profile.topLookups.map((l) => `${l.term} (${l.count})`).join(' · ')}
          </p>
        </Section>
      )}

      <Section title={t('Note inviate con le spiegazioni dell’IA')}>
        {hints.length === 0 ? (
          <p className="text-sm text-[var(--fg-quiet)]">
            {t('Nessuna: servono almeno 20 risposte con uno schema chiaro.')}
          </p>
        ) : (
          <ul className="flex list-disc flex-col gap-1 pl-5 text-sm">
            {hints.map((h) => (
              <li key={h}>{h}</li>
            ))}
          </ul>
        )}
      </Section>

      <div className="flex flex-wrap items-center gap-2 border-t border-[var(--rule)] pt-6">
        {armed ? (
          <>
            <QuietButton
              className="text-[var(--fg)] underline"
              onClick={async () => {
                await clearLearningHistory()
                setArmed(false)
                setProfile(buildProfile([], [], [], course))
              }}
            >
              {t('Conferma: dimentica la cronologia (progressi e libri restano)')}
            </QuietButton>
            <QuietButton onClick={() => setArmed(false)}>{t('Annulla')}</QuietButton>
          </>
        ) : (
          <QuietButton onClick={() => setArmed(true)}>{t('Dimentica tutto questo')}</QuietButton>
        )}
      </div>
    </Page>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-2 border-t border-[var(--rule)] pt-6">
      <h2 className="text-lg font-medium">{title}</h2>
      <div className="flex flex-col">{children}</div>
    </section>
  )
}

function Row({ label, value, href }: { label: string; value: string; href?: string }) {
  return (
    <div className="flex min-h-11 items-center justify-between gap-4 text-sm">
      <span>
        {href ? (
          <a href={href} className="underline-offset-4 hover:underline">
            {label}
          </a>
        ) : (
          label
        )}
      </span>
      <span className="tabular-nums text-[var(--fg-quiet)]">{value}</span>
    </div>
  )
}
