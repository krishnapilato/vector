/**
 * CSV export of the logbook (PIANO-V3 §5.7). Cells that a spreadsheet would run as a formula
 * (starting with = + - @ or a control character) are prefixed with an apostrophe.
 */
export function csvCell(value: string | number | null): string {
  if (value === null) return ''
  let text = String(value)
  if (typeof value === 'string' && /^[=+\-@\t\r]/.test(text)) text = `'${text}`
  return /[",\n\r;]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
}

export function toCsv(
  header: readonly string[],
  rows: readonly (readonly (string | number | null)[])[],
): string {
  return `${[header, ...rows].map((r) => r.map(csvCell).join(',')).join('\r\n')}\r\n`
}
