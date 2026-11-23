export function sessionProgress(session, now = Date.now()) {
  if (!session?.startedAt) return -1;
  if (session.phaseOffset != null) return session.phaseOffset;
  const start = session.startedAt.toMillis?.() ?? session.startedAt;
  const closed = session.closedAt?.toMillis?.() ?? session.closedAt;
  // Freeze legacy sessions at the transition to manual progression.
  return Math.max(0, (Math.min(closed ?? now, Date.UTC(2026,10,23,22,42)) - start) / 1000);
}
