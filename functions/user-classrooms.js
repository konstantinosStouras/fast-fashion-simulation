const labNames = {openai: 'OpenAI', anthropic: 'Anthropic', google: 'Google'};

// Server timestamps and the local rehearsal's millisecond times describe the
// same 18-minute session. Scoring ends before the two-minute comparison.
export function classroomClock(session, now = Date.now()) {
  if (session.status !== 'running') return {status: session.status, currentPhase: null};
  const start = session.startedAt?.toMillis?.() ?? session.startedAt;
  if (!Number.isFinite(start)) return {status: 'running', currentPhase: null};
  const seconds = (now - start) / 1000;
  if (seconds < 0) return {status: 'running', currentPhase: null};
  if (seconds >= 1080) return {status: 'completed', currentPhase: null};
  if (seconds >= 960) return {status: 'running', currentPhase: 'comparison'};
  return {status: 'running', currentPhase: seconds >= 180 ? 'main' : 'practice'};
}

export function summarizeUserClassroom(session, uid, joined, now = Date.now()) {
  const mode = session.mode || 'individual';
  const waiting = session.status === 'lobby';
  const plannedNumber = Object.hasOwn(session.teamComposition || {}, uid) ? session.teamComposition[uid] : null;
  if (session.deletedAt || (!joined && !(waiting && mode === 'team' && plannedNumber))) return null;

  const captain = Object.hasOwn(session.assignments || {}, uid) ? session.assignments[uid] : null;
  const namedTeam = captain && Object.hasOwn(session.teamNames || {}, captain) ? session.teamNames[captain] : null;
  const team = mode !== 'team' ? null : waiting && session.teamComposition != null
    ? (plannedNumber ? 'Team ' + plannedNumber : null)
    : namedTeam;
  const rival = session.teamOpponents?.[captain];
  const hasHumanRival = mode === 'team' && !!namedTeam && (session.teamOpponents == null
    ? Object.keys(session.teamNames || {}).length > 1 : rival != null && Object.hasOwn(session.teamNames || {}, rival));
  function opponent(phase) {
    if (mode === 'team' && !team) return waiting ? 'Awaiting team assignment' : 'Unassigned';
    if (session.aiOpponent?.[phase]) {
      const {provider, model} = session.aiOpponent;
      return ['AI opponent', labNames[provider] || provider, model].filter(Boolean).join(' · ');
    }
    if (mode !== 'team') return 'Individual play';
    if (waiting) return 'Awaiting draw';
    if (session.teamOpponents == null) return hasHumanRival ? 'Classroom market' : 'Individual play';
    if (rival === null) return 'Bye · individual play';
    if (rival === undefined) return 'Opponent unavailable';
    return session.teamNames[rival] || 'Opponent unavailable';
  }
  const {status, currentPhase} = classroomClock(session, now);
  const practiceOpponent = opponent('practice'), mainOpponent = opponent('main');
  const activePhase = currentPhase === 'practice' || currentPhase === 'main';
  const matchup = currentPhase === 'practice' ? practiceOpponent : mainOpponent;
  const hasRival = (mode !== 'team' || team != null) && (session.aiOpponent?.[currentPhase] || hasHumanRival);
  return {code: session.code, name: session.name, mode, status, joined, team, practiceOpponent,
    mainOpponent, currentPhase, activeOpponent: joined && activePhase && hasRival ? matchup : null};
}
