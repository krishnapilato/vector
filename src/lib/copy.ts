/**
 * Every interface string lives here (PIANO-V3 §10): plain English, calm, concrete, never
 * "failed", "lazy", "behind" or "overdue". No i18n: the same thing is always called the same way.
 * Content keeps its own language: Trebbi chapter titles stay in Italian.
 */
import type { FocusReason, FocusState } from '../core/focus/focus'
import type { BlockKind, Feeling, Mode, Reason, Window } from '../core/model/schemas'
import type { PlanNote } from '../core/planner/week'
import type { DayPart } from '../core/stats/stats'

const dayFormat = new Intl.DateTimeFormat('en-GB', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
})
const shortDayFormat = new Intl.DateTimeFormat('en-GB', {
  weekday: 'short',
  day: 'numeric',
  month: 'short',
})
const longDateFormat = new Intl.DateTimeFormat('en-GB', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
})

function parse(date: string): Date {
  const [y = 1970, m = 1, d = 1] = date.split('-').map(Number)
  return new Date(y, m - 1, d)
}

export const formatDay = (date: string) => dayFormat.format(parse(date))
export const formatShortDay = (date: string) => shortDayFormat.format(parse(date))
export const formatLongDate = (date: string) => longDateFormat.format(parse(date))

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`

/** A stable pick for the day, so a text doesn't repeat identically every visit (§14 audit). */
export function pickForDay<T>(date: string, options: readonly T[], salt = 0): T {
  let h = salt
  for (const ch of date) h = (h * 31 + ch.charCodeAt(0)) >>> 0
  return options[h % options.length] as T
}

export const copy = {
  app: {
    name: 'Vector',
    tagline: 'A calm study companion for the EASA PPL(A) theory.',
    loading: 'Getting your plan ready…',
  },
  nav: {
    today: 'Today',
    plan: 'Plan',
    logbook: 'Logbook',
    milestones: 'Milestones',
    materials: 'Materials',
    settings: 'Settings',
    main: 'Main',
  },
  kind: {
    reading: 'Reading',
    review: 'Review',
    exercise: 'Exercise',
    quiz: 'Quiz',
    simulator: 'Simulator',
  } satisfies Record<BlockKind, string>,
  mode: {
    desk: 'Desk',
    'on-the-go': 'On the go',
    simulator: 'Simulator',
  } satisfies Record<Mode, string>,
  window: {
    morning: 'Morning',
    lunch: 'Lunch break',
    evening: 'Evening',
    commute: 'On the go',
  } satisfies Record<Window, string>,
  today: {
    greetings: {
      morning: ['Good morning.', 'Morning. Ready when you are.', 'A fresh morning.'],
      afternoon: ['Good afternoon.', 'Afternoon. One block at a time.', 'Hello again.'],
      evening: ['Good evening.', 'Evening. Ready when you are.', 'A quiet evening block?'],
    },
    weekGoal: 'This week',
    weekGoalValue: (done: number, goal: number) => `${done} of ${goal} blocks`,
    next: 'Next block',
    start: 'Start',
    resume: 'Resume',
    resumeHint: 'A session is in progress.',
    more: 'More for today',
    tenMinutes: 'I only have 10 minutes',
    freeDay: 'Today is free. Would you like an extra block?',
    addExtra: 'Add an extra block',
    allDone: 'All of today’s blocks are done. Nice, steady work.',
    simUnlocked: 'You unlocked this week’s flight.',
    simLocked: (n: number) => `Unlocks after ${plural(n, 'more theory block')} this week.`,
    why: 'Why?',
    backupReminder: 'Your last backup is more than two weeks old.',
    backupNever: 'You haven’t made a backup yet.',
    backupAction: 'Back up now',
    weeklyReview: 'Two minutes to look back at the week?',
    weeklyReviewAction: 'Weekly review',
    planUpdated: 'Plan updated',
    milestoneReached: 'Milestone reached',
  },
  block: {
    title: (kind: BlockKind, chapterOrder: number | null, chapterTitle: string | null) => {
      if (kind === 'reading' || kind === 'review')
        return chapterOrder !== null
          ? `Trebbi · Ch. ${chapterOrder} ${chapterTitle ?? ''}`.trim()
          : 'Trebbi'
      if (kind === 'quiz')
        return chapterOrder !== null
          ? `quizppl.it · Ch. ${chapterOrder} ${chapterTitle ?? ''}`.trim()
          : 'quizppl.it'
      return ''
    },
    minutes: (n: number) => `${n} min`,
    lessonObjectives: 'Objectives',
    lessonTolerances: 'Tolerances',
  },
  why: (r: Reason): string => {
    const ch = r.chapter !== null ? `chapter ${r.chapter}` : 'the latest chapter'
    switch (r.code) {
      case 'reading-next':
        return `The next pages of ${ch}, in book order.`
      case 'reading-finish':
        return `This block finishes ${ch}.`
      case 'review':
        return r.clarity !== null && r.clarity <= 3
          ? `A review of ${ch} because you rated it ${r.clarity}/5. Review ${r.count ?? 1} of 3.`
          : `A review two weeks after finishing ${ch} keeps it fresh.`
      case 'quiz':
        return `You read ${ch} and rated it ${r.clarity ?? 3}/5: now a quiz checks it. Never before reading.`
      case 'exercise':
        return 'Practice keeps the theory usable: about a quarter of your week.'
      case 'simulator':
        return `This week’s flight, your reward. It unlocks after ${r.count ?? 3} theory blocks.`
      case 'commute':
        return 'A short look back that fits the train: phone only, no camera.'
      case 'quick':
        return 'Ten minutes fit a quick review or a short exercise.'
      case 'extra':
        return 'An extra block on a free day: the next pages in order.'
    }
  },
  note: (n: PlanNote): string => {
    switch (n.code) {
      case 'moved':
        return `Plan updated: ${plural(n.count, 'skipped block')} moved into this week.`
      case 'not-moved':
        return `${plural(n.count, 'block')} didn’t fit without making the week too heavy, so the finish date moves a little.`
      case 'factor':
        return n.percent < 0
          ? `A lighter week, as you asked (${n.percent}%).`
          : `A slightly fuller week, as you asked (+${n.percent}%).`
      case 'finish':
        return `At this pace you finish the book around ${formatLongDate(n.date)}.`
      case 'target-ok':
        return `On course for your date, ${formatLongDate(n.date)}.`
      case 'target-late':
        return `At this pace the book is done around ${formatLongDate(n.finish)}, after your date of ${formatLongDate(n.date)}. More reading slots would bring it closer.`
      case 'all-read':
        return 'The whole book is read: the plan is reviews, quizzes and practice now.'
      case 'no-time':
        return 'No study time set for the rest of this week. Add some in Settings, or enjoy the break.'
    }
  },
  session: {
    camera: {
      active: 'Camera on, this device only',
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
      distracted: 'Looking away',
      away: 'Lost sight of you',
      tired: 'Break?',
    } satisfies Record<FocusState, string>,
    pausedAway: 'Lost sight of you, timer paused.',
    pausedLeft: 'You left the app for a while, so the timer paused.',
    breakOffer: 'Take 5 minutes, then pick it up again?',
    breakYes: 'Take a break',
    breakNo: 'Keep going',
    reasons: {
      'looking-away': 'Your head has been turned away from the book for a while.',
      'no-face': 'The camera can’t see you.',
      perclos: 'Your eyes have been closing often in the last minute.',
      yawns: 'A few yawns in the last ten minutes.',
      restless: 'More head movement than usual for you.',
      'eyes-closed': 'Your eyes stayed closed for a moment.',
    } satisfies Record<FocusReason, string>,
    pause: 'Pause',
    resume: 'Resume',
    end: 'End',
    endEarlyTitle: 'Log the minutes you did?',
    endEarlyBody: (n: number) => `${plural(n, 'active minute')} so far.`,
    endEarlyYes: 'Log them',
    endEarlyNo: 'Don’t log',
    pageReached: 'I got to page',
    pageHint: 'Optional. It helps the plan keep up with you.',
    noActive: 'No session in progress.',
    goToday: 'Go to Today',
    simIntro: 'Fly in MSFS with the C172, then come back and log the flight.',
    simLog: 'Log the flight',
    onTheGo: 'On the go: no camera, a short block.',
    switchToDesk: 'At your desk? Use the camera',
  },
  wrapUp: {
    title: 'Wrap-up',
    clarity: 'How clear is it now?',
    page: 'Where did you get to?',
    note: 'Note',
    notePlaceholder: 'One line, if you like',
    quiz: 'quizppl.it score',
    quizCorrect: 'Correct',
    quizTotal: 'Questions',
    simOutcome: 'How did it go?',
    simPassed: 'Within tolerances',
    simRepeat: 'Fly it again',
    simDeviations: 'Main deviations',
    simMinutes: 'Minutes flown',
    exerciseClean: 'All answers right?',
    yes: 'Yes',
    no: 'Not yet',
    save: 'Save',
    feedback: (
      minutes: number,
      attention: number | null,
      chapter: number | null,
      percent: number | null,
    ) => {
      const first =
        attention !== null
          ? `${plural(minutes, 'active minute')}, ${attention}% focus.`
          : `${plural(minutes, 'active minute')}.`
      return chapter !== null && percent !== null
        ? `${first} Chapter ${chapter} is ${percent}% done.`
        : first
    },
    backToToday: 'Back to Today',
  },
  clarity: {
    legend: 'How clear is it now?',
    low: 'Still foggy',
    high: 'Crystal clear',
  },
  timer: {
    hiddenHint: 'Hold to see the time',
    hiddenHold: 'for 2 seconds',
    paused: 'Paused',
    left: 'left',
  },
  dialog: { cancel: 'Cancel' },
  plan: {
    title: 'Plan',
    week: 'Week',
    month: 'Month',
    view: 'View',
    previous: 'Previous week',
    next: 'Next week',
    regenerate: 'Regenerate',
    regenerateTitle: 'A new plan for the rest of the week',
    regenerateBody: 'Done blocks stay as they are. This is what changes:',
    regenerateConfirm: 'Use this plan',
    removed: 'Out',
    added: 'In',
    noChange: 'Nothing changes: the plan is already up to date.',
    exportIcs: 'Export to calendar (.ics)',
    exportHint: 'Import the file into Google Calendar: it’s how reminders work without a server.',
    move: 'Move to',
    remove: 'Remove from plan',
    minutes: 'Minutes',
    save: 'Save',
    cancel: 'Cancel',
    empty: 'Nothing planned.',
    monthLoad: (blocks: number) => `${plural(blocks, 'block')} a week`,
    monthChapters: 'Chapters expected',
    monthNone: 'Practice and reviews',
    status: { planned: 'Planned', done: 'Done', skipped: 'Not done', moved: 'Moved' },
  },
  week: {
    title: 'Weekly review',
    intro: 'Two minutes to look back. Optional.',
    blocks: 'Blocks done',
    hours: 'Active hours',
    pages: 'Pages read',
    chapters: 'Chapters finished',
    best: 'Best moment',
    howWasIt: 'How was the week?',
    feelings: { heavy: 'Heavy', right: 'About right', light: 'Light' } satisfies Record<
      Feeling,
      string
    >,
    result: {
      heavy: 'Next week will be about 15% lighter.',
      right: 'Next week keeps the same rhythm.',
      light: 'Next week will be about 10% fuller.',
    } satisfies Record<Feeling, string>,
    save: 'Save',
    done: 'Saved. See you next week.',
    nothing: 'No sessions this week yet. That’s fine: next week starts fresh.',
  },
  logbook: {
    title: 'Logbook',
    minutes: 'min',
    focus: 'focus',
    clarity: 'clarity',
    noFocusData: 'no camera',
    activeTimeLabel: 'Active time',
    focusLabel: 'Focus',
    clarityLabel: 'Clarity',
    totals: 'Totals',
    hoursTotal: 'Active study',
    hoursMonth: 'This month',
    hoursWeek: 'This week',
    simHours: 'Simulator',
    chaptersDone: 'Chapters done',
    hoursUnit: 'h',
    bestHours: 'When you work best',
    bestHoursEmpty: 'Sessions with the camera will show your best hours here.',
    clarityTrend: 'Clarity by subject',
    quizScores: 'Quiz scores by chapter',
    filterSubject: 'Subject',
    filterKind: 'Type',
    all: 'All',
    exportCsv: 'Export CSV',
    emptyTitle: 'No sessions yet',
    emptyBody: 'Every session will appear here, like in a logbook. Start the first one from Today.',
    noMatch: 'No sessions match these filters.',
    dayPart: {
      early: 'Early morning',
      morning: 'Morning',
      afternoon: 'Afternoon',
      evening: 'Evening',
      night: 'Night',
    } satisfies Record<DayPart, string>,
  },
  milestone: {
    title: 'Milestones',
    reached: 'Reached',
    next: 'Next',
    reachedOn: 'Reached on',
    emptyReached: 'Your first milestone comes with your first full session.',
    progress: {
      hours: (v: number, max: number) => `${v} of ${max} h`,
      chapters: (v: number, max: number) => `${v} of ${max} chapters`,
      blocks: (v: number, max: number) => `${v} of ${max} blocks`,
    },
  },
  materials: {
    title: 'Materials',
    book: 'Trebbi',
    exercises: 'Exercises',
    simulator: 'Simulator',
    edition: 'Edition',
    pages: (from: number, to: number) => `p. ${from}–${to}`,
    difficulty: 'Difficulty',
    status: {
      'not-started': 'To start',
      'in-progress': 'In progress',
      done: 'Done',
      review: 'To review',
    },
    sim: { 'not-started': 'To fly', passed: 'Within tolerances', repeat: 'Fly again' },
    attempts: (n: number) => plural(n, 'attempt'),
    perWeek: (n: number) => `${n}× a week`,
    perWeekLabel: 'How often',
    perWeekUnit: '× a week',
    source: 'Source',
    edit: 'Edit',
    save: 'Save',
    cancel: 'Cancel',
    titleField: 'Title',
    subjectField: 'Subject',
    firstPage: 'First page',
    lastPage: 'Last page',
    pageOrderProblem: 'The last page comes before the first one.',
    empty: 'Nothing here yet. Finish the welcome steps to load the starting materials.',
  },
  settings: {
    title: 'Settings',
    availability: 'Weekly availability',
    availabilityHint: 'Blocks of study for each day, and when.',
    addSlot: 'Add a slot',
    removeSlot: 'Remove',
    blocks: 'Blocks',
    days: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'],
    pace: 'Reading pace',
    paceHint: 'Pages in 30 minutes. Measured from your sessions as you go.',
    paceUnit: 'pages',
    blockMinutes: 'Block length',
    minutesUnit: 'min',
    split: 'Book, exercises, simulator',
    splitHint: 'Share of the week for each, in percent.',
    splitBook: 'Book',
    splitExercises: 'Exercises',
    splitSimulator: 'Simulator',
    splitProblem: 'The three shares should add up to 100.',
    targetDate: 'Target date for the theory',
    targetHint: 'Optional. Without a date the plan follows your weekly rhythm.',
    camera: 'Camera',
    cameraHint: 'Analysed on this device only. No images are saved or sent.',
    sensitivity: 'Sensitivity',
    sensitivities: { low: 'Low', normal: 'Normal', high: 'High' },
    station: 'Study station',
    stationHint: 'Each place has its own calibration, e.g. “Bedroom desk”.',
    calibrate: 'Calibrate',
    calibrateBody:
      'Read your book the way you usually do for 20 seconds. Looking down at the page is not a distraction.',
    calibrating: 'Calibrating… keep reading',
    calibrated: (date: string) => `Calibrated on ${date}.`,
    notCalibrated: 'Not calibrated yet: the first desk session starts with it.',
    calibrationFailed: 'The camera didn’t see your face long enough. Try again with more light.',
    check: {
      open: 'Check the camera',
      hint: 'See what the camera picks up and what Vector understands. Only while this panel is open.',
      close: 'Close the check',
      face: 'Face',
      noFace: 'Not seen',
      state: 'Now',
      yaw: 'Head left/right',
      pitch: 'Head up/down',
      eyes: 'Eyes closed',
      mouth: 'Mouth open',
      privacy:
        'The image stays on this device and disappears when you close the check. Nothing is saved.',
    },
    sounds: 'Soft sound at the end',
    showTimer: 'Show the timer all the time',
    pauseWhenAway: 'Pause after 60 s away from the app',
    simUnlock: 'Flight unlocks after',
    simUnlockUnit: 'theory blocks',
    save: 'Save',
    saved: 'Saved.',
    privacy: 'Privacy',
    privacyLink: 'What is analysed, what is saved',
    backup: 'Backup and other devices',
    backupHint:
      'A JSON file with everything, including a session in progress. Send it to your phone and import it there: nothing is ever lost, both sides are merged.',
    passphrase: 'Passphrase',
    passphraseHint:
      'Optional for files, recommended if the file travels by chat or email. At least 5 words.',
    passphraseShort: 'Use at least 5 words or 24 characters.',
    generate: 'Suggest one',
    export: 'Export',
    exported: 'Backup ready.',
    import: 'Import a file',
    importPreview: 'This is what the import adds:',
    importSessions: (n: number) => plural(n, 'new session'),
    importChapters: (n: number) => `${plural(n, 'chapter')} further along`,
    importMilestones: (n: number) => plural(n, 'new milestone'),
    importActive: 'a session in progress, ready to continue',
    importSettings: 'the settings of the other device',
    importNothing: 'Nothing new: this device already has everything in the file.',
    importConfirm: 'Merge',
    imported: 'Merged. Nothing was overwritten.',
    importInvalid: 'This file isn’t a Vector backup, or it is damaged.',
    importTooBig: 'This file is too big to be a Vector backup.',
    importNeedsPassphrase: 'This backup is encrypted: enter its passphrase.',
    wrongPassphrase: 'That passphrase doesn’t open this file.',
    sync: 'Sync between devices',
    syncHint:
      'End-to-end encrypted: the server keeps a sealed copy it cannot read. Use the same passphrase on every device. A forgotten passphrase cannot be recovered.',
    syncOn: 'Turn on sync',
    syncOff: 'Turn off sync',
    syncNow: 'Sync now',
    syncing: 'Syncing…',
    syncEnabled: 'Sync is on for this device.',
    syncLast: (when: string) => `Last synced ${when}.`,
    syncNever: 'Not synced yet.',
    syncDone: 'Synced.',
    syncOffline: 'Offline: it will sync when you’re back online.',
    syncLocked: 'This passphrase opens a different vault. Check it and try again.',
    syncProblem: 'Sync didn’t go through. It will try again on its own.',
    syncDeleteRemote: 'Also delete the sealed copy on the server',
    deleteAll: 'Delete everything',
    deleteAllBody:
      'Every session, the plan and the settings on this device are deleted. This can’t be undone. Make a backup first if you want to keep them.',
    deleteAllConfirm: 'Delete everything',
    deleted: 'Everything on this device is deleted.',
    persistent: 'Storage is protected: the browser won’t clear it on its own.',
    notPersistent:
      'The browser may clear this data when space runs low. Install Vector and keep a backup.',
  },
  welcome: {
    title: 'Welcome to Vector',
    intro: 'Four short steps, all optional. You can change everything later in Settings.',
    step: (n: number) => `Step ${n} of 4`,
    goalTitle: 'Your goal',
    goalBody: 'When would you like to finish the theory? Leave it empty to follow a weekly rhythm.',
    availabilityTitle: 'Your week',
    availabilityBody: 'How many 30-minute blocks fit each day, and when.',
    materialsTitle: 'Your book',
    materialsBody:
      'The Trebbi chapters loaded for the plan. Check pages and difficulty; you can fix them any time in Materials.',
    paceTitle: 'Your pace',
    paceBody:
      'About how many pages do you read in 30 minutes, taking notes? Vector measures it from your sessions afterwards.',
    next: 'Next',
    back: 'Back',
    skip: 'Skip',
    finish: 'Start studying',
    provisional:
      'This is a provisional index: replace it with your edition’s real chapters and pages.',
    haveBackup:
      'Already using Vector on another device? Import its file or turn on sync in Settings.',
  },
  empty: {
    plan: 'The plan appears after the welcome steps.',
  },
  errors: {
    generic: 'Something didn’t work. Your data is safe; try again.',
    quota: 'The device is out of space for Vector. Free some space, or export a backup.',
    upgrade: 'Vector was updated in another tab. Reload this page to continue.',
  },
} as const

export function greeting(now: Date, date: string): string {
  const h = now.getHours()
  const part = h < 12 ? 'morning' : h < 18 ? 'afternoon' : 'evening'
  return pickForDay(date, copy.today.greetings[part])
}

export function relativeTime(ms: number, now = Date.now()): string {
  const minutes = Math.round((now - ms) / 60_000)
  if (minutes < 1) return 'just now'
  if (minutes < 60) return `${minutes} min ago`
  const hours = Math.round(minutes / 60)
  if (hours < 24) return `${plural(hours, 'hour')} ago`
  return `${plural(Math.round(hours / 24), 'day')} ago`
}
