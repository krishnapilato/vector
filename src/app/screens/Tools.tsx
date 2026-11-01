import { type ReactNode, useId, useState } from 'react'
import { evaluate } from '../../core/flight/calc'
import {
  AVGAS_KG_PER_LITRE,
  densityAltitude,
  fuelPlan,
  isaTemperature,
  type MassItem,
  massBalance,
  pressureAltitude,
  runwayToHeading,
  trueAirspeed,
  windComponents,
  windTriangle,
} from '../../core/flight/flight'
import { convert, quantities } from '../../core/flight/units'
import { hrefFor } from '../router'
import { Page, QuietButton } from '../ui'

/**
 * Flight tools. Every tool works offline and is also available as a side panel
 * during study, so a calculation never means leaving the app.
 */

const fmt = (v: number, digits = 1) =>
  new Intl.NumberFormat('it-IT', { maximumFractionDigits: digits }).format(v)

/** Accepts "12,5" and "12.5"; empty or invalid → NaN. */
const num = (s: string) => (s.trim() === '' ? Number.NaN : Number(s.replace(',', '.')))
const ok = (...values: number[]) => values.every(Number.isFinite)

export const tools = [
  { id: 'calcolatrice', name: 'Calcolatrice', component: Calculator },
  { id: 'conversioni', name: 'Conversioni', component: Converter },
  { id: 'vento', name: 'Vento', component: Wind },
  { id: 'quote', name: 'Quote e velocità', component: Altitudes },
  { id: 'tempo', name: 'Tempo, distanza, velocità', component: TimeSpeed },
  { id: 'carburante', name: 'Carburante', component: Fuel },
  { id: 'centraggio', name: 'Peso e centraggio', component: MassAndBalance },
] as const

export function Tools({ tool }: { tool: string | null }) {
  const current = tools.find((t) => t.id === tool) ?? tools[0]
  const Current = current.component
  return (
    <Page title="Strumenti">
      <nav aria-label="Strumenti">
        <ul className="flex flex-wrap gap-x-1 gap-y-2">
          {tools.map((t) => (
            <li key={t.id}>
              <a
                href={hrefFor({ name: 'tools', tool: t.id })}
                aria-current={t.id === current.id ? 'page' : undefined}
                className={`inline-flex min-h-11 items-center rounded-lg px-3 text-sm ${
                  t.id === current.id ? 'border border-[var(--fg)]' : 'text-[var(--fg-quiet)]'
                }`}
              >
                {t.name}
              </a>
            </li>
          ))}
        </ul>
      </nav>
      <section aria-label={current.name} className="flex flex-col gap-6">
        <Current />
      </section>
      <p className="text-xs text-[var(--fg-quiet)]">
        Strumenti per studiare ed esercitarsi: per pianificare un volo vero usa sempre il manuale
        dell'aereo e i dati ufficiali.
      </p>
    </Page>
  )
}

/* ---------- building blocks ---------- */

function Field({
  label,
  unit,
  value,
  onChange,
  placeholder,
}: {
  label: string
  unit?: string
  value: string
  onChange: (v: string) => void
  placeholder?: string
}) {
  const id = useId()
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-sm">
        {label}
        {unit && <span className="text-[var(--fg-quiet)]"> ({unit})</span>}
      </label>
      <input
        id={id}
        inputMode="decimal"
        autoComplete="off"
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="min-h-11 w-full rounded-lg border border-[var(--rule)] bg-transparent px-3 tabular-nums placeholder:text-[var(--fg-quiet)]"
      />
    </div>
  )
}

function Grid({ children }: { children: ReactNode }) {
  return <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">{children}</div>
}

function Results({ items }: { items: [string, string | null][] }) {
  return (
    <dl
      className="grid grid-cols-2 gap-4 border-t border-[var(--rule)] pt-4 sm:grid-cols-3"
      aria-live="polite"
    >
      {items.map(([label, value]) => (
        <div key={label}>
          <dt className="text-xs text-[var(--fg-quiet)]">{label}</dt>
          <dd className="text-xl tabular-nums">{value ?? '—'}</dd>
        </div>
      ))}
    </dl>
  )
}

