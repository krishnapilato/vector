import type React from 'react'
import { useEffect, useState } from 'react'
import {
  buildProfile,
  dayPartLabel,
  type Profile as ProfileData,
  profileHints,
} from '../../core/profile'
import { clearLearningHistory, loadAttempts, loadFocusRecords, loadLookups } from '../data/db'
import { hrefFor } from '../router'
import { useStore } from '../state'
import { Page, percent, QuietButton } from '../ui'

const kindLabel = {
  recall: 'Richiamo',
  reasoning: 'Ragionamento',
  calculation: 'Calcolo',
  open: 'Domande aperte',
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
    <Page title="Cosa so di te">
      <p className="text-[var(--fg-quiet)]">
        Tutto quello che Vector ha capito di come studi, calcolato su questo dispositivo dalle tue
        risposte. Niente esce da qui, tranne le note in fondo se chiedi una spiegazione all’IA
        {prefs.study.personalize ? '' : ' (disattivate nelle impostazioni)'}.
      </p>

      {profile.attempts === 0 ? (
        <p>Ancora niente: rispondi a qualche domanda e torna qui.</p>
      ) : (
        <>
          <Section title="Risposte">
            <Row label="Risposte date" value={String(profile.attempts)} />
            <Row label="Concetti capiti davvero" value={percent(profile.understood)} />
            <Row
              label="Domande riconosciute invece che ragionate"
              value={percent(profile.recognized)}
            />
            <Row label="Giuste per caso o con il perché sbagliato" value={percent(profile.lucky)} />
            <Row
              label="Tempo tipico per risposta"
              value={`${Math.round(profile.medianSeconds)} s`}
            />
          </Section>

          {profile.subjects.length > 0 && (
            <Section title="Materie, dalla più difficile">
              {profile.subjects.map((s) => (
                <Row
                  key={s.subjectId}
                  label={s.name}
                  value={`${percent(s.understood)} · ${s.attempts} risposte`}
                  href={hrefFor({ name: 'subjects', subjectId: s.subjectId })}
                />
              ))}
            </Section>
          )}

          {profile.kinds.length > 1 && (
            <Section title="Tipi di domanda">
              {profile.kinds.map((k) => (
                <Row
                  key={k.kind}
                  label={kindLabel[k.kind]}
                  value={`${percent(k.understood)} · ${k.attempts}`}
                />
              ))}
            </Section>
          )}

          {profile.hardest.length > 0 && (
            <Section title="Concetti che sbagli più spesso">
              {profile.hardest.map((h) => (
                <Row key={h.conceptId} label={h.title} value={`${h.misses} volte`} />
              ))}
            </Section>
          )}

          {profile.dayParts.length > 1 && (
            <Section title="Quando rendi meglio">
              {profile.dayParts.map((d) => (
                <Row
                  key={d.part}
                  label={dayPartLabel[d.part]}
                  value={`${percent(d.understood)} · ${d.attempts}`}
                />
              ))}
            </Section>
          )}
        </>
      )}

      {profile.focus.sessions > 0 && (
        <Section title="Concentrazione">
          <Row label="Sessioni misurate" value={String(profile.focus.sessions)} />
          {profile.focus.score !== null && (
            <Row label="Attenzione media" value={percent(profile.focus.score)} />
          )}
          <Row
            label="Ultime sessioni"
            value={profile.focus.recentScores.map((s) => Math.round(s * 100)).join(' · ')}
          />
          {profile.focus.phoneSessions > 0 && (
            <Row
              label="Sessioni con il telefono in vista"
              value={String(profile.focus.phoneSessions)}
            />
          )}
        </Section>
      )}

      {profile.topLookups.length > 0 && (
        <Section title="Termini che cerchi più spesso">
          <p className="text-sm">
            {profile.topLookups.map((l) => `${l.term} (${l.count})`).join(' · ')}
          </p>
        </Section>
      )}

      <Section title="Note inviate con le spiegazioni dell’IA">
        {hints.length === 0 ? (
          <p className="text-sm text-[var(--fg-quiet)]">
            Nessuna: servono almeno 20 risposte con uno schema chiaro.
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
              Conferma: dimentica la cronologia (progressi e libri restano)
            </QuietButton>
            <QuietButton onClick={() => setArmed(false)}>Annulla</QuietButton>
          </>
        ) : (
          <QuietButton onClick={() => setArmed(true)}>Dimentica tutto questo</QuietButton>
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
