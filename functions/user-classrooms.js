const labNames = {openai: 'OpenAI', anthropic: 'Anthropic', google: 'Google'};

import {hasHomeTeamPractice, sessionProgress} from './session-progress.js?v=home-practice-1';

export function classroomStatus(session) {
  if (session.status !== 'running') return {status: session.status, currentPhase: null};
  const start = session.startedAt?.toMillis?.() ?? session.startedAt;
  if (!Number.isFinite(start)) return {status: 'running', currentPhase: null};
  const seconds = sessionProgress(session);
  if (seconds < 0) return {status: 'running', currentPhase: null};
  if (seconds >= 960) return {status: 'completed', currentPhase: null};
  return {status: 'running', currentPhase: seconds >= 180 ? 'main' : 'practice'};
}

export function summarizeUserClassroom(session, uid, joined) {
  const mode = session.mode || 'individual';
  const waiting = session.status === 'lobby';
  const plannedNumber = Object.hasOwn(session.teamComposition || {}, uid) ? session.teamComposition[uid] : null;
  if (session.deletedAt || (!joined && !(waiting && mode === 'team' && plannedNumber))) return null;

  const captain = Object.hasOwn(session.assignments || {}, uid) ? session.assignments[uid] : null;
  const namedTeam = captain && Object.hasOwn(session.teamNames || {}, captain) ? session.teamNames[captain] : null;
  const team = mode !== 'team' ? null : waiting && session.teamComposition != null
    ? (plannedNumber ? 'Team ' + plannedNumber : namedTeam)
    : namedTeam;
  const rival = session.teamOpponents?.[captain];
  const hasHumanRival = mode === 'team' && !!namedTeam && (session.teamOpponents == null
    ? Object.keys(session.teamNames || {}).length > 1 : rival != null && Object.hasOwn(session.teamNames || {}, rival));
  function opponent(phase) {
    if (phase === 'practice' && hasHomeTeamPractice(session)) return 'AI practice opponent';
    if (mode === 'team' && !team) return waiting ? 'Awaiting team assignment' : 'Unassigned';
    if (!hasHomeTeamPractice(session) && session.aiOpponent?.[phase]) {
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
  const {status, currentPhase} = classroomStatus(session);
  const practiceOpponent = opponent('practice'), mainOpponent = opponent('main');
  const activePhase = currentPhase === 'practice' || currentPhase === 'main';
  const matchup = currentPhase === 'practice' ? practiceOpponent : mainOpponent;
  const hasRival = (mode !== 'team' || team != null) && (session.aiOpponent?.[currentPhase] || hasHumanRival || (currentPhase==='main' && rival===null && session.oddTeamAi));
  return {code: session.code, name: session.name, mode, status, joined, team, practiceOpponent,
    mainOpponent, currentPhase, activeOpponent: joined && activePhase && hasRival ? matchup : null};
}
