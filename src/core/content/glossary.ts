/**
 * Italian ↔ English aviation glossary used by the reader's double-click lookup.
 * Short, plain definitions written for Vector: verify them against your course material.
 */

export interface GlossaryEntry {
  it: string
  en: string
  /** Common abbreviation, if any. */
  abbr?: string
  def: string
}

export const glossary: readonly GlossaryEntry[] = [
  {
    it: "angolo d'attacco",
    en: 'angle of attack',
    abbr: 'AoA',
    def: 'Angolo tra la corda alare e il vento relativo.',
  },
  {
    it: "angolo d'attacco critico",
    en: 'critical angle of attack',
    def: 'Angolo d’attacco oltre il quale il flusso si separa dal dorso e la portanza diminuisce: lo stallo.',
  },
  {
    it: 'corda alare',
    en: 'chord line',
    def: 'Retta che unisce il bordo d’attacco e il bordo d’uscita del profilo alare.',
  },
  {
    it: 'vento relativo',
    en: 'relative airflow',
    def: 'Flusso d’aria indisturbato rispetto all’aereo, parallelo e opposto alla traiettoria.',
  },
  {
    it: 'portanza',
    en: 'lift',
    def: 'Componente della forza aerodinamica perpendicolare al vento relativo.',
  },
  {
    it: 'resistenza',
    en: 'drag',
    def: 'Componente della forza aerodinamica parallela al vento relativo, opposta al moto.',
  },
  {
    it: 'resistenza indotta',
    en: 'induced drag',
    def: 'Resistenza legata alla produzione di portanza, dovuta ai vortici d’estremità: cresce alle basse velocità.',
  },
  {
    it: 'resistenza parassita',
    en: 'parasite drag',
    def: 'Resistenza non legata alla portanza (forma, attrito, interferenza): cresce con la velocità.',
  },
  {
    it: 'stallo',
    en: 'stall',
    def: 'Perdita di portanza quando l’ala supera l’angolo d’attacco critico, a qualsiasi velocità.',
  },
  {
    it: 'fattore di carico',
    en: 'load factor',
    def: 'Rapporto tra portanza e peso, espresso in g. In virata livellata vale 1 / cos(inclinazione).',
  },
  {
    it: 'assetto',
    en: 'attitude',
    def: 'Orientamento dell’aereo rispetto all’orizzonte (beccheggio e rollio).',
  },
  { it: 'beccheggio', en: 'pitch', def: 'Rotazione attorno all’asse trasversale.' },
  { it: 'rollio', en: 'roll', def: 'Rotazione attorno all’asse longitudinale.' },
  { it: 'imbardata', en: 'yaw', def: 'Rotazione attorno all’asse verticale.' },
  {
    it: 'alettoni',
    en: 'ailerons',
    def: 'Superfici mobili alle estremità alari che comandano il rollio.',
  },
  {
    it: 'equilibratore',
    en: 'elevator',
    def: 'Superficie mobile dello stabilizzatore orizzontale che comanda il beccheggio.',
  },
  {
    it: 'timone di direzione',
    en: 'rudder',
    def: 'Superficie mobile della deriva che comanda l’imbardata.',
  },
  {
    it: 'ipersostentatori',
    en: 'flaps',
    def: 'Superfici sul bordo d’uscita che aumentano portanza e resistenza e riducono la velocità di stallo.',
  },
  {
    it: 'compensatore',
    en: 'trim tab',
    def: 'Piccola superficie mobile che annulla lo sforzo sui comandi.',
  },
  {
    it: 'baricentro',
    en: 'centre of gravity',
    abbr: 'CG',
    def: 'Punto in cui si considera applicato il peso dell’aereo; deve restare entro i limiti del manuale.',
  },
  { it: 'quota', en: 'altitude', def: 'Distanza verticale dal livello medio del mare (AMSL).' },
  {
    it: 'altezza',
    en: 'height',
    def: 'Distanza verticale da un riferimento specifico, di solito il suolo (AGL).',
  },
  {
    it: 'quota pressione',
    en: 'pressure altitude',
    def: 'Quota indicata dall’altimetro regolato su 1013,25 hPa.',
  },
  {
    it: 'quota densità',
    en: 'density altitude',
    def: 'Quota in atmosfera standard con la stessa densità dell’aria reale: più è alta, peggiori le prestazioni.',
  },
  {
    it: 'livello di volo',
    en: 'flight level',
    abbr: 'FL',
    def: 'Superficie di pressione costante riferita a 1013,25 hPa, espressa in centinaia di piedi.',
  },
  {
    it: 'atmosfera standard',
    en: 'International Standard Atmosphere',
    abbr: 'ISA',
    def: '15 °C e 1013,25 hPa al livello del mare; −1,98 °C ogni 1000 ft nella troposfera.',
  },
  {
    it: 'velocità indicata',
    en: 'indicated airspeed',
    abbr: 'IAS',
    def: 'Velocità letta sull’anemometro.',
  },
  {
    it: 'velocità calibrata',
    en: 'calibrated airspeed',
    abbr: 'CAS',
    def: 'IAS corretta per gli errori di strumento e di posizione.',
  },
  {
    it: 'velocità vera',
    en: 'true airspeed',
    abbr: 'TAS',
    def: 'Velocità rispetto alla massa d’aria: a parità di CAS cresce con la quota.',
  },
  {
    it: 'velocità al suolo',
    en: 'ground speed',
    abbr: 'GS',
    def: 'Velocità rispetto al suolo: la TAS corretta per il vento.',
  },
  {
    it: 'rotta',
    en: 'track',
    def: 'Direzione della traiettoria rispetto al suolo, vera o magnetica.',
  },
  { it: 'prua', en: 'heading', def: 'Direzione in cui punta l’asse longitudinale dell’aereo.' },
  {
    it: 'angolo di correzione del vento',
    en: 'wind correction angle',
    abbr: 'WCA',
    def: 'Differenza tra prua e rotta necessaria a compensare il vento al traverso.',
  },
  {
    it: 'declinazione magnetica',
    en: 'magnetic variation',
    def: 'Angolo tra nord vero e nord magnetico in un dato luogo.',
  },
  {
    it: 'deviazione',
    en: 'deviation',
    def: 'Errore della bussola dovuto ai campi magnetici dell’aereo stesso.',
  },
  { it: 'miglio nautico', en: 'nautical mile', abbr: 'NM', def: '1852 metri.' },
  { it: 'nodo', en: 'knot', abbr: 'kt', def: 'Un miglio nautico all’ora.' },
  {
    it: 'pista',
    en: 'runway',
    abbr: 'RWY',
    def: 'Area rettangolare dell’aerodromo per decollo e atterraggio; il numero è la direzione magnetica in decine di gradi.',
  },
  {
    it: 'via di rullaggio',
    en: 'taxiway',
    abbr: 'TWY',
    def: 'Percorso definito per il movimento a terra degli aeromobili.',
  },
  {
    it: 'fronte freddo',
    en: 'cold front',
    def: 'Aria fredda che sostituisce aria più calda: spesso nubi cumuliformi, rovesci e temporali.',
  },
  {
    it: 'fronte caldo',
    en: 'warm front',
    def: 'Aria calda che scorre sopra aria più fredda: nubi stratiformi estese e precipitazioni continue.',
  },
  {
    it: 'nebbia',
    en: 'fog',
    abbr: 'FG',
    def: 'Goccioline sospese che riducono la visibilità sotto i 1000 m.',
  },
  {
    it: 'foschia',
    en: 'mist',
    abbr: 'BR',
    def: 'Goccioline sospese con visibilità ridotta ma di almeno 1000 m.',
  },
  {
    it: 'punto di rugiada',
    en: 'dew point',
    def: 'Temperatura a cui l’aria, raffreddandosi a pressione costante, diventa satura.',
  },
  {
    it: 'umidità relativa',
    en: 'relative humidity',
    def: 'Rapporto tra il vapore acqueo presente e quello massimo possibile a quella temperatura.',
  },
  {
    it: 'inversione termica',
    en: 'temperature inversion',
    def: 'Strato in cui la temperatura aumenta con la quota invece di diminuire.',
  },
  {
    it: 'ghiaccio al carburatore',
    en: 'carburettor icing',
    def: 'Ghiaccio nel carburatore per raffreddamento da espansione ed evaporazione: possibile anche sopra 0 °C con umidità alta.',
  },
  {
    it: 'ipossia',
    en: 'hypoxia',
    def: 'Carenza di ossigeno nei tessuti: insidiosa perché altera il giudizio prima di dare sintomi evidenti.',
  },
  {
    it: 'disorientamento spaziale',
    en: 'spatial disorientation',
    def: 'Percezione errata di assetto e movimento, tipica senza riferimenti visivi esterni.',
  },
  {
    it: 'regole del volo a vista',
    en: 'visual flight rules',
    abbr: 'VFR',
    def: 'Regole per il volo condotto con riferimenti visivi esterni, in condizioni meteorologiche minime definite.',
  },
  {
    it: 'regole del volo strumentale',
    en: 'instrument flight rules',
    abbr: 'IFR',
    def: 'Regole per il volo condotto con riferimento agli strumenti.',
  },
  {
    it: 'zona di traffico di aerodromo',
    en: 'aerodrome traffic zone',
    abbr: 'ATZ',
    def: 'Spazio aereo attorno a un aerodromo per la protezione del traffico d’aerodromo.',
  },
  {
    it: 'zona di controllo',
    en: 'control zone',
    abbr: 'CTR',
    def: 'Spazio aereo controllato che si estende dal suolo a un limite superiore, attorno a uno o più aerodromi.',
  },
  {
    it: 'area terminale di controllo',
    en: 'terminal control area',
    abbr: 'TMA',
    def: 'Spazio aereo controllato sopra una o più CTR, alla confluenza delle rotte.',
  },
  {
    it: 'QNH',
    en: 'QNH',
    abbr: 'QNH',
    def: 'Regolaggio con cui l’altimetro, al suolo, indica l’elevazione dell’aerodromo (quota AMSL).',
  },
  {
    it: 'QFE',
    en: 'QFE',
    abbr: 'QFE',
    def: 'Regolaggio con cui l’altimetro, al suolo, indica zero: si legge l’altezza sopra l’aerodromo.',
  },
  {
    it: 'bollettino meteorologico di aerodromo',
    en: 'aerodrome routine meteorological report',
    abbr: 'METAR',
    def: 'Osservazione meteorologica di routine di un aerodromo.',
  },
  {
    it: 'previsione di aerodromo',
    en: 'terminal aerodrome forecast',
    abbr: 'TAF',
    def: 'Previsione meteorologica per un aerodromo in un periodo definito.',
  },
  {
    it: 'avviso ai naviganti',
    en: 'notice to airmen',
    abbr: 'NOTAM',
    def: 'Avviso su variazioni di strutture, servizi, procedure o pericoli per il volo.',
  },
  {
    it: 'informazione meteorologica significativa',
    en: 'significant meteorological information',
    abbr: 'SIGMET',
    def: 'Avviso di fenomeni meteorologici in rotta pericolosi per gli aeromobili.',
  },
  {
    it: 'servizio automatico di informazioni terminali',
    en: 'automatic terminal information service',
    abbr: 'ATIS',
    def: 'Trasmissione continua e registrata delle informazioni correnti di un aerodromo.',
  },
  {
    it: 'corsa di decollo disponibile',
    en: 'take-off run available',
    abbr: 'TORA',
    def: 'Lunghezza di pista disponibile per la corsa di decollo.',
  },
  {
    it: 'distanza di decollo disponibile',
    en: 'take-off distance available',
    abbr: 'TODA',
    def: 'TORA più l’eventuale clearway.',
  },
  {
    it: 'distanza di accelerazione-arresto disponibile',
    en: 'accelerate-stop distance available',
    abbr: 'ASDA',
    def: 'TORA più l’eventuale stopway.',
  },
  {
    it: 'distanza di atterraggio disponibile',
    en: 'landing distance available',
    abbr: 'LDA',
    def: 'Lunghezza di pista disponibile per la corsa di atterraggio.',
  },
  {
    it: 'velocità da non superare mai',
    en: 'never exceed speed',
    abbr: 'VNE',
    def: 'Velocità massima che non deve essere superata in nessuna condizione.',
  },
  {
    it: 'velocità massima strutturale di crociera',
    en: 'maximum structural cruising speed',
    abbr: 'VNO',
    def: 'Oltre questa velocità si vola solo in aria calma (arco giallo).',
  },
  {
    it: 'velocità massima con flap estesi',
    en: 'maximum flap extended speed',
    abbr: 'VFE',
    def: 'Velocità massima con i flap estesi (estremo superiore dell’arco bianco).',
  },
  {
    it: 'velocità di salita ripida',
    en: 'best angle of climb speed',
    abbr: 'VX',
    def: 'Velocità del massimo guadagno di quota per distanza percorsa: superare ostacoli.',
  },
  {
    it: 'velocità di salita rapida',
    en: 'best rate of climb speed',
    abbr: 'VY',
    def: 'Velocità del massimo guadagno di quota nel tempo.',
  },
  {
    it: 'velocità di manovra',
    en: 'design manoeuvring speed',
    abbr: 'VA',
    def: 'Velocità sotto la quale un comando a fondo corsa porta allo stallo prima di superare il carico limite.',
  },
  {
    it: 'sopra il livello del suolo',
    en: 'above ground level',
    abbr: 'AGL',
    def: 'Altezza misurata dal suolo.',
  },
  {
    it: 'sopra il livello medio del mare',
    en: 'above mean sea level',
    abbr: 'AMSL',
    def: 'Quota misurata dal livello medio del mare.',
  },
  {
    it: 'trasmettitore di localizzazione di emergenza',
    en: 'emergency locator transmitter',
    abbr: 'ELT',
    def: 'Trasmettitore che si attiva dopo un incidente per facilitare la ricerca.',
  },
  {
    it: 'massa massima al decollo',
    en: 'maximum take-off mass',
    abbr: 'MTOM',
    def: 'Massa massima certificata con cui l’aereo può decollare.',
  },
  {
    it: 'manuale di volo',
    en: 'aircraft flight manual',
    abbr: 'AFM',
    def: 'Manuale approvato con limitazioni, procedure e prestazioni dell’aereo (POH per molti aerei leggeri).',
  },
  {
    it: 'pubblicazione di informazioni aeronautiche',
    en: 'aeronautical information publication',
    abbr: 'AIP',
    def: 'Pubblicazione ufficiale di uno Stato con regole, procedure e informazioni per la navigazione aerea.',
  },
  {
    it: 'regole dell’aria standardizzate europee',
    en: 'standardised European rules of the air',
    abbr: 'SERA',
    def: 'Regolamento (UE) 923/2012 con le regole dell’aria comuni in Europa.',
  },
]

const norm = (s: string) =>
  s
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/[’`]/g, "'")
    .replace(/[^\p{L}\p{N}' ]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()

/** Exact matches first (term or abbreviation), then entries containing the word. */
export function lookup(term: string, limit = 5): GlossaryEntry[] {
  const q = norm(term)
  if (!q) return []
  const exact = glossary.filter(
    (e) => norm(e.it) === q || norm(e.en) === q || (e.abbr && norm(e.abbr) === q),
  )
  if (q.length < 3) return exact.slice(0, limit)
  const words = (s: string) => norm(s).split(' ')
  const partial = glossary.filter(
    (e) => !exact.includes(e) && (words(e.it).includes(q) || words(e.en).includes(q)),
  )
  return [...exact, ...partial].slice(0, limit)
}
