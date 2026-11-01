/** Free, official study sources the learner can download and import. Links only: nothing is bundled. */

export interface StudySource {
  title: string
  publisher: string
  url: string
  language: 'it' | 'en'
  note: string
}

export const freeSources: readonly StudySource[] = [
  {
    title: 'Easy Access Rules for Aircrew (Part-FCL)',
    publisher: 'EASA',
    url: 'https://www.easa.europa.eu/document-library/easy-access-rules/easy-access-rules-aircrew',
    language: 'en',
    note: 'Regole ufficiali e programma del corso PPL (Subpart C, AMC1 FCL.210). Base del Diritto aeronautico.',
  },
  {
    title: 'SERA — Regole dell’aria europee (Reg. UE 923/2012)',
    publisher: 'EUR-Lex',
    url: 'https://eur-lex.europa.eu/eli/reg_impl/2012/923/oj',
    language: 'it',
    note: 'Testo ufficiale in italiano delle regole dell’aria: VFR, precedenze, segnali.',
  },
  {
    title: 'eAIP Italia',
    publisher: 'ENAV',
    url: 'https://www.enav.it/en/node/118',
    language: 'en',
    note: 'Spazi aerei, aeroporti e procedure italiane. Serve una registrazione gratuita.',
  },
  {
    title: 'Pilot’s Handbook of Aeronautical Knowledge (FAA-H-8083-25C)',
    publisher: 'FAA',
    url: 'https://www.faa.gov/regulations_policies/handbooks_manuals/aviation/phak',
    language: 'en',
    note: 'Pubblico dominio. Ottimo per principi del volo, meteorologia, strumenti, prestazioni e fattori umani. Regole e spazi aerei sono quelli USA: non valgono per l’esame EASA.',
  },
  {
    title: 'Airplane Flying Handbook (FAA-H-8083-3C)',
    publisher: 'FAA',
    url: 'https://www.faa.gov/regulations_policies/handbooks_manuals/aviation/airplane_handbook',
    language: 'en',
    note: 'Pubblico dominio. Tecnica di pilotaggio e procedure operative.',
  },
  {
    title: 'CAP 413 — Radiotelephony Manual',
    publisher: 'UK CAA',
    url: 'https://www.caa.co.uk/cap413',
    language: 'en',
    note: 'Fraseologia radio in inglese, basata su ICAO, con alcune particolarità britanniche.',
  },
]
