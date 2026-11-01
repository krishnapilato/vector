import { msg } from '../i18n'
import { pick, randomInt } from '../random'
import type { Course } from './types'

const it = new Intl.NumberFormat('it-IT', { maximumFractionDigits: 2 })
const n = (v: number) => it.format(v)

/** Distinct values only: generated distractors must never collide with the answer. */
function distinct(answer: string, candidates: string[]): string[] {
  return [...new Set(candidates)].filter((c) => c !== answer)
}

/**
 * A small hand-written sample course so the app works before any material is imported.
 * Every statement here was written for Vector and must be checked against the course material.
 */
export const pplSample: Course = {
  id: 'ppl-sample',
  name: 'PPL(A) — corso di esempio',
  sourceNote: msg(
    'Contenuti di esempio scritti a mano per provare Vector: verificali sempre con il materiale del tuo corso.',
  ),
  subjects: [
    { id: 'pof', name: 'Principi del volo' },
    { id: 'met', name: 'Meteorologia' },
    { id: 'fpp', name: 'Prestazioni e pianificazione' },
  ],
  concepts: [
    {
      id: 'angolo-di-attacco',
      subjectId: 'pof',
      title: "Angolo d'attacco",
      source:
        "L'angolo d'attacco è l'angolo tra la corda alare e la direzione del vento relativo, cioè del flusso d'aria indisturbato che investe l'ala. Il vento relativo è parallelo e opposto alla traiettoria: per questo l'angolo d'attacco non coincide con l'assetto, che si misura rispetto all'orizzonte.",
      variants: [
        {
          id: 'definizione',
          kind: 'recall',
          prompt: "Che cos'è l'angolo d'attacco?",
          answer: "L'angolo tra la corda alare e il vento relativo",
          distractors: [
            "L'angolo tra la corda alare e l'asse longitudinale dell'aereo",
            "L'angolo tra l'asse longitudinale e l'orizzonte",
            "L'angolo tra la traiettoria e l'orizzonte",
            "L'angolo tra il vento relativo e l'orizzonte",
          ],
          explanation:
            "Si misura tra la corda alare e il vento relativo. L'angolo rispetto all'orizzonte è l'assetto; quello tra corda e asse longitudinale è il calettamento.",
        },
        {
          id: 'nome',
          kind: 'recall',
          prompt: "Come si chiama l'angolo tra la corda alare e il vento relativo?",
          answer: "Angolo d'attacco",
          distractors: ['Assetto', 'Angolo di calettamento', 'Angolo di rampa', 'Angolo di diedro'],
          explanation:
            "È l'angolo d'attacco. L'assetto si riferisce all'orizzonte, il calettamento all'asse longitudinale, la rampa alla traiettoria.",
        },
        {
          id: 'salita',
          kind: 'reasoning',
          prompt:
            "In salita costante il muso è 10° sopra l'orizzonte e la traiettoria sale di 6°. Trascurando il calettamento, l'angolo d'attacco è circa:",
          answer: '4°',
          distractors: ['10°', '16°', '6°', '0°'],
          explanation:
            "Il vento relativo arriva lungo la traiettoria (6°). L'ala è inclinata di 10° rispetto all'orizzonte, quindi di 10° − 6° = 4° rispetto al vento relativo.",
        },
      ],
      why: {
        correct:
          "Perché si misura rispetto al flusso d'aria, che segue la traiettoria, e non rispetto all'orizzonte.",
        wrong: [
          "Perché l'angolo d'attacco coincide sempre con l'assetto.",
          "Perché si misura rispetto all'asse longitudinale dell'aereo.",
          'Perché dipende solo dalla velocità indicata.',
        ],
      },
    },
    {
      id: 'stallo-angolo-critico',
      subjectId: 'pof',
      title: 'Lo stallo dipende dall’angolo critico',
      source:
        "Un'ala va in stallo quando supera l'angolo d'attacco critico: il flusso si separa dal dorso e la portanza crolla. Succede a qualsiasi velocità, assetto o peso. La velocità di stallo del manuale vale solo nelle condizioni indicate (volo livellato, 1 g, peso e configurazione specificati).",
      variants: [
        {
          id: 'quando',
          kind: 'recall',
          prompt: "Un'ala va in stallo quando:",
          answer: "Supera l'angolo d'attacco critico",
          distractors: [
            'La velocità scende sotto quella di stallo del manuale, in qualsiasi condizione',
            "L'assetto supera i 15° a cabrare",
            'Il motore perde potenza',
            'Si estendono i flap',
          ],
          explanation:
            "Lo stallo è un fatto aerodinamico: dipende dall'angolo d'attacco. La velocità di stallo è solo la velocità a cui, in certe condizioni, si raggiunge quell'angolo.",
        },
        {
          id: 'alta-velocita',
          kind: 'reasoning',
          prompt: "In una richiamata energica ad alta velocità, l'ala può andare in stallo?",
          answer: "Sì, se si supera l'angolo d'attacco critico",
          distractors: [
            'No, sopra la velocità di stallo è impossibile',
            'Solo con i flap estesi',
            'Solo con il motore al minimo',
            'Solo se il peso supera il massimo al decollo',
          ],
          explanation:
            "Una richiamata brusca aumenta l'angolo d'attacco e il fattore di carico: se si supera l'angolo critico l'ala stalla anche ad alta velocità (stallo accelerato).",
        },
        {
          id: 'grandezza',
          kind: 'recall',
          prompt: 'Quale grandezza determina direttamente lo stallo?',
          answer: "L'angolo d'attacco",
          distractors: [
            'La velocità indicata',
            "L'assetto",
            "L'altitudine",
            'La potenza del motore',
          ],
          explanation:
            "L'angolo d'attacco. Velocità, peso e fattore di carico cambiano solo la velocità a cui ci si arriva.",
        },
      ],
      why: {
        correct:
          "Perché la portanza crolla quando il flusso si separa dal dorso, e questo dipende dall'angolo d'attacco.",
        wrong: [
          'Perché la velocità di stallo è un limite fisso in ogni condizione.',
          "Perché lo stallo dipende dall'assetto rispetto all'orizzonte.",
          'Perché lo stallo si verifica quando il motore non dà spinta.',
        ],
      },
    },
    {
      id: 'stallo-in-virata',
      subjectId: 'pof',
      title: 'Velocità di stallo in virata',
      source:
        'In virata coordinata livellata il fattore di carico è n = 1 / cos(inclinazione): a 60° vale 2. La velocità di stallo cresce con la radice quadrata del fattore di carico: a 60° è circa il 41% più alta che in volo rettilineo.',
      variants: [
        {
          id: 'fattore-60',
          kind: 'recall',
          prompt: 'In virata livellata a 60° di inclinazione il fattore di carico è:',
          answer: '2 g',
          distractors: ['1,41 g', '1,5 g', '3 g', '1 g'],
          explanation: 'n = 1 / cos 60° = 1 / 0,5 = 2.',
        },
        {
          id: 'direzione',
          kind: 'reasoning',
          prompt: 'In virata livellata, rispetto al volo rettilineo, la velocità di stallo:',
          answer: 'Aumenta',
          distractors: ['Diminuisce', 'Resta uguale', 'Dipende solo dalla potenza', 'Si annulla'],
          explanation:
            "Per mantenere la quota serve più portanza (fattore di carico maggiore): l'ala arriva all'angolo critico a una velocità più alta.",
        },
        {
          id: 'calcolo',
          kind: 'calculation',
          generate: (rng) => {
            const bank = pick(rng, [30, 45, 60])
            const vs = randomInt(rng, 44, 60)
            const loadFactor = 1 / Math.cos((bank * Math.PI) / 180)
            const answer = `${Math.round(vs * Math.sqrt(loadFactor))} kt`
            return {
              prompt: `La velocità di stallo in volo rettilineo è ${vs} kt. In virata livellata a ${bank}° di inclinazione è circa:`,
              answer,
              distractors: distinct(answer, [
                `${Math.round(vs * loadFactor)} kt`,
                `${Math.round(vs / Math.sqrt(loadFactor))} kt`,
                `${vs} kt`,
                `${Math.round(vs * loadFactor * loadFactor)} kt`,
                `${vs + bank} kt`,
              ]),
              explanation: `n = 1 / cos ${bank}° = ${n(loadFactor)}; Vs in virata = ${vs} × √${n(loadFactor)} ≈ ${answer}.`,
            }
          },
        },
      ],
      why: {
        correct:
          "Perché serve più portanza per sostenere il fattore di carico, quindi l'angolo critico si raggiunge a velocità più alta.",
        wrong: [
          "Perché in virata l'aria scorre più velocemente sull'ala esterna.",
          'Perché in virata il motore deve dare più potenza.',
          'Perché in virata il peso dell’aereo diminuisce.',
        ],
      },
    },
    {
      id: 'composizione-aria',
      subjectId: 'met',
      title: "Composizione dell'aria",
      source:
        "L'aria secca è composta per circa il 78% da azoto e il 21% da ossigeno; il restante 1% è formato soprattutto da argon e anidride carbonica. Il vapore acqueo è variabile e si aggiunge a questa miscela.",
      variants: [
        {
          id: 'piu-abbondante',
          kind: 'recall',
          prompt: "Il gas più abbondante nell'atmosfera è:",
          answer: "L'azoto, circa il 78%",
          distractors: [
            "L'ossigeno, circa il 78%",
            "L'ossigeno, circa il 21%",
            'Il vapore acqueo',
            "L'anidride carbonica",
          ],
          explanation: 'Azoto circa 78%, ossigeno circa 21%, altri gas circa 1%.',
        },
        {
          id: 'ossigeno',
          kind: 'recall',
          prompt: "La percentuale di ossigeno nell'aria secca è circa:",
          answer: '21%',
          distractors: ['78%', '1%', '50%', '35%'],
          explanation: "L'ossigeno è circa il 21%; il 78% è azoto.",
        },
      ],
    },
    {
      id: 'atmosfera-standard',
      subjectId: 'met',
      title: 'Atmosfera standard (ISA)',
      source:
        "Nell'atmosfera standard ICAO (ISA), al livello medio del mare la temperatura è 15 °C e la pressione 1013,25 hPa. Nella troposfera la temperatura diminuisce di 1,98 °C ogni 1000 ft, valore spesso approssimato a 2 °C.",
      variants: [
        {
          id: 'temperatura',
          kind: 'recall',
          prompt: 'Temperatura ISA al livello medio del mare:',
          answer: '15 °C',
          distractors: ['0 °C', '20 °C', '12 °C', '25 °C'],
          explanation: 'ISA al livello medio del mare: 15 °C e 1013,25 hPa.',
        },
        {
          id: 'pressione',
          kind: 'recall',
          prompt: 'Pressione ISA al livello medio del mare:',
          answer: '1013,25 hPa',
          distractors: ['1000 hPa', '1030 hPa', '29,92 hPa', '1020 hPa'],
          explanation: '1013,25 hPa, pari a 29,92 inHg (non hPa).',
        },
        {
          id: 'temperatura-quota',
          kind: 'calculation',
          generate: (rng) => {
            const thousands = randomInt(rng, 2, 12)
            const ft = thousands * 1000
            const answer = `${15 - 2 * thousands} °C`
            return {
              prompt: `Approssimando il gradiente a 2 °C ogni 1000 ft, la temperatura ISA a ${n(ft)} ft è:`,
              answer,
              distractors: distinct(answer, [
                `${15 + 2 * thousands} °C`,
                `${15 - thousands} °C`,
                `${15 - 3 * thousands} °C`,
                `${-2 * thousands} °C`,
              ]),
              explanation: `15 °C − 2 °C × ${thousands} = ${answer}.`,
            }
          },
        },
      ],
      why: {
        correct:
          'Perché è il riferimento comune per strumenti e prestazioni: le condizioni reali si confrontano con questi valori.',
        wrong: [
          'Perché sono le condizioni medie misurate in Italia.',
          'Perché sono le condizioni in cui gli aerei volano meglio.',
          'Perché sono i limiti oltre i quali è vietato volare.',
        ],
      },
    },
    {
      id: 'quota-densita',
      subjectId: 'fpp',
      title: 'Quota densità e prestazioni',
      source:
        "La quota densità è la quota, in atmosfera standard, che ha la stessa densità dell'aria reale. Temperatura alta, umidità alta e pressione bassa riducono la densità e alzano la quota densità: l'ala produce meno portanza, il motore e l'elica meno spinta. La corsa di decollo si allunga e la salita peggiora.",
      variants: [
        {
          id: 'giornata-calda',
          kind: 'reasoning',
          prompt:
            'Aeroporto a 1000 ft in una giornata molto calda (35 °C). Rispetto alle condizioni ISA, la corsa di decollo sarà:',
          answer: 'Più lunga',
          distractors: [
            'Più corta',
            'Uguale',
            'Più corta solo con vento in coda',
            'Più corta perché il motore si scalda prima',
          ],
          explanation:
            "L'aria calda è meno densa: quota densità più alta, meno portanza e meno spinta, quindi più strada per decollare.",
        },
        {
          id: 'combinazione',
          kind: 'reasoning',
          prompt: 'Quale combinazione dà la quota densità più alta?',
          answer: 'Temperatura alta, umidità alta, pressione bassa',
          distractors: [
            'Temperatura bassa, umidità bassa, pressione alta',
            'Temperatura alta, umidità bassa, pressione alta',
            'Temperatura bassa, umidità alta, pressione alta',
            'Temperatura bassa, umidità bassa, pressione bassa',
          ],
          explanation:
            "Ognuno dei tre fattori riduce la densità. Il vapore acqueo è più leggero dell'aria secca, quindi anche l'umidità alta la riduce.",
        },
      ],
      why: {
        correct:
          "Perché l'aria meno densa produce meno portanza e meno spinta: l'aereo si comporta come se fosse più in alto.",
        wrong: [
          "Perché l'aria calda pesa di più.",
          "Perché l'umidità rende l'aria più densa.",
          'Perché con il caldo aumenta il peso del carburante.',
        ],
      },
    },
    {
      id: 'distanze-dichiarate',
      subjectId: 'fpp',
      title: 'Distanze dichiarate della pista',
      source:
        "TORA è la corsa di decollo disponibile. TODA = TORA + clearway: la clearway è un'area libera da ostacoli oltre la pista, utile alla salita iniziale. ASDA = TORA + stopway: la stopway serve a fermarsi in caso di decollo interrotto. LDA è la distanza disponibile per l'atterraggio.",
      variants: [
        {
          id: 'asda',
          kind: 'recall',
          prompt: "L'ASDA è uguale a:",
          answer: 'TORA + stopway',
          distractors: ['TORA + clearway', 'LDA + stopway', 'TODA + stopway', 'LDA + clearway'],
          explanation: 'ASDA = TORA + stopway: è la distanza per accelerare e poi fermarsi.',
        },
        {
          id: 'toda',
          kind: 'recall',
          prompt: 'La TODA è uguale a:',
          answer: 'TORA + clearway',
          distractors: ['TORA + stopway', 'ASDA + clearway', 'LDA + clearway', 'LDA + stopway'],
          explanation: 'TODA = TORA + clearway: la clearway serve alla salita, non alla frenata.',
        },
        {
          id: 'calcolo',
          kind: 'calculation',
          generate: (rng) => {
            const tora = randomInt(rng, 8, 20) * 50
            const stopway = randomInt(rng, 1, 4) * 30
            const clearway = stopway + randomInt(rng, 1, 4) * 40
            const askAsda = rng() < 0.5
            const asda = tora + stopway
            const toda = tora + clearway
            const answer = `${askAsda ? asda : toda} m`
            return {
              prompt: `TORA ${tora} m, stopway ${stopway} m, clearway ${clearway} m. Quanto vale la ${askAsda ? 'ASDA' : 'TODA'}?`,
              answer,
              distractors: distinct(answer, [
                `${askAsda ? toda : asda} m`,
                `${tora + stopway + clearway} m`,
                `${tora} m`,
                `${tora - stopway} m`,
              ]),
              explanation: askAsda
                ? `ASDA = TORA + stopway = ${tora} + ${stopway} = ${asda} m.`
                : `TODA = TORA + clearway = ${tora} + ${clearway} = ${toda} m.`,
            }
          },
        },
      ],
      why: {
        correct:
          'Perché la stopway serve a fermarsi dopo un decollo interrotto, la clearway solo alla salita iniziale.',
        wrong: [
          'Perché la clearway è asfaltata e si può usare per frenare.',
          'Perché la stopway serve ad atterrare più corti.',
          'Perché le due aree sono equivalenti.',
        ],
      },
    },
  ],
}
