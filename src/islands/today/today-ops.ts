/** Everything Today needs beyond reading the database, loaded right after first paint. */
export { evaluateMilestones } from '../../core/milestones/milestones'
export { extraBlock, quickBlock, theoryDoneThisWeek } from '../../core/planner/week'
export { reviewDue } from '../../core/stats/stats'
export {
  addBlock,
  ensurePlan,
  markMilestonesSeen,
  plannerInput,
  startBlock,
  weeklyGoal,
} from '../../lib/repo'
