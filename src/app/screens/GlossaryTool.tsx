import { useEffect, useId, useState } from 'react'
import { type Card, type CardState, pickCards, review } from '../../core/cards'
import { glossary, lookup } from '../../core/content/glossary'
import { loadCards, loadLookups, saveCard } from '../data/db'
import { t } from '../i18n'
import { PrimaryButton, QuietButton } from '../ui'

/** The IT/EN glossary: search, and flashcards that start from the terms you look up most. */
export function GlossaryTool() {
  const [query, setQuery] = useState('')
  const [mode, setMode] = useState<'search' | 'cards'>('cards')
  const id = useId()
  const results = query.trim() ? lookup(query, 10) : []

  return (
    <div className="flex flex-col gap-6">
      <div className="flex gap-1" role="tablist" aria-label={t('Glossario')}>
        {(['cards', 'search'] as const).map((m) => (
          <button
            key={m}
            type="button"
            role="tab"
            aria-selected={mode === m}
            onClick={() => setMode(m)}
            className={`min-h-11 rounded-lg px-3 text-sm ${mode === m ? 'border border-[var(--fg)]' : 'text-[var(--fg-quiet)]'}`}
          >
            {m === 'cards' ? t('Schede') : t('Cerca')}
          </button>
        ))}
      </div>
      {mode === 'search' ? (
        <div className="flex flex-col gap-4">
          <label htmlFor={id} className="text-sm">
            {t('Termine in italiano o in inglese')}
          </label>
          <input
            id={id}
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="min-h-11 w-full rounded-lg border border-[var(--rule)] bg-[var(--bg)] px-3"
          />
          <dl className="flex flex-col gap-3">
            {results.map((e) => (
              <div key={e.en} className="border-t border-[var(--rule)] pt-3">
                <dt>
                  <span lang="it">{e.it}</span> · <span lang="en">{e.en}</span>
                  {e.abbr ? ` · ${e.abbr}` : ''}
                </dt>
                <dd className="text-sm text-[var(--fg-quiet)]">{e.def}</dd>
              </div>
            ))}
          </dl>
          <p className="text-xs text-[var(--fg-quiet)]">
            {glossary.length} {t('termini.')}
          </p>
        </div>
      ) : (
        <Cards />
      )}
    </div>
  )
}

function Cards() {
  const [deck, setDeck] = useState<Card[] | null>(null)
  const [states, setStates] = useState<Map<string, CardState>>(new Map())
  const [index, setIndex] = useState(0)
  const [flipped, setFlipped] = useState(false)
  const [knew, setKnew] = useState(0)

  const start = async () => {
    const [s, l] = await Promise.all([loadCards(), loadLookups()])
    setStates(s)
    setDeck(
      pickCards(
        glossary,
        s,
        new Map(l.map((x) => [x.term.toLowerCase(), x.count])),
        new Date(),
        12,
        () => Math.random() < 0.5,
      ),
    )
    setIndex(0)
    setKnew(0)
    setFlipped(false)
  }
  // biome-ignore lint/correctness/useExhaustiveDependencies: deal the first deck once
  useEffect(() => {
    void start()
  }, [])

  if (!deck) return null
  const card = deck[index]
  if (!card) {
    return (
      <div className="flex flex-col items-start gap-4" aria-live="polite">
        <p>
          {deck.length === 0
            ? t('Nessuna scheda da ripassare oggi.')
            : t('Fatto: {knew} su {length} sapute.', { knew, length: deck.length })}
        </p>
        <QuietButton onClick={start}>{t('Ricomincia')}</QuietButton>
      </div>
    )
  }

  const answer = (k: boolean) => {
    const s = review(states.get(card.entry.en), card.entry.en, k, new Date())
    void saveCard(s)
    setStates((m) => new Map(m).set(s.term, s))
    if (k) setKnew((n) => n + 1)
    setIndex((i) => i + 1)
    setFlipped(false)
  }

  return (
    <div className="flex flex-col gap-6">
      <p className="text-xs text-[var(--fg-quiet)]">
        {t('Scheda')} {index + 1} {t('di')} {deck.length} ·{' '}
        {card.direction === 'it-en' ? t('italiano → inglese') : t('inglese → italiano')}
      </p>
      <p lang={card.direction === 'it-en' ? 'it' : 'en'} className="text-3xl">
        {card.front}
      </p>
      {flipped ? (
        <div className="flex flex-col gap-4">
          <p lang={card.direction === 'it-en' ? 'en' : 'it'} className="text-2xl">
            {card.back}
            {card.entry.abbr ? ` (${card.entry.abbr})` : ''}
          </p>
          <p className="text-sm text-[var(--fg-quiet)]">{card.entry.def}</p>
          <div className="flex flex-wrap gap-2">
            <PrimaryButton onClick={() => answer(true)}>{t('Lo sapevo')}</PrimaryButton>
            <QuietButton onClick={() => answer(false)}>{t('Non lo sapevo')}</QuietButton>
          </div>
        </div>
      ) : (
        <PrimaryButton className="self-start" onClick={() => setFlipped(true)}>
          {t('Gira la scheda')}
        </PrimaryButton>
      )}
    </div>
  )
}
