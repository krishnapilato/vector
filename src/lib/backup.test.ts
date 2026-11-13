/** Backup → delete everything → restore gives back identical data (PIANO-V3 F7). */
import 'fake-indexeddb/auto'
import { describe, expect, it } from 'vitest'
import exercises from '../content/exercises.json'
import sim from '../content/sim-lessons.json'
import trebbi from '../content/trebbi.json'
import { parseContent } from '../core/model/content'
import { Snapshot } from '../core/model/schemas'
import { decryptFile, encryptFile } from './crypto'
import {
  completeOnboarding,
  deleteEverything,
  ensurePlan,
  exportSnapshot,
  finishSession,
  mergeIn,
  startBlock,
} from './repo'

const strip = (s: Snapshot) => ({ ...s, exportedAt: 0 })

describe('backup and restore', () => {
  it('restores exactly what was exported, through an encrypted file', async () => {
    await completeOnboarding(parseContent(trebbi, exercises, sim), { pagesPer30: 7 })
    const plan = await ensurePlan('2026-11-16')
    const block = plan?.blocks[0]
    if (!block) throw new Error('No block planned')
    const active = await startBlock(block, Date.now() - 31 * 60_000)
    await finishSession(
      active,
      {
        clarity: 4,
        pageReached: block.pageTo,
        note: 'Clear enough',
        quizScore: null,
        simOutcome: null,
        simDeviations: '',
        exerciseClean: null,
        minutesOverride: null,
      },
      null,
    )

    const before = await exportSnapshot()
    expect(before.data.sessions).toHaveLength(1)
    const file = JSON.stringify(
      await encryptFile(JSON.stringify(before), 'oak river comet amber willow'),
    )

    await deleteEverything()
    expect((await exportSnapshot()).data.sessions).toHaveLength(0)

    const envelope = JSON.parse(file)
    const restored = Snapshot.parse(
      JSON.parse(await decryptFile(envelope, 'oak river comet amber willow')),
    )
    await mergeIn(restored)

    const after = await exportSnapshot()
    const sort = (s: Snapshot) => ({
      ...strip(s),
      data: Object.fromEntries(
        Object.entries(s.data).map(([k, v]) => [
          k,
          [...v].sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b))),
        ]),
      ),
    })
    expect(sort(after)).toEqual(sort(before))
  })
})
