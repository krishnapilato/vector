import { describe, expect, it } from 'vitest'
import { defaultSettings } from '../model/defaults'
import { Backup, type Calibration, type Session } from '../model/schemas'
import { recentTags, totals, weekStart } from '../session/totals'
import { csvCell, makeBackup, mergeBackups, sessionsCsv, toCsv } from './export'

const MIN = 60_000

function session(over: Partial<Session> & Pick<Session, 'id' | 'startedAt'>): Session {
  return {
    tag: 'Deep work',
    endedAt: over.startedAt + 30 * MIN,
    activeSeconds: 1800,
    pauseCount: 0,
    cameraUsed: false,
    focusAggregates: null,
    clarityRating: 4,
    note: '',
    ...over,
  }
}

const focus = (pct: number) => ({
  activeSeconds: 1800,
  focusedSeconds: 18 * pct,
  distractedSeconds: 0,
  awaySeconds: 0,
  distractionCount: 1,
  fatigueEvents: 2,
  breaksSuggested: 1,
  breaksAccepted: 0,
  focusScorePct: pct,
})

const calibration = (id: string, createdAt: number): Calibration => ({
  id,
  label: 'Desk',
  meanYaw: 0,
  sdYaw: 3,
  meanPitch: 20,
  sdPitch: 4,
  createdAt,
})

describe('csv export', () => {
  it('neutralises spreadsheet formulas and quotes separators', () => {
    expect(csvCell('=HYPERLINK("x")')).toBe(`"'=HYPERLINK(""x"")"`)
    expect(csvCell('+1')).toBe("'+1")
    expect(csvCell('a,b')).toBe('"a,b"')
    expect(csvCell(-5)).toBe('-5')
    expect(csvCell(null)).toBe('')
    expect(toCsv(['a', 'b'], [[1, null]])).toBe('a,b\r\n1,\r\n')
  })

  it('writes one line per session, oldest first', () => {
    const csv = sessionsCsv([
      session({ id: 'b', startedAt: 2 * MIN, cameraUsed: true, focusAggregates: focus(86) }),
      session({ id: 'a', startedAt: 0, note: 'Stopped at page 124' }),
    ])
    const lines = csv.trim().split('\r\n')
    expect(lines[0]).toBe(
      'started,ended,tag,active_min,pauses,camera,focus_pct,fatigue_events,rating,note',
    )
    expect(lines[1]).toContain('Stopped at page 124')
    expect(lines[2]).toContain(',yes,86,2,4,')
  })
})

describe('backup', () => {
  it('is valid against the schema', () => {
    const b = makeBackup(
      defaultSettings(),
      [calibration('c', 1)],
      [session({ id: 'a', startedAt: 0 })],
      5,
    )
    expect(Backup.safeParse(JSON.parse(JSON.stringify(b))).success).toBe(true)
    expect(Backup.safeParse({ ...b, app: 'other' }).success).toBe(false)
  })

  it('merges without losing a session from either side', () => {
    const local = makeBackup(defaultSettings(), [], [session({ id: 'a', startedAt: 0 })], 1)
    const file = makeBackup(
      { ...defaultSettings(), defaultDurationMin: 45 },
      [],
      [session({ id: 'a', startedAt: 0 }), session({ id: 'b', startedAt: MIN })],
      2,
    )
    const r = mergeBackups(local, file)
    expect(r.backup.sessions.map((s) => s.id)).toEqual(['a', 'b'])
    expect(r.newSessions).toBe(1)
    expect(r.backup.settings?.defaultDurationMin).toBe(45)
    expect(r.backup.exportedAt).toBe(2)
  })

  it('keeps the newer calibration and the local settings when the file has none', () => {
    const local = makeBackup(defaultSettings(), [calibration('c', 1)], [], 1)
    const file = makeBackup(null, [calibration('c', 9), calibration('d', 3)], [], 0)
    const r = mergeBackups(local, file)
    expect(r.backup.calibrations.find((c) => c.id === 'c')?.createdAt).toBe(9)
    expect(r.newCalibrations).toBe(1)
    expect(r.backup.settings).toEqual(defaultSettings())
    expect(mergeBackups(file, local).backup.calibrations.find((c) => c.id === 'c')?.createdAt).toBe(
      9,
    )
  })

  it('restores an emptied device identically', () => {
    const full = makeBackup(
      defaultSettings(),
      [calibration('c', 1)],
      [session({ id: 'a', startedAt: 0 })],
      3,
    )
    const empty = makeBackup(null, [], [], 0)
    expect(mergeBackups(empty, full).backup).toEqual(full)
  })
})

describe('logbook totals', () => {
  const monday = weekStart(new Date(2026, 10, 18, 15))

  it('starts the week on Monday at midnight', () => {
    expect(new Date(monday)).toEqual(new Date(2026, 10, 16))
    expect(weekStart(new Date(2026, 10, 16, 0, 0))).toBe(monday)
    expect(weekStart(new Date(2026, 10, 22, 23))).toBe(monday)
  })

  it('adds hours and weights focus by session length', () => {
    const t = totals(
      [
        session({ id: 'old', startedAt: monday - 3 * 86_400_000 }),
        session({
          id: 'a',
          startedAt: monday + MIN,
          focusAggregates: focus(90),
          activeSeconds: 3600,
        }),
        session({
          id: 'b',
          startedAt: monday + 2 * MIN,
          focusAggregates: focus(60),
          activeSeconds: 1800,
        }),
      ],
      monday,
    )
    expect(t.totalHours).toBe(2)
    expect(t.weekHours).toBe(1.5)
    expect(t.weekSessions).toBe(2)
    expect(t.averageFocusPct).toBe(80)
    expect(totals([], monday)).toEqual({
      totalHours: 0,
      weekHours: 0,
      weekSessions: 0,
      averageFocusPct: null,
    })
  })

  it('suggests the latest distinct tags', () => {
    const list = [
      session({ id: '1', startedAt: 1, tag: 'Math' }),
      session({ id: '2', startedAt: 2, tag: 'Essay draft' }),
      session({ id: '3', startedAt: 3, tag: 'math ' }),
      session({ id: '4', startedAt: 4, tag: '' }),
    ]
    expect(recentTags(list)).toEqual(['math', 'Essay draft'])
    expect(recentTags(list, 1)).toEqual(['math'])
  })
})
