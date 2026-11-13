/**
 * iCalendar export of the plan (ported from v2 plan.ts). It is the reminder mechanism: a PWA
 * with no server cannot schedule reliable notifications, Google Calendar can (PIANO-V3 §5.5).
 */
import type { Block, Window } from '../model/schemas'

/** Local start time used for each window when exporting. */
export const windowStart: Record<Window, string> = {
  morning: '08:30',
  lunch: '13:00',
  evening: '21:00',
  commute: '07:40',
}

function icsText(s: string): string {
  return s.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n')
}

/** Folds lines longer than 75 octets, as RFC 5545 asks. */
function fold(line: string): string {
  const bytes = new TextEncoder().encode(line)
  if (bytes.length <= 75) return line
  const parts: string[] = []
  let current = ''
  let size = 0
  for (const ch of line) {
    const n = new TextEncoder().encode(ch).length
    if (size + n > (parts.length === 0 ? 75 : 74)) {
      parts.push(current)
      current = ''
      size = 0
    }
    current += ch
    size += n
  }
  parts.push(current)
  return parts.join('\r\n ')
}

function stamp(ms: number): string {
  return new Date(ms)
    .toISOString()
    .replace(/[-:]/g, '')
    .replace(/\.\d{3}/, '')
}

/** Floating local time (no time zone): the event stays at 21:00 wherever the calendar is. */
function localDateTime(date: string, time: string, plusMinutes: number): string {
  const [h = 0, m = 0] = time.split(':').map(Number)
  const total = h * 60 + m + plusMinutes
  const day = new Date(`${date}T00:00:00Z`)
  day.setUTCMinutes(total)
  return day
    .toISOString()
    .replace(/[-:]/g, '')
    .replace(/\.\d{3}Z$/, '')
}

export interface IcsEvent {
  block: Block
  title: string
  description: string
}

export function toIcs(events: readonly IcsEvent[], now: number): string {
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Vector//Study plan//EN',
    'CALSCALE:GREGORIAN',
    'X-WR-CALNAME:Vector',
  ]
  const offsets = new Map<string, number>()
  for (const { block, title, description } of events) {
    const key = `${block.date}|${block.window}`
    const offset = offsets.get(key) ?? 0
    offsets.set(key, offset + block.minutes + 10)
    const start = windowStart[block.window]
    lines.push(
      'BEGIN:VEVENT',
      `UID:${block.id}@vector`,
      `DTSTAMP:${stamp(now)}`,
      `DTSTART:${localDateTime(block.date, start, offset)}`,
      `DTEND:${localDateTime(block.date, start, offset + block.minutes)}`,
      `SUMMARY:${icsText(title)}`,
      `DESCRIPTION:${icsText(description)}`,
      'END:VEVENT',
    )
  }
  lines.push('END:VCALENDAR')
  return `${lines.map(fold).join('\r\n')}\r\n`
}
