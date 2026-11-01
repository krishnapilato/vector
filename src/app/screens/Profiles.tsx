import { useEffect, useId, useState } from 'react'
import type { CourseSettings } from '../../core/content/course'
import { pplCourseSettings } from '../../core/content/course'
import { VectorDb } from '../data/db'
import {
  activeDatabase,
  createProfile,
  DEFAULT_DATABASE,
  deleteProfile,
  listProfiles,
  type Profile,
  renameProfile,
  switchTo,
} from '../data/profiles'
import { type Language, languageLabel, t } from '../i18n'
import { Page, PrimaryButton, QuietButton } from '../ui'

const inputClass =
  'min-h-11 w-full rounded-lg border border-[var(--rule)] bg-[var(--bg)] px-3 text-[var(--fg)]'

/** Several people on one device, each starting from zero with their own exam and language. */
export function Profiles() {
  const [profiles, setProfiles] = useState<Profile[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const refresh = () => void listProfiles().then(setProfiles)
  useEffect(refresh, [])
  const active = activeDatabase()

  return (
    <Page title={t('Profili')}>
      <p className="text-[var(--fg-quiet)]">
        {t(
          'Ogni profilo ha i suoi progressi, libri, impostazioni, esame e lingua, e parte da zero. Restano tutti su questo dispositivo.',
        )}
      </p>
      <ul className="flex flex-col">
        {profiles?.map((p) => (
          <ProfileRow
            key={p.id}
            profile={p}
            active={p.database === active}
            onChange={refresh}
            onError={setError}
          />
        ))}
      </ul>
      {error && <p role="alert">{error}</p>}
      <NewProfile onError={setError} />
    </Page>
  )
}

function ProfileRow({
  profile,
  active,
  onChange,
  onError,
}: {
  profile: Profile
  active: boolean
  onChange: () => void
  onError: (e: string) => void
}) {
  const [name, setName] = useState(profile.name)
  const [armed, setArmed] = useState(false)
  const id = useId()
  return (
    <li className="flex flex-col gap-3 border-t border-[var(--rule)] py-4">
      <div className="flex flex-wrap items-end gap-2">
        <div className="flex flex-1 flex-col gap-1">
          <label htmlFor={id} className="text-sm">
            {active ? t('Nome (profilo in uso)') : t('Nome')}
          </label>
          <input
            id={id}
            value={name}
            onChange={(e) => setName(e.target.value)}
            onBlur={() => {
              if (name.trim() && name.trim() !== profile.name)
                void renameProfile(profile.id, name).then(onChange)
            }}
            className={inputClass}
          />
        </div>
        {!active && (
          <PrimaryButton
            onClick={() => {
              if (!switchTo(profile))
                onError(t('Il browser non permette di ricordare il profilo scelto.'))
            }}
          >
            {t('Usa questo profilo')}
          </PrimaryButton>
        )}
      </div>
      {!active && profile.database !== DEFAULT_DATABASE && (
        <div className="flex flex-wrap gap-1">
          {armed ? (
            <>
              <QuietButton
                className="text-[var(--fg)] underline"
                onClick={async () => {
                  await deleteProfile(profile)
                  onChange()
                }}
              >
                {t('Conferma: elimina il profilo e tutti i suoi dati')}
              </QuietButton>
              <QuietButton onClick={() => setArmed(false)}>{t('Annulla')}</QuietButton>
            </>
          ) : (
            <QuietButton onClick={() => setArmed(true)}>{t('Elimina')}</QuietButton>
          )}
        </div>
      )}
    </li>
  )
}

function NewProfile({ onError }: { onError: (e: string) => void }) {
  const [name, setName] = useState('')
  const [language, setLanguage] = useState<Language>('it')
  const [template, setTemplate] = useState<CourseSettings['template']>('ppl-easa')
  const [examName, setExamName] = useState('')
  const ids = { name: useId(), lang: useId(), exam: useId() }

  const create = async () => {
    const profile = await createProfile(name)
    const course: CourseSettings =
      template === 'custom'
        ? { template: 'custom', examName: examName.trim(), subjects: [] }
        : pplCourseSettings
    // The new database starts empty: only its exam and language are written.
    const fresh = new VectorDb(profile.database)
    await fresh.open()
    await fresh.settings.put({
      id: 'settings',
      config: (await import('../../config/config')).defaultConfig,
      study: (await import('../../core/session')).defaultSettings(
        (await import('../../config/config')).defaultConfig,
      ),
      course,
      ui: { language },
    })
    fresh.close()
    if (!switchTo(profile)) onError(t('Il browser non permette di ricordare il profilo scelto.'))
  }

  return (
    <section className="flex flex-col gap-4 border-t border-[var(--rule)] pt-6">
      <h2 className="text-lg font-medium">{t('Nuovo profilo')}</h2>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1">
          <label htmlFor={ids.name} className="text-sm">
            {t('Nome')}
          </label>
          <input
            id={ids.name}
            value={name}
            onChange={(e) => setName(e.target.value)}
            className={inputClass}
          />
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor={ids.lang} className="text-sm">
            {t('Lingua dell’interfaccia')}
          </label>
          <select
            id={ids.lang}
            value={language}
            onChange={(e) => setLanguage(e.target.value as Language)}
            className={inputClass}
          >
            {(Object.keys(languageLabel) as Language[]).map((l) => (
              <option key={l} value={l}>
                {languageLabel[l]}
              </option>
            ))}
          </select>
        </div>
      </div>
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 text-sm">{t('Esame')}</legend>
        <label className="flex min-h-11 items-center gap-3">
          <input
            type="radio"
            name="template"
            className="size-4 accent-current"
            checked={template === 'ppl-easa'}
            onChange={() => setTemplate('ppl-easa')}
          />
          {t('PPL(A) EASA: materie, radio, meteo e strumenti di volo')}
        </label>
        <label className="flex min-h-11 items-center gap-3">
          <input
            type="radio"
            name="template"
            className="size-4 accent-current"
            checked={template === 'custom'}
            onChange={() => setTemplate('custom')}
          />
          {t('Un altro esame: materie tue, domande dai tuoi libri')}
        </label>
      </fieldset>
      {template === 'custom' && (
        <div className="flex flex-col gap-1">
          <label htmlFor={ids.exam} className="text-sm">
            {t('Nome dell’esame')}
          </label>
          <input
            id={ids.exam}
            value={examName}
            placeholder={t('es. Patente nautica, Esame di Stato')}
            onChange={(e) => setExamName(e.target.value)}
            className={inputClass}
          />
        </div>
      )}
      <PrimaryButton
        className="self-start"
        disabled={!name.trim() || (template === 'custom' && !examName.trim())}
        onClick={() => void create()}
      >
        {t('Crea e apri')}
      </PrimaryButton>
    </section>
  )
}