function Note({ children }: { children: ReactNode }) {
  return <p className="text-sm text-[var(--fg-quiet)]">{children}</p>
}

/* ---------- tools ---------- */

export function Calculator() {
  const [input, setInput] = useState('')
  const [history, setHistory] = useState<{ id: number; expr: string; value: number }[]>([])
  const id = useId()
  const result = evaluate(input)

  const commit = () => {
    if (!result.ok) return
    setHistory((h) => [{ id: Date.now(), expr: input, value: result.value }, ...h].slice(0, 5))
    setInput(String(Math.round(result.value * 1e6) / 1e6).replace('.', ','))
  }

  return (
    <div className="flex flex-col gap-4">
      <label htmlFor={id} className="text-sm">
        Calcolo <span className="text-[var(--fg-quiet)]">(Invio per confermare)</span>
      </label>
      <input
        id={id}
        autoComplete="off"
        spellCheck={false}
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.stopPropagation()
            commit()
          }
        }}
        placeholder="es. 120 * cos(30)"
        className="min-h-12 w-full rounded-lg border border-[var(--rule)] bg-transparent px-3 font-mono text-lg"
      />
      <p className="min-h-8 text-2xl tabular-nums" aria-live="polite">
        {input.trim() === '' ? (
          ''
        ) : result.ok ? (
          `= ${fmt(result.value, 6)}`
        ) : (
          <span className="text-base text-[var(--fg-quiet)]">{result.error}</span>
        )}
      </p>
      {history.length > 0 && (
        <ul className="flex flex-col gap-1 text-sm text-[var(--fg-quiet)]">
          {history.map((h) => (
            <li key={h.id} className="font-mono">
              {h.expr} = {fmt(h.value, 6)}
            </li>
          ))}
        </ul>
      )}
      <Note>
        Operatori + − × ÷ ^ e parentesi. Funzioni in gradi: sin, cos, tan, asin, acos, atan; poi
        sqrt, abs, ln, log, round, pi.
      </Note>
    </div>
  )
}

export function Converter() {
  const [quantityId, setQuantityId] = useState<string>(quantities[0]?.id ?? 'speed')
  const quantity = quantities.find((q) => q.id === quantityId) ?? quantities[0]
  const [unit, setUnit] = useState<string>(quantity?.units[0]?.id ?? '')
  const [value, setValue] = useState('100')
  const qId = useId()
  const uId = useId()
  if (!quantity) return null
  const from = quantity.units.some((u) => u.id === unit) ? unit : (quantity.units[0]?.id ?? '')
  const v = num(value)

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        <div className="flex flex-col gap-1">
          <label htmlFor={qId} className="text-sm">
            Grandezza
          </label>
          <select
            id={qId}
            value={quantityId}
            onChange={(e) => setQuantityId(e.target.value)}
            className="min-h-11 rounded-lg border border-[var(--rule)] bg-[var(--bg)] px-3"
          >
            {quantities.map((q) => (
              <option key={q.id} value={q.id}>
                {q.name}
              </option>
            ))}
          </select>
        </div>
        <Field label="Valore" value={value} onChange={setValue} />
        <div className="flex flex-col gap-1">
          <label htmlFor={uId} className="text-sm">
            Unità
          </label>
          <select
            id={uId}
            value={from}
            onChange={(e) => setUnit(e.target.value)}
            className="min-h-11 rounded-lg border border-[var(--rule)] bg-[var(--bg)] px-3"
          >
            {quantity.units.map((u) => (
              <option key={u.id} value={u.id}>
                {u.label}
              </option>
            ))}
          </select>
        </div>
      </div>
      <Results
        items={quantity.units
          .filter((u) => u.id !== from)
          .map((u) => [u.label, ok(v) ? fmt(convert(quantity.id, v, from, u.id), 3) : null])}
      />
    </div>
  )
}

