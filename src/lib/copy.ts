/**
 * Every interface string lives here (PIANO-V3-LITE §6.1): direct, sober English that never judges.
 * No "failed", "lazy", "overdue" or "streak lost", no exclamation marks, no i18n.
 */
import type { Evidence, FocusState, Signal } from '../core/focus/focus'
import type { Sensitivity } from '../core/model/schemas'

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`

const dateTime = new Intl.DateTimeFormat('en-GB', {
  weekday: 'short',
  day: 'numeric',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
})

export const formatDateTime = (ms: number) => dateTime.format(new Date(ms))

export const copy = {
  app: {
    name: 'Vector',
    tagline: 'Open Vector, press Start, focus well. Everything stays on your device.',
    loading: 'Loading…',
  },
  nav: { focus: 'Focus', logbook: 'Logbook', settings: 'Settings', main: 'Main' },
  focus: {
    title: 'Focus',
    ready: 'Ready when you are.',
    tagLabel: 'What are you working on?',
    tagPlaceholder: 'e.g. Linear algebra, Essay draft',
    running: 'Session running',
    duration: 'Length',
    durationLabel: (min: number) => (min === 0 ? 'Open' : `${min}m`),
    camera: 'Camera focus tracking',
    start: 'Start',
    calibrating: 'Look at your work the way you usually do. 15 seconds.',
    calibrationSkip: 'Skip',
    calibrationDone: 'Calibrated. Starting.',
    calibrationFailed:
      'The camera didn’t see your face long enough, so the session starts without a calibration.',
    pause: 'Pause',
    resume: 'Resume',
    end: 'End',
  },
  camera: {
    active: 'Camera active · Local only',
    paused: 'Camera paused',
    off: 'Camera off',
    starting: 'Starting the camera…',
    denied:
      'The camera is blocked, so this session runs without it. You can allow it in the browser settings.',
    unavailable: 'No camera found. The session runs without it.',
    model: 'The focus model didn’t load. The session runs without the camera.',
  },
  state: {
    focused: 'Focused',
    'micro-distraction': 'Focused',
    distracted: 'Away',
    absent: 'Away',
    fatigued: 'Break suggested',
  } satisfies Record<FocusState, string>,
  pausedAway: 'Away for 60s — timer paused automatically.',
  pausedLeft: 'You left the tab for a while, so the timer paused.',
  breakOffer: 'Take 5 minutes to rest your eyes?',
  breakYes: 'Take break',
  breakNo: 'Keep going',
  why: 'Why?',
  /** One line naming the signals behind a break suggestion (§2.4). */
  explain: (signals: readonly Signal[], e: Evidence): string => {
    const parts: string[] = []
    if (signals.includes('yawns')) parts.push(plural(e.yawns, 'yawn'))
    if (signals.includes('perclos') || signals.includes('eye-closure'))
      parts.push(`heavy eyelids (${Math.round(e.perclos * 100)}% of the last minute)`)
    if (signals.includes('restless')) parts.push('more head movement than usual')
    if (signals.includes('off-task-gaze')) parts.push('looking away from your work')
    if (signals.includes('no-face')) parts.push('the camera couldn’t see you')
    if (parts.length === 0) return 'Nothing unusual right now.'
    const sentence = parts.join(' and ')
    return `${sentence.charAt(0).toUpperCase()}${sentence.slice(1)} in the last ${signals.includes('yawns') ? '10 minutes' : 'minute'}.`
  },
  timer: {
    tapToSee: 'Tap to see the time',
    paused: 'Paused',
    left: 'left',
    elapsed: 'so far',
  },
  wrapUp: {
    title: 'Wrap-up',
    summary: (activeSeconds: number, focusPct: number | null) =>
      `${Math.round(activeSeconds / 60)} active min${focusPct === null ? '' : ` · ${focusPct}% focus`}`,
    rating: 'How did it go?',
    ratingLow: 'Rough',
    ratingHigh: 'Great',
    note: 'Note',
    notePlaceholder: 'Optional, e.g. Stopped at page 124',
    save: 'Save to logbook',
    discard: 'Discard',
  },
  logbook: {
    title: 'Logbook',
    weekHours: 'This week',
    weekSessions: 'Sessions',
    averageFocus: 'Avg. focus',
    allTime: 'All time',
    hoursUnit: 'h',
    filter: 'Filter by tag or note',
    exportCsv: 'Export CSV',
    empty: 'Every session will appear here. Start the first one from Focus.',
    noMatch: 'No sessions match this filter.',
    untitled: 'Untitled',
    minutes: (n: number) => `${n} min`,
    focus: (pct: number) => `${pct}% focus`,
    fatigue: (n: number) => (n === 0 ? 'no fatigue hints' : plural(n, 'fatigue hint')),
    noCamera: 'no camera',
    rating: (n: number) => `${n}/5`,
  },
  settings: {
    title: 'Settings',
    sections: 'Section',
    session: 'Session',
    cameraTab: 'Camera',
    dataTab: 'Data',
    privacyTab: 'Privacy',
    defaultDuration: 'Default length',
    alwaysShowTimer: 'Always show the timer',
    sound: 'Soft sound at the end',
    camera: 'Camera and detection',
    cameraDefault: 'Camera on by default',
    cameraHint:
      'Frames are analysed on this device and dropped at once. No image is saved or sent.',
    sensitivity: 'Sensitivity',
    sensitivities: { low: 'Low', normal: 'Normal', high: 'High' } satisfies Record<
      Sensitivity,
      string
    >,
    profiles: 'Posture profiles',
    profileHint: 'One calibration per workstation, e.g. Desk or Laptop.',
    activeProfile: 'Active profile',
    profileName: 'New profile name',
    calibrate: 'Calibrate posture (15s)',
    calibrating: 'Calibrating… look at your work as usual',
    calibrated: (label: string) => `${label} is calibrated and active.`,
    calibrationFailed: 'The camera didn’t see your face long enough. Try again with more light.',
    noProfiles: 'No posture profile yet. The first camera session creates one.',
    data: 'Data and backup',
    backupHint:
      'One JSON file with every session, profile and setting. A passphrase encrypts it on this device.',
    passphrase: 'Passphrase (optional)',
    passphraseShort: 'Use at least 5 words or 24 characters.',
    export: 'Export backup',
    import: 'Import backup',
    imported: (n: number) =>
      `Imported. ${plural(n, 'new session')} added; nothing was overwritten.`,
    importInvalid: 'This file isn’t a Vector backup, or it is damaged.',
    importNeedsPassphrase: 'This backup is encrypted: enter its passphrase, then import again.',
    wrongPassphrase: 'That passphrase doesn’t open this file.',
    deleteAll: 'Delete all data',
    deleteConfirm1: 'Delete every session, profile and setting on this device?',
    deleteConfirm2: 'This can’t be undone. Export a backup first if you want to keep anything.',
    deleteYes: 'Continue',
    deleteFinal: 'Delete all data',
    deleted: 'Everything on this device is deleted.',
    persistent: 'Storage is protected: the browser won’t clear it on its own.',
    notPersistent:
      'The browser may clear this data when space runs low. Install Vector and keep a backup.',
    saved: 'Saved.',
  },
  privacy: {
    title: 'Privacy & Security Manifesto',
    /** Plain words, each one checkable in the code. */
    items: [
      {
        title: 'No server, no account',
        body: 'Vector is a static site. Everything it knows lives in this browser (IndexedDB).',
      },
      {
        title: 'Frames never leave the device',
        body: 'The camera image is analysed in memory by a face model served by Vector itself, then dropped at once. No image is saved, recorded or sent.',
      },
      {
        title: 'Only numbers are kept',
        body: 'Per session: active minutes, seconds focused or away, distractions, fatigue hints, breaks and a focus percentage. Calibration keeps the average head angles of your working posture.',
      },
      {
        title: 'The browser enforces it',
        body: 'A Content Security Policy lets the page talk to its own address only, so nothing could be sent elsewhere, even by mistake.',
      },
      {
        title: 'No emotion reading',
        body: 'Tiredness hints come from eyelids, yawns and head movement, never from facial expressions.',
      },
      {
        title: 'Your backup, your key',
        body: 'Backup files are encrypted on this device when you set a passphrase. The passphrase is never stored.',
      },
      {
        title: 'Open source',
        body: 'Every line is public and written to be read, so anyone can check each promise above.',
      },
    ],
  },
  clarity: { legend: 'How did it go?', low: 'Rough', high: 'Great' },
  dialog: { cancel: 'Cancel' },
  errors: {
    generic: 'Something didn’t work. Your data is safe; try again.',
    quota: 'The device is out of space for Vector. Free some space, or export a backup.',
  },
} as const
