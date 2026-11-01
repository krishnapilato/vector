/** Unit conversions: each quantity has a base unit and a factor per unit. */

export interface Quantity {
  id: string
  name: string
  units: readonly {
    id: string
    label: string
    toBase: (v: number) => number
    fromBase: (v: number) => number
  }[]
}

const linear = (id: string, label: string, factor: number) => ({
  id,
  label,
  toBase: (v: number) => v * factor,
  fromBase: (v: number) => v / factor,
})

export const quantities: readonly Quantity[] = [
  {
    id: 'speed',
    name: 'Velocità',
    units: [
      linear('kt', 'kt', 1.852),
      linear('kmh', 'km/h', 1),
      linear('mph', 'mph', 1.609344),
      linear('ms', 'm/s', 3.6),
    ],
  },
  {
    id: 'distance',
    name: 'Distanza',
    units: [linear('nm', 'NM', 1.852), linear('km', 'km', 1), linear('sm', 'SM', 1.609344)],
  },
  {
    id: 'height',
    name: 'Altezza',
    units: [linear('ft', 'ft', 0.3048), linear('m', 'm', 1)],
  },
  {
    id: 'pressure',
    name: 'Pressione',
    units: [linear('hpa', 'hPa', 1), linear('inhg', 'inHg', 33.8639)],
  },
  {
    id: 'temperature',
    name: 'Temperatura',
    units: [
      { id: 'c', label: '°C', toBase: (v: number) => v, fromBase: (v: number) => v },
      {
        id: 'f',
        label: '°F',
        toBase: (v: number) => ((v - 32) * 5) / 9,
        fromBase: (v: number) => (v * 9) / 5 + 32,
      },
    ],
  },
  {
    id: 'mass',
    name: 'Massa',
    units: [linear('kg', 'kg', 1), linear('lb', 'lb', 0.45359237)],
  },
  {
    id: 'volume',
    name: 'Volume',
    units: [linear('l', 'L', 1), linear('usg', 'USG', 3.785411784)],
  },
  {
    id: 'vertical',
    name: 'Velocità verticale',
    units: [linear('fpm', 'ft/min', 0.00508), linear('ms', 'm/s', 1)],
  },
]

export function convert(quantityId: string, value: number, from: string, to: string): number {
  const q = quantities.find((x) => x.id === quantityId)
  const a = q?.units.find((u) => u.id === from)
  const b = q?.units.find((u) => u.id === to)
  if (!a || !b) throw new Error(`Unknown conversion ${quantityId}: ${from} → ${to}`)
  return b.fromBase(a.toBase(value))
}