function Wind() {
  const [tc, setTc] = useState('090')
  const [tas, setTas] = useState('100')
  const [wd, setWd] = useState('130')
  const [ws, setWs] = useState('20')
  const [rwy, setRwy] = useState('09')
  const w = ok(num(tc), num(tas), num(wd), num(ws))
    ? windTriangle(num(tc), num(tas), num(wd), num(ws))
    : null
  const c = ok(num(rwy), num(wd), num(ws))
    ? windComponents(runwayToHeading(num(rwy)), num(wd), num(ws))
    : null
  const side = (x: number) => (x >= 0 ? 'da destra' : 'da sinistra')
  const head = (x: number) => (x >= 0 ? 'contro' : 'in coda')

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-4">
        <h2 className="text-lg font-medium">Triangolo del vento</h2>
        <Grid>
          <Field label="Rotta vera" unit="°" value={tc} onChange={setTc} />
          <Field label="TAS" unit="kt" value={tas} onChange={setTas} />
          <Field label="Vento da" unit="°" value={wd} onChange={setWd} />
          <Field label="Intensità" unit="kt" value={ws} onChange={setWs} />
        </Grid>
        <Results
          items={[
            [
              'Correzione (WCA)',
              w ? `${fmt(Math.abs(w.wca))}° ${w.wca >= 0 ? 'a destra' : 'a sinistra'}` : null,
            ],
            ['Prua vera', w ? `${fmt(w.trueHeading, 0).padStart(3, '0')}°` : null],
            ['Velocità al suolo', w ? `${fmt(w.groundSpeed, 0)} kt` : null],
          ]}
        />
        {!w && ok(num(tc), num(tas), num(wd), num(ws)) && (
          <Note>Con questo vento la rotta non si può mantenere.</Note>
        )}
      </div>
      <div className="flex flex-col gap-4">
        <h2 className="text-lg font-medium">Componenti per la pista</h2>
        <Grid>
          <Field label="Pista" unit="es. 27" value={rwy} onChange={setRwy} />
        </Grid>
        <Results
          items={[
            ['Vento frontale', c ? `${fmt(Math.abs(c.headwind), 0)} kt ${head(c.headwind)}` : null],
            [
              'Vento al traverso',
              c ? `${fmt(Math.abs(c.crosswind), 0)} kt ${side(c.crosswind)}` : null,
            ],
          ]}
        />
        <Note>Usa lo stesso vento inserito sopra. Il vento del METAR è riferito al nord vero.</Note>
      </div>
    </div>
  )
}

function Altitudes() {
  const [elev, setElev] = useState('1000')
  const [qnh, setQnh] = useState('1013')
  const [oat, setOat] = useState('15')
  const [cas, setCas] = useState('100')
  const [factor, setFactor] = useState('30')
  const pa = ok(num(elev), num(qnh), num(factor))
    ? pressureAltitude(num(elev), num(qnh), num(factor))
    : null
  const isa = pa === null ? null : isaTemperature(pa)
  const da = pa !== null && ok(num(oat)) ? densityAltitude(pa, num(oat)) : null
  const tas = da !== null && ok(num(cas)) ? trueAirspeed(num(cas), da) : null

  return (
    <div className="flex flex-col gap-4">
      <Grid>
        <Field label="Quota / elevazione" unit="ft" value={elev} onChange={setElev} />
        <Field label="QNH" unit="hPa" value={qnh} onChange={setQnh} />
        <Field label="Temperatura esterna" unit="°C" value={oat} onChange={setOat} />
        <Field label="CAS" unit="kt" value={cas} onChange={setCas} />
      </Grid>
      <Results
        items={[
          ['Quota pressione', pa === null ? null : `${fmt(pa, 0)} ft`],
          ['Temperatura ISA', isa === null ? null : `${fmt(isa)} °C`],
          [
            'Scarto da ISA',
            isa === null || !ok(num(oat))
              ? null
              : `${num(oat) - isa >= 0 ? '+' : ''}${fmt(num(oat) - isa)} °C`,
          ],
          ['Quota densità', da === null ? null : `${fmt(da, 0)} ft`],
          ['TAS', tas === null ? null : `${fmt(tas, 0)} kt`],
        ]}
      />
      <div className="max-w-48">
        <Field label="Piedi per hPa" value={factor} onChange={setFactor} />
      </div>
      <Note>
        Regole pratiche: 30 ft per hPa (alcuni testi usano 27) e 120 ft di quota densità per ogni °C
        sopra l'ISA. La TAS è calcolata dalla densità in atmosfera standard.
      </Note>
    </div>
  )
}

