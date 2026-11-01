import { describe, expect, it } from 'vitest'
import { defaultConfig } from '../config/config'
import { evaluate } from './flight/calc'
import {
  densityAltitude,
  densityRatio,
  distanceNm,
  flightTimeMinutes,
  fuelPlan,
  groundSpeedKt,
  isaTemperature,
  massBalance,
  normalize360,
  pressureAltitude,
  runwayToHeading,
  trueAirspeed,
  windComponents,
  windTriangle,
} from './flight/flight'
import { convert, quantities } from './flight/units'
import {
  addDays,
  itemsOn,
  nextPlanned,
  type PlanItem,
  readiness,
  repeatWeekly,
  startOfWeek,
  toIcs,
  weekDays,
} from './plan'
import { formatClock, nextPhase, pause, remaining, resume, startPomodoro, tick } from './pomodoro'

const close = (a: number | null | undefined, b: number, digits = 1) =>
  expect(a).toBeCloseTo(b, digits)

describe('wind triangle', () => {
  it('headwind slows, no correction', () => {
    const w = windTriangle(90, 100, 90, 20)
    close(w?.wca, 0)
    close(w?.groundSpeed, 80)
    close(w?.trueHeading, 90)
  })
  it('tailwind speeds up', () => {
    close(windTriangle(90, 100, 270, 20)?.groundSpeed, 120)
  })
  it('crosswind from the right needs a right correction', () => {
    const w = windTriangle(0, 100, 90, 20)
    close(w?.wca, 11.54)
    close(w?.trueHeading, 11.54)
    close(w?.groundSpeed, 97.98)
  })
  it('crosswind from the left needs a left correction, wrapping past north', () => {
    const w = windTriangle(0, 100, 270, 20)
    close(w?.trueHeading, 348.46)
  })
  it('rejects impossible cases', () => {
    expect(windTriangle(0, 10, 90, 20)).toBeNull()
    expect(windTriangle(0, 0, 90, 20)).toBeNull()
  })
})

describe('wind components', () => {
  it('splits head and cross wind', () => {
    const c = windComponents(runwayToHeading(27), 300, 20)
    close(c.headwind, 17.32)
    close(c.crosswind, 10)
    close(windComponents(270, 90, 10).headwind, -10)
    expect(normalize360(-10)).toBe(350)
  })
})

describe('altitude and speed', () => {
  it('computes pressure and density altitude', () => {
    expect(pressureAltitude(1000, 1013.25)).toBe(1000)
    close(pressureAltitude(1000, 1003.25), 1300)
    close(pressureAltitude(0, 1023.25, 27), -270)
    close(isaTemperature(0), 15)
    close(isaTemperature(5000), 5.1)
    expect(isaTemperature(60000)).toBe(-56.5)
    close(densityAltitude(1000, 35), 1000 + 120 * (35 - 13.02), 0)
  })
  it('computes TAS from CAS', () => {
    close(densityRatio(0), 1, 3)
    close(trueAirspeed(100, 0), 100)
    // About 2% per 1000 ft at low altitude.
    close(trueAirspeed(100, 5000), 107.8, 0)
  })
  it('relates time, distance and speed', () => {
    expect(flightTimeMinutes(60, 120)).toBe(30)
    expect(flightTimeMinutes(60, 0)).toBeNull()
    expect(distanceNm(90, 40)).toBe(60)
    expect(groundSpeedKt(50, 30)).toBe(100)
    expect(groundSpeedKt(50, 0)).toBeNull()
  })
})

describe('fuel', () => {
  it('plans trip, reserve and margin', () => {
    const f = fuelPlan({
      burnLitresPerHour: 30,
      tripMinutes: 60,
      reserveMinutes: 30,
      taxiLitres: 3,
      onBoardLitres: 100,
    })
    expect(f).toMatchObject({
      tripLitres: 30,
      reserveLitres: 15,
      requiredLitres: 48,
      marginLitres: 52,
    })
    close(f?.enduranceMinutes, 194)
    expect(
      fuelPlan({
        burnLitresPerHour: 0,
        tripMinutes: 1,
        reserveMinutes: 1,
        taxiLitres: 0,
        onBoardLitres: 1,
      }),
    ).toBeNull()
  })
})

