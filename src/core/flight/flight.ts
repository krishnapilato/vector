/**
 * Flight calculations for study and practice. Pure functions, SI-free aviation units:
 * knots, feet, degrees, hPa, litres. Every rule of thumb is named as such.
 * Not for real flight planning: always use the aircraft's flight manual and official data.
 */

const rad = (deg: number) => (deg * Math.PI) / 180
const deg = (r: number) => (r * 180) / Math.PI

/** Normalizes any angle to 0..359.x */
export function normalize360(angle: number): number {
  return ((angle % 360) + 360) % 360
}

export interface WindTriangle {
  /** Wind correction angle, degrees: positive = turn right. */
  wca: number
  trueHeading: number
  groundSpeed: number
}

/**
 * Wind triangle. `windFrom` is the direction the wind blows FROM, as in a METAR.
 * Returns null when the wind is too strong to hold the course.
 */
export function windTriangle(
  trueCourse: number,
  tas: number,
  windFrom: number,
  windSpeed: number,
): WindTriangle | null {
  if (tas <= 0) return null
  const angle = rad(windFrom - trueCourse)
  const s = (windSpeed * Math.sin(angle)) / tas
  if (Math.abs(s) > 1) return null
  const wca = Math.asin(s)
  return {
    wca: deg(wca),
    trueHeading: normalize360(trueCourse + deg(wca)),
    groundSpeed: tas * Math.cos(wca) - windSpeed * Math.cos(angle),
  }
}

export interface WindComponents {
  /** Positive = headwind, negative = tailwind. */
  headwind: number
  /** Positive = from the right, negative = from the left. */
  crosswind: number
}

export function windComponents(
  runwayHeading: number,
  windFrom: number,
  windSpeed: number,
): WindComponents {
  const angle = rad(windFrom - runwayHeading)
  return { headwind: windSpeed * Math.cos(angle), crosswind: windSpeed * Math.sin(angle) }
}

/** Runway designator "27" → 270°. */
export function runwayToHeading(designator: number): number {
  return normalize360(designator * 10)
}

/** Pressure altitude from field elevation and QNH. Rule of thumb: `ftPerHpa` (30 in many PPL texts, 27 near sea level). */
export function pressureAltitude(elevationFt: number, qnh: number, ftPerHpa = 30): number {
  return elevationFt + (1013.25 - qnh) * ftPerHpa
}

/** ISA temperature in the troposphere: 15 °C at sea level, −1.98 °C per 1000 ft, floor −56.5 °C. */
export function isaTemperature(pressureAltitudeFt: number): number {
  return Math.max(-56.5, 15 - 1.98 * (pressureAltitudeFt / 1000))
}

/** Density altitude, rule of thumb: +120 ft for every °C above ISA. */
export function densityAltitude(pressureAltitudeFt: number, oat: number): number {
  return pressureAltitudeFt + 120 * (oat - isaTemperature(pressureAltitudeFt))
}

/** Relative density σ in the ISA troposphere at a given density altitude. */
export function densityRatio(densityAltitudeFt: number): number {
  return (1 - 6.8756e-6 * densityAltitudeFt) ** 4.2559
}

/** CAS → TAS, ignoring compressibility (fine at light-aircraft speeds). */
export function trueAirspeed(cas: number, densityAltitudeFt: number): number {
  return cas / Math.sqrt(densityRatio(densityAltitudeFt))
}

/** Time in minutes for a distance (NM) at a ground speed (kt). */
export function flightTimeMinutes(distanceNm: number, groundSpeedKt: number): number | null {
  return groundSpeedKt > 0 ? (distanceNm / groundSpeedKt) * 60 : null
}

export function distanceNm(groundSpeedKt: number, minutes: number): number {
  return (groundSpeedKt * minutes) / 60
}

export function groundSpeedKt(distanceNm: number, minutes: number): number | null {
  return minutes > 0 ? (distanceNm / minutes) * 60 : null
}

export interface FuelPlan {
  tripLitres: number
  reserveLitres: number
  requiredLitres: number
  /** Fuel on board minus required: negative means not enough. */
  marginLitres: number
  enduranceMinutes: number
}

export function fuelPlan(o: {
  burnLitresPerHour: number
  tripMinutes: number
  reserveMinutes: number
  taxiLitres: number
  onBoardLitres: number
}): FuelPlan | null {
  if (o.burnLitresPerHour <= 0) return null
  const perMin = o.burnLitresPerHour / 60
  const tripLitres = perMin * o.tripMinutes
  const reserveLitres = perMin * o.reserveMinutes
  const requiredLitres = tripLitres + reserveLitres + o.taxiLitres
  return {
    tripLitres,
    reserveLitres,
    requiredLitres,
    marginLitres: o.onBoardLitres - requiredLitres,
    enduranceMinutes: Math.max(0, o.onBoardLitres - o.taxiLitres) / perMin,
  }
}

export interface MassItem {
  name: string
  mass: number
  arm: number
}

export interface MassBalance {
  mass: number
  moment: number
  /** Centre of gravity, same unit as the arms; null with zero mass. */
  cg: number | null
  withinMass: boolean | null
  withinCg: boolean | null
}

export function massBalance(
  items: readonly MassItem[],
  limits: { maxMass?: number; cgMin?: number; cgMax?: number } = {},
): MassBalance {
  const mass = items.reduce((s, i) => s + i.mass, 0)
  const moment = items.reduce((s, i) => s + i.mass * i.arm, 0)
  const cg = mass > 0 ? moment / mass : null
  const { maxMass, cgMin, cgMax } = limits
  return {
    mass,
    moment,
    cg,
    withinMass: maxMass === undefined ? null : mass <= maxMass,
    withinCg:
      cg === null || cgMin === undefined || cgMax === undefined ? null : cg >= cgMin && cg <= cgMax,
  }
}

export const AVGAS_KG_PER_LITRE = 0.72