function TimeSpeed() {
  const [dist, setDist] = useState('60')
  const [gs, setGs] = useState('100')
  const [time, setTime] = useState('')
  const d = num(dist)
  const g = num(gs)
  const t = num(time)
  let missing: 'dist' | 'gs' | 'time' | null = null
  if (!ok(t) && ok(d, g)) missing = 'time'
  else if (!ok(g) && ok(d, t)) missing = 'gs'
  else if (!ok(d) && ok(g, t)) missing = 'dist'

  return (
    <div className="flex flex-col gap-4">
      <Note>Lascia vuoto il campo da calcolare.</Note>
      <Grid>
        <Field label="Distanza" unit="NM" value={dist} onChange={setDist} />
        <Field label="Velocità al suolo" unit="kt" value={gs} onChange={setGs} />
        <Field label="Tempo" unit="min" value={time} onChange={setTime} />
      </Grid>
      <Results
        items={[
          ['Distanza', missing === 'dist' ? `${fmt((g * t) / 60)} NM` : null],
          ['Velocità al suolo', missing === 'gs' && t > 0 ? `${fmt((d / t) * 60, 0)} kt` : null],
          [
            'Tempo',
            missing === 'time' && g > 0
              ? `${Math.floor(((d / g) * 60) / 60)} h ${fmt(((d / g) * 60) % 60, 0)} min`
              : null,
          ],
        ]}
      />
    </div>
  )
}

function Fuel() {
  const [burn, setBurn] = useState('30')
  const [trip, setTrip] = useState('90')
  const [reserve, setReserve] = useState('30')
  const [taxi, setTaxi] = useState('3')
  const [onBoard, setOnBoard] = useState('100')
  const f = ok(num(burn), num(trip), num(reserve), num(taxi), num(onBoard))
    ? fuelPlan({
        burnLitresPerHour: num(burn),
        tripMinutes: num(trip),
        reserveMinutes: num(reserve),
        taxiLitres: num(taxi),
        onBoardLitres: num(onBoard),
      })
    : null
  const l = (v: number) => `${fmt(v)} L · ${fmt(v * AVGAS_KG_PER_LITRE)} kg`

  return (
    <div className="flex flex-col gap-4">
      <Grid>
        <Field label="Consumo" unit="L/h" value={burn} onChange={setBurn} />
        <Field label="Durata del volo" unit="min" value={trip} onChange={setTrip} />
        <Field label="Riserva" unit="min" value={reserve} onChange={setReserve} />
        <Field label="Rullaggio" unit="L" value={taxi} onChange={setTaxi} />
        <Field label="A bordo" unit="L" value={onBoard} onChange={setOnBoard} />
      </Grid>
      <Results
        items={[
          ['Viaggio', f ? l(f.tripLitres) : null],
          ['Riserva', f ? l(f.reserveLitres) : null],
          ['Necessario', f ? l(f.requiredLitres) : null],
          [
            'Margine',
            f ? `${f.marginLitres >= 0 ? '' : 'mancano '}${fmt(Math.abs(f.marginLitres))} L` : null,
          ],
          [
            'Autonomia',
            f
              ? `${Math.floor(f.enduranceMinutes / 60)} h ${fmt(f.enduranceMinutes % 60, 0)} min`
              : null,
          ],
        ]}
      />
      <Note>
        Massa calcolata con AVGAS a {fmt(AVGAS_KG_PER_LITRE, 2)} kg/L. La riserva minima la
        stabiliscono il regolamento e il manuale: inseriscila tu.
      </Note>
    </div>
  )
}