describe('mass and balance', () => {
  it('computes CG and checks limits', () => {
    const r = massBalance(
      [
        { name: 'Vuoto', mass: 700, arm: 1 },
        { name: 'Pilota', mass: 80, arm: 0.9 },
        { name: 'Carburante', mass: 72, arm: 1.2 },
      ],
      { maxMass: 1000, cgMin: 0.9, cgMax: 1.1 },
    )
    expect(r.mass).toBe(852)
    close(r.cg, (700 + 72 + 86.4) / 852, 4)
    expect(r.withinMass).toBe(true)
    expect(r.withinCg).toBe(true)
    expect(massBalance([]).cg).toBeNull()
    expect(massBalance([{ name: 'x', mass: 1, arm: 5 }], { cgMin: 0, cgMax: 1 }).withinCg).toBe(
      false,
    )
  })
})

describe('units', () => {
  it('converts both ways', () => {
    close(convert('speed', 100, 'kt', 'kmh'), 185.2)
    close(convert('height', 1000, 'ft', 'm'), 304.8)
    close(convert('pressure', 29.92, 'inhg', 'hpa'), 1013.2)
    close(convert('temperature', 15, 'c', 'f'), 59)
    close(convert('vertical', 500, 'fpm', 'ms'), 2.54, 2)
    for (const q of quantities) {
      for (const u of q.units) close(convert(q.id, 42, u.id, u.id), 42, 6)
    }
    expect(() => convert('speed', 1, 'kt', 'x')).toThrow()
  })
})

describe('calculator', () => {
  const v = (s: string) => {
    const r = evaluate(s)
    return r.ok ? r.value : r.error
  }
  it('respects precedence, parentheses and unary minus', () => {
    expect(v('2+3*4')).toBe(14)
    expect(v('(2+3)*4')).toBe(20)
    expect(v('-2^2')).toBe(-4)
    expect(v('2^3^2')).toBe(512)
    expect(v('10/4')).toBe(2.5)
    expect(v('1,5 × 2')).toBe(3)
    expect(v('+3 − 1')).toBe(2)
  })
  it('uses degrees for trigonometry', () => {
    close(v('sin(30)') as number, 0.5, 6)
    close(v('cos(60)') as number, 0.5, 6)
    close(v('atan(1)') as number, 45, 6)
    close(v('sqrt(16)+abs(-1)+round(2.6)+log(100)+ln(1)') as number, 10, 6)
    close(v('pi') as number, Math.PI, 6)
  })
  it('reports errors in Italian instead of throwing', () => {
    expect(v('')).toBe('Scrivi un calcolo.')
    expect(v('1/0')).toBe('Divisione per zero.')
    expect(v('(1+2')).toBe('Manca una parentesi chiusa.')
    expect(v('foo(1)')).toMatch(/Funzione sconosciuta/)
    expect(v('sqrt 4')).toMatch(/parentesi/)
    expect(v('2 $ 3')).toMatch(/Carattere/)
    expect(v('1.2.3')).toMatch(/Numero/)
    expect(v('2 3')).toBe('Calcolo non valido.')
    expect(v('3*')).toBe('Calcolo incompleto.')
    expect(v(')')).toMatch(/Simbolo/)
    expect(v('sqrt(-1)')).toBe('Risultato non definito.')
    expect(v('sin(1')).toBe('Manca una parentesi chiusa.')
  })
})

