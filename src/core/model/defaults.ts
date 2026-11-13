import type { Settings } from './schemas'

/** Usable from the first second: no onboarding (PIANO-V3-LITE §1). */
export function defaultSettings(): Settings {
  return {
    id: 'default',
    defaultDurationMin: 30,
    alwaysShowTimer: false,
    soundEnabled: true,
    cameraEnabledByDefault: true,
    sensitivity: 'normal',
    activeCalibrationId: null,
  }
}

/** Durations offered on the Focus screen, in minutes; 0 means Open (a stopwatch). */
export const durations = [25, 30, 45, 60, 0] as const
