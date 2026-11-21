const histories = new Map();
const MAX_ITEMS = 30;
const MAX_SESSIONS = 500;

function trimSessions() {
  if (histories.size <= MAX_SESSIONS) return;
  const oldest = histories.keys().next().value;
  if (oldest) histories.delete(oldest);
}

export function recordSend(sessionId, item) {
  const history = histories.get(sessionId) ?? [];
  history.unshift(item);
  histories.set(sessionId, history.slice(0, MAX_ITEMS));
  trimSessions();
}

export function findSend(sessionId, emailId) {
  const history = histories.get(sessionId) ?? [];
  return history.find((item) => item.id === emailId) ?? null;
}

export function updateSend(sessionId, emailId, patch) {
  const history = histories.get(sessionId) ?? [];
  const item = history.find((entry) => entry.id === emailId);
  if (!item) return null;
  Object.assign(item, patch);
  return item;
}

export function listSends(sessionId) {
  return [...(histories.get(sessionId) ?? [])];
}