describe('plan', () => {
  const at = (s: string) => new Date(s)
  const item = (start: string, extra: Partial<PlanItem> = {}): PlanItem => ({
    id: start,
    start: at(start).toISOString(),
    minutes: 45,
    kind: 'study',
    subjectId: null,
    done: false,
    ...extra,
  })

  it('builds Monday-first weeks', () => {
    const days = weekDays(at('2026-11-05T12:00:00')) // a Thursday
    expect(days[0]?.getDay()).toBe(1)
    expect(days[6]?.getDay()).toBe(0)
    expect(startOfWeek(at('2026-11-08T23:00:00')).getDate()).toBe(2)
    expect(addDays(at('2026-11-30T10:00:00'), 1).getMonth()).toBe(11)
  })

  it('lists, repeats and finds the next session', () => {
    const a = item('2026-11-03T18:00:00')
    const b = item('2026-11-03T08:00:00')
    expect(itemsOn([a, b], at('2026-11-03T00:00:00')).map((i) => i.id)).toEqual([b.id, a.id])
    let n = 0
    const weekly = repeatWeekly(
      { start: a.start, minutes: 30, kind: 'review', subjectId: 'met', done: false },
      3,
      () => `id${n++}`,
    )
    expect(weekly.map((w) => new Date(w.start).getDate())).toEqual([3, 10, 17])
    expect(nextPlanned([a, b], at('2026-11-03T12:00:00'))?.id).toBe(a.id)
    expect(nextPlanned([{ ...a, done: true }], at('2026-11-01T00:00:00'))).toBeNull()
  })

  it('computes readiness for the exam', () => {
    expect(readiness(at('2026-12-31T00:00:00'), at('2026-11-01T09:00:00'), 46)).toEqual({
      daysLeft: 60,
      notStarted: 46,
      newPerDay: 1,
    })
    expect(readiness(at('2026-11-11T00:00:00'), at('2026-11-01T09:00:00'), 21).newPerDay).toBe(3)
    expect(readiness(at('2026-10-01T00:00:00'), at('2026-11-01T09:00:00'), 5).newPerDay).toBeNull()
  })

  it('exports a valid iCalendar file', () => {
    const ics = toIcs(
      [item('2026-11-03T18:00:00', { subjectId: 'met' })],
      () => 'Meteo, base',
      at('2026-11-01T00:00:00Z'),
    )
    expect(ics.startsWith('BEGIN:VCALENDAR\r\n')).toBe(true)
    expect(ics).toContain('SUMMARY:Vector · Studio · Meteo\\, base')
    expect(ics).toContain('DTSTAMP:20261101T000000Z')
    expect(ics.trimEnd().endsWith('END:VCALENDAR')).toBe(true)
  })
})

describe('pomodoro', () => {
  const cfg = defaultConfig.pomodoro
  it('runs focus, short and long breaks', () => {
    let p = startPomodoro(0, cfg)
    expect(remaining(p, 60_000)).toBe(24 * 60_000)
    expect(formatClock(remaining(p, 60_000))).toBe('24:00')
    const phases: string[] = []
    let now = 0
    for (let i = 0; i < 8; i++) {
      now = p.endsAt ?? now
      const t = tick(p, now, cfg)
      p = t.state
      phases.push(p.phase)
    }
    expect(phases).toEqual([
      'short-break',
      'focus',
      'short-break',
      'focus',
      'short-break',
      'focus',
      'long-break',
      'focus',
    ])
    expect(p.completed).toBe(4)
    expect(tick(p, now, cfg).finished).toBeNull()
  })
  it('pauses, resumes and skips without counting', () => {
    const p = pause(startPomodoro(0, cfg), 5 * 60_000)
    expect(remaining(p, 999_999_999)).toBe(20 * 60_000)
    expect(pause(p, 1)).toBe(p)
    const r = resume(p, 1_000_000)
    expect(r.endsAt).toBe(1_000_000 + 20 * 60_000)
    expect(resume(r, 0)).toBe(r)
    expect(nextPhase(r, 0, cfg, false)).toMatchObject({ phase: 'short-break', completed: 0 })
    expect(tick(p, 9e12, cfg).finished).toBeNull()
  })
})
