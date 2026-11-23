// The values also identify stages in the original saved market model.
const phaseOffsets = [0, 90, 180, 420, 540, 660, 810, 960];


export function hasHomeTeamPractice(session) {
  return session?.mode === 'team' && (session.status === 'lobby' || session.teamPractice === true);
}

export function nextPhaseOffset(progress) {
  return phaseOffsets.find(offset => offset > progress) ?? null;
}

// The deployment migration freezes timed classrooms at the stage open when
// manual stage rules reached production.
export function legacyPhaseOffset(startedAt, cutover) {
  const seconds = Math.max(0, (cutover - startedAt) / 1000);
  return phaseOffsets.filter(offset => offset <= seconds).at(-1);
}

export function sessionProgress(session) {
  if (session?.startedAt == null) return -1;
  if (session.phaseOffset != null) return session.phaseOffset;
  const start = session.startedAt.toMillis?.() ?? session.startedAt;
  const closed = session.closedAt?.toMillis?.() ?? session.closedAt;
  // The rollout migrates open rooms. A closed timed room has an immutable end.
  return closed == null ? -1 : Math.max(0, (closed - start) / 1000);
}
