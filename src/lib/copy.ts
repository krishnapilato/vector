/**
 * Every interface string lives here (PIANO-V3 §10): plain English, calm, concrete.
 * No i18n: the same thing is always called the same way.
 */
export const copy = {
  app: {
    name: 'Vector',
    building: 'Vector is being rebuilt. Ready soon.',
  },
  camera: {
    active: 'Camera on, this device only',
    paused: 'Camera paused',
    off: 'Camera off',
  },
  timer: {
    hiddenHint: 'Hold to see the time',
    hiddenHold: 'for 2 seconds',
    paused: 'Paused',
    left: 'left',
  },
  clarity: {
    legend: 'How clear is it now?',
    low: 'Still foggy',
    high: 'Crystal clear',
  },
  dialog: {
    cancel: 'Cancel',
  },
  logbook: {
    minutes: 'min',
    focus: 'focus',
    clarity: 'clarity',
    noFocusData: 'no camera',
    activeTimeLabel: 'Active time',
    focusLabel: 'Focus',
    clarityLabel: 'Clarity',
  },
  milestone: {
    reachedOn: 'Reached on',
    next: 'Next',
  },
} as const
