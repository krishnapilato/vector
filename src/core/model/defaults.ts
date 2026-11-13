import type { Availability, Settings } from './schemas'

/** A typical week to start from; Welcome step 2 adjusts it. */
export const defaultAvailability: Availability = [
  [
    { window: 'commute', blocks: 1 },
    { window: 'evening', blocks: 1 },
  ],
  [{ window: 'evening', blocks: 1 }],
  [
    { window: 'commute', blocks: 1 },
    { window: 'evening', blocks: 1 },
  ],
  [{ window: 'evening', blocks: 1 }],
  [{ window: 'commute', blocks: 1 }],
  [{ window: 'morning', blocks: 2 }],
  [{ window: 'morning', blocks: 1 }],
]

export function defaultSettings(): Settings {
  return {
    id: 'settings',
    onboarded: false,
    bookEdition: '',
    targetDate: null,
    availability: defaultAvailability,
    pagesPer30: 6,
    blockMinutes: 30,
    split: { book: 0.6, exercises: 0.25, simulator: 0.15 },
    simUnlockAfter: 3,
    camera: false,
    sensitivity: 'normal',
    station: 'Desk',
    sounds: true,
    alwaysShowTimer: false,
    pauseWhenAway: true,
    lastBackupAt: null,
  }
}