function MassAndBalance() {
  const [rows, setRows] = useState<{ id: number; name: string; mass: string; arm: string }[]>(
    ['Aereo vuoto', 'Pilota e passeggero', 'Passeggeri dietro', 'Bagagli', 'Carburante'].map(
      (name, id) => ({ id, name, mass: '', arm: '' }),
    ),
  )
  const [maxMass, setMaxMass] = useState('')
  const [cgMin, setCgMin] = useState('')
  const [cgMax, setCgMax] = useState('')
  const items: MassItem[] = rows
    .filter((r) => ok(num(r.mass), num(r.arm)))
    .map((r) => ({ name: r.name, mass: num(r.mass), arm: num(r.arm) }))
  const limits = {
    ...(ok(num(maxMass)) ? { maxMass: num(maxMass) } : {}),
    ...(ok(num(cgMin), num(cgMax)) ? { cgMin: num(cgMin), cgMax: num(cgMax) } : {}),
  }
  const r = massBalance(items, limits)
  const yesNo = (v: boolean | null) => (v === null ? null : v ? 'entro i limiti' : 'FUORI LIMITE')
  const set = (i: number, patch: Partial<(typeof rows)[number]>) =>
    setRows((rs) => rs.map((row, j) => (j === i ? { ...row, ...patch } : row)))

  return (
    <div className="flex flex-col gap-4">
      <Note>Inserisci masse e bracci dal manuale del tuo aereo, nelle stesse unità.</Note>
      <div className="flex flex-col gap-3">
        <div className="hidden grid-cols-[2fr_1fr_1fr_1fr] gap-2 text-sm text-[var(--fg-quiet)] sm:grid">
          <span>Voce</span>
          <span>Massa</span>
          <span>Braccio</span>
          <span>Momento</span>
        </div>
        {rows.map((row, i) => (
          <div
            key={row.id}
            className="grid grid-cols-3 gap-2 border-b border-[var(--rule)] pb-3 sm:grid-cols-[2fr_1fr_1fr_1fr] sm:border-0 sm:pb-0"
          >
            <input
              aria-label={`Voce ${i + 1}`}
              value={row.name}
              onChange={(e) => set(i, { name: e.target.value })}
              className="col-span-3 min-h-11 rounded-lg border border-[var(--rule)] bg-transparent px-2 sm:col-span-1"
            />
            <input
              aria-label={`Massa di ${row.name}`}
              placeholder="massa"
              inputMode="decimal"
              value={row.mass}
              onChange={(e) => set(i, { mass: e.target.value })}
              className="min-h-11 rounded-lg border border-[var(--rule)] bg-transparent px-2 tabular-nums placeholder:text-[var(--fg-quiet)]"
            />
            <input
              aria-label={`Braccio di ${row.name}`}
              placeholder="braccio"
              inputMode="decimal"
              value={row.arm}
              onChange={(e) => set(i, { arm: e.target.value })}
              className="min-h-11 rounded-lg border border-[var(--rule)] bg-transparent px-2 tabular-nums placeholder:text-[var(--fg-quiet)]"
            />
            <span className="flex items-center tabular-nums text-[var(--fg-quiet)]">
              {ok(num(row.mass), num(row.arm)) ? fmt(num(row.mass) * num(row.arm), 1) : '—'}
            </span>
          </div>
        ))}
      </div>
      <QuietButton
        className="self-start"
        onClick={() =>
          setRows((rs) => [
            ...rs,
            { id: rs.length, name: `Voce ${rs.length + 1}`, mass: '', arm: '' },
          ])
        }
      >
        Aggiungi una voce
      </QuietButton>
      <Grid>
        <Field label="Massa massima" value={maxMass} onChange={setMaxMass} />
        <Field label="Baricentro minimo" value={cgMin} onChange={setCgMin} />
        <Field label="Baricentro massimo" value={cgMax} onChange={setCgMax} />
      </Grid>
      <Results
        items={[
          ['Massa totale', items.length ? fmt(r.mass) : null],
          ['Momento totale', items.length ? fmt(r.moment) : null],
          ['Baricentro', r.cg === null ? null : fmt(r.cg, 3)],
          ['Verifica massa', yesNo(r.withinMass)],
          ['Verifica centraggio', yesNo(r.withinCg)],
        ]}
      />
    </div>
  )
}
