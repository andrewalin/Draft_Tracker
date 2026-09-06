(() => {
function getPlayerStatusFromMap(player, statusByFileName) {
  return statusByFileName[player.fileName] || "available";
}

function getRosterCounts(players, statusByFileName, positions) {
  const counts = Object.fromEntries(positions.map((position) => [position, 0]));
  let total = 0;

  players.forEach((player) => {
    if (getPlayerStatusFromMap(player, statusByFileName) !== "me") return;

    const position = player.position || "NA";
    counts[position] = (counts[position] || 0) + 1;
    total += 1;
  });

  return { ...counts, total };
}

function getCurrentRound(players, statusByFileName) {
  return getRosterCounts(players, statusByFileName, []).total + 1;
}

function matchesPlayerSearch(player, query) {
  if (!query) return true;

  const compactQuery = compactSearch(query);
  return player.searchText.includes(query) || (compactQuery && player.compactSearchText.includes(compactQuery));
}

function getPlanStatus(checkpoint, currentRound, rosterCounts) {
  const checkpointRound = getCheckpointRound(checkpoint.label);
  const range = getCheckpointRange(checkpoint.label);
  const requirementsMet = areRequirementsMet(checkpoint.requirements, rosterCounts);
  const isCurrent = checkpointRound === currentRound || (range && currentRound >= range.start && currentRound <= range.end);

  if (requirementsMet && isCurrent) return "is-active is-complete";
  if (requirementsMet) return "is-complete";
  if (isCurrent) return "is-active";
  if (checkpointRound && currentRound > checkpointRound && checkpoint.requirements) return "is-missed";
  if (range && currentRound > range.end && checkpoint.requirements) return "is-missed";

  return "";
}

function areRequirementsMet(requirements, rosterCounts) {
  if (!requirements) return false;

  const positionRequirementsMet = Object.entries(requirements.positions || {}).every(
    ([position, minimum]) => (rosterCounts[position] || 0) >= minimum,
  );
  const groupRequirementsMet = (requirements.groups || []).every(
    (group) => group.positions.reduce((total, position) => total + (rosterCounts[position] || 0), 0) >= group.minimum,
  );

  return positionRequirementsMet && groupRequirementsMet;
}

function getCheckpointRound(label) {
  const match = /^By R(\d+)$/.exec(label);
  return match ? Number(match[1]) : null;
}

function getCheckpointRange(label) {
  const match = /^R(\d+)-(\d+)$/.exec(label);
  return match ? { start: Number(match[1]), end: Number(match[2]) } : null;
}

function normalizeSearch(value) {
  return String(value)
    .trim()
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^\w]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function compactSearch(value) {
  return String(value).replace(/[^a-z0-9]+/g, "");
}

window.DraftHelpers = {
  compactSearch,
  getCheckpointRound,
  getCurrentRound,
  getPlanStatus,
  getPlayerStatusFromMap,
  getRosterCounts,
  matchesPlayerSearch,
  normalizeSearch,
};
})();
