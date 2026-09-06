const DATA_SOURCE_CONFIG = window.DataSourceConfig || {};
const CSV_URL = DATA_SOURCE_CONFIG.csvUrl || "players.csv";
const STORAGE_KEY = "draft-tracker-status-v1";
const DRAFT_ORDER_STORAGE_KEY = "draft-tracker-draft-order-v1";
const SCORING_STORAGE_KEY = "draft-tracker-scoring-v1";
const POSITIONS = ["QB", "RB", "WR", "TE"];
const MAX_RENDERED_ROWS = 150;
const DraftHelpers = (() => {
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

  return {
    compactSearch,
    getCurrentRound,
    getPlanStatus,
    getPlayerStatusFromMap,
    getRosterCounts,
    matchesPlayerSearch,
    normalizeSearch,
  };
})();
const {
  compactSearch,
  getCurrentRound,
  getPlanStatus,
  getPlayerStatusFromMap,
  getRosterCounts,
  matchesPlayerSearch,
  normalizeSearch,
} = DraftHelpers;
const SCORING_MODES = [
  ...(DATA_SOURCE_CONFIG.scoringModes || []),
];
const DRAFT_PLAN_CONFIG = window.DraftPlanConfig || { plans: {}, rosterTargets: {} };

const els = {
  loadStatus: document.querySelector("#loadStatus"),
  currentRound: document.querySelector("#currentRound"),
  availableCount: document.querySelector("#availableCount"),
  mineCount: document.querySelector("#mineCount"),
  competitorCount: document.querySelector("#competitorCount"),
  helpButton: document.querySelector("#helpButton"),
  helpCloseButton: document.querySelector("#helpCloseButton"),
  helpDialog: document.querySelector("#helpDialog"),
  undoButton: document.querySelector("#undoButton"),
  scoringMenuButton: document.querySelector("#scoringMenuButton"),
  scoringMenu: document.querySelector("#scoringMenu"),
  activeScoringLabel: document.querySelector("#activeScoringLabel"),
  searchInput: document.querySelector("#searchInput"),
  statusFilterButtons: [...document.querySelectorAll("[data-filter]")],
  positionFilterButtons: [...document.querySelectorAll("[data-position-filter]")],
  draftPlanTitle: document.querySelector("#draftPlanTitle"),
  draftPlanNote: document.querySelector("#draftPlanNote"),
  draftPlanList: document.querySelector("#draftPlanList"),
  myDraftList: document.querySelector("#myDraftList"),
  myDraftTotal: document.querySelector("#myDraftTotal"),
  positionGrid: document.querySelector("#positionGrid"),
  rosterList: document.querySelector("#rosterList"),
  rosterTotal: document.querySelector("#rosterTotal"),
  resultCount: document.querySelector("#resultCount"),
  valueHeader: document.querySelector("#valueHeader"),
  playerRows: document.querySelector("#playerRows"),
};

let players = [];
let statusByFileName = loadStatuses();
let draftOrder = loadDraftOrder();
let statusHistory = [];
let activeFilter = "available";
let activePositionFilter = "all";
let activeScoringKey = loadScoringMode();

init();

async function init() {
  try {
    if (!SCORING_MODES.length) throw new Error("DataSourceConfig.scoringModes must include at least one scoring mode.");
    const response = await fetch(CSV_URL);
    if (!response.ok) throw new Error(`CSV request failed: ${response.status}`);
    const csvText = await response.text();
    players = parseCsv(csvText).map(normalizePlayer).filter((player) => player.fileName);
    sortPlayers();
    reconcileDraftOrder();

    els.loadStatus.textContent = `Loaded ${players.length} players from ${DATA_SOURCE_CONFIG.sourceLabel || CSV_URL}`;
    bindEvents();
    render();
  } catch (error) {
    els.loadStatus.textContent = `Could not load ${CSV_URL}. Run this folder through a local web server.`;
    console.error(error);
  }
}

function bindEvents() {
  renderScoringMenu();
  els.searchInput.addEventListener("input", render);
  els.helpButton.addEventListener("click", () => els.helpDialog.showModal());
  els.helpCloseButton.addEventListener("click", () => els.helpDialog.close());
  els.helpDialog.addEventListener("click", (event) => {
    if (event.target === els.helpDialog) els.helpDialog.close();
  });
  els.undoButton.addEventListener("click", undoLastStatusChange);

  els.scoringMenuButton.addEventListener("click", () => {
    const isOpen = els.scoringMenuButton.getAttribute("aria-expanded") === "true";
    setMenuOpen(!isOpen);
  });

  els.scoringMenu.addEventListener("click", (event) => {
    const button = event.target.closest("[data-scoring]");
    if (!button) return;

    activeScoringKey = button.dataset.scoring;
    localStorage.setItem(SCORING_STORAGE_KEY, activeScoringKey);
    sortPlayers();
    renderScoringMenu();
    setMenuOpen(false);
    render();
  });

  document.addEventListener("click", (event) => {
    if (event.target.closest(".scoring-menu")) return;
    setMenuOpen(false);
  });
  document.addEventListener("keydown", handleKeyboardShortcut);

  els.statusFilterButtons.forEach((button) => {
    button.addEventListener("click", () => {
      activeFilter = button.dataset.filter;
      els.statusFilterButtons.forEach((item) => item.classList.toggle("is-active", item === button));
      render();
    });
  });

  els.positionFilterButtons.forEach((button) => {
    button.addEventListener("click", () => {
      activePositionFilter = button.dataset.positionFilter;
      els.positionFilterButtons.forEach((item) => item.classList.toggle("is-active", item === button));
      render();
    });
  });

  els.playerRows.addEventListener("click", (event) => {
    const button = event.target.closest("[data-action]");
    if (!button) return;

    const { fileName, action } = button.dataset;
    setPlayerStatus(fileName, action);
  });
}

function render() {
  const scoringMode = getScoringMode();
  const currentRound = getCurrentRound(players, statusByFileName);
  const rosterCounts = getRosterCounts(players, statusByFileName, POSITIONS);

  els.activeScoringLabel.textContent = scoringMode.label;
  els.valueHeader.textContent = `${scoringMode.label} $`;
  renderUndoButton();
  renderDraftPlan(scoringMode, currentRound, rosterCounts);
  renderSummary(currentRound);
  renderRosterSidebar(rosterCounts, scoringMode);
  renderMyDraft();
  renderPositionCards();
  renderRows();
}

function renderScoringMenu() {
  els.scoringMenu.innerHTML = SCORING_MODES.map(
    (mode) => `
      <button class="menu-option ${mode.key === activeScoringKey ? "is-active" : ""}" type="button" data-scoring="${mode.key}">
        ${escapeHtml(mode.label)}
      </button>
    `,
  ).join("");
}

function setMenuOpen(isOpen) {
  els.scoringMenu.hidden = !isOpen;
  els.scoringMenuButton.setAttribute("aria-expanded", String(isOpen));
}

function renderSummary(currentRound) {
  const counts = players.reduce(
    (memo, player) => {
      memo[getPlayerStatus(player)] += 1;
      return memo;
    },
    { available: 0, me: 0, competitor: 0 },
  );

  els.currentRound.textContent = `Round ${currentRound}`;
  els.availableCount.textContent = counts.available;
  els.mineCount.textContent = counts.me;
  els.competitorCount.textContent = counts.competitor;
}

function renderDraftPlan(scoringMode, currentRound, rosterCounts) {
  const plan = DRAFT_PLAN_CONFIG.plans[scoringMode.key] || DRAFT_PLAN_CONFIG.plans.superflex;
  if (!plan) return;

  els.draftPlanTitle.textContent = `${scoringMode.label} Plan`;
  els.draftPlanNote.textContent = plan.note;
  els.draftPlanList.innerHTML = plan.checkpoints
    .map(
      (checkpoint) => `
        <div class="plan-item ${getPlanStatus(checkpoint, currentRound, rosterCounts)}">
          <span>${escapeHtml(checkpoint.label)}</span>
          <strong>${escapeHtml(checkpoint.advice)}</strong>
        </div>
      `,
    )
    .join("");
}

function renderRosterSidebar(rosterCounts, scoringMode) {
  const positions = uniquePositions();
  const targets = DRAFT_PLAN_CONFIG.rosterTargets[scoringMode.key] || DRAFT_PLAN_CONFIG.rosterTargets.standard || {};

  els.rosterTotal.textContent = `${rosterCounts.total} drafted`;
  els.rosterList.innerHTML = positions
    .map((position) => {
      const count = rosterCounts[position] || 0;
      const target = targets[position] || 0;
      const targetText = target ? `${count} / ${target}` : String(count);
      const targetClass = target && count >= target ? "is-filled" : target ? "is-needed" : "";

      return `
        <div class="roster-row ${targetClass}">
          <span>${escapeHtml(position)}</span>
          <strong>${targetText}</strong>
        </div>
      `;
    })
    .join("");
}

function renderMyDraft() {
  const picks = draftOrder.map((fileName) => players.find((player) => player.fileName === fileName)).filter(Boolean);

  els.myDraftTotal.textContent = `${picks.length} ${picks.length === 1 ? "pick" : "picks"}`;
  els.myDraftList.innerHTML = picks.length
    ? picks
        .map(
          (player, index) => `
            <div class="my-draft-row">
              <span>R${index + 1}</span>
              <strong title="${escapeHtml(player.name)}">${escapeHtml(player.name)}</strong>
              <em>${escapeHtml(player.position || "-")}</em>
            </div>
          `,
        )
        .join("")
    : `<div class="empty-panel">No picks yet</div>`;
}

function renderPositionCards() {
  els.positionGrid.innerHTML = POSITIONS.map((position) => {
    const remaining = getRemainingForPosition(position);
    const topTen = remaining.slice(0, 10);
    const topFive = remaining.slice(0, 5);

    return `
      <article class="position-card">
        <header>
          <h2>${position}</h2>
          <span class="card-meta">${remaining.length} left</span>
        </header>
        ${sparkline(topTen)}
        <ol class="name-list">
          ${
            topFive.length
              ? topFive
                  .map(
                    (player) => `
                      <li class="${isHandcuff(player) ? "is-handcuff" : ""}">
                        <strong title="${escapeHtml(player.name)}">${escapeHtml(player.name)}</strong>
                        <span>$${player.auctionValue}</span>
                      </li>
                    `,
                  )
                  .join("")
              : `<li><strong>No players left</strong><span>$0</span></li>`
          }
        </ol>
      </article>
    `;
  }).join("");
}

function renderRows() {
  const filtered = getFilteredPlayers();

  const rendered = filtered.slice(0, MAX_RENDERED_ROWS);
  els.resultCount.textContent =
    filtered.length > rendered.length ? `${filtered.length} matched, first ${rendered.length} shown` : `${filtered.length} shown`;

  if (!rendered.length) {
    els.playerRows.innerHTML = `<tr><td class="empty-state" colspan="7">No matching players</td></tr>`;
    return;
  }

  els.playerRows.innerHTML = rendered.map((player) => playerRow(player)).join("");
}

function getFilteredPlayers() {
  const query = normalizeSearch(els.searchInput.value);

  return players.filter((player) => {
    const status = getPlayerStatus(player);
    const matchesQuery = matchesPlayerSearch(player, query);
    const matchesFilter = activeFilter === "all" || status === activeFilter;
    const matchesPosition = activePositionFilter === "all" || player.position === activePositionFilter;
    return matchesQuery && matchesFilter && matchesPosition;
  });
}

function playerRow(player) {
  const status = getPlayerStatus(player);
  const statusText = status === "me" ? "Mine" : status === "competitor" ? "Competitor" : "Available";
  const rowState = isHandcuff(player) ? "handcuff" : status;

  return `
    <tr data-status="${rowState}">
      <td>${player.rank || ""}</td>
      <td class="player-name">${escapeHtml(player.name)}</td>
      <td><span class="position-pill">${escapeHtml(player.position || "-")}</span></td>
      <td>${escapeHtml(player.team || "-")}</td>
      <td>$${player.auctionValue}</td>
      <td><span class="status-pill ${status}">${statusText}</span></td>
      <td>
        <div class="mark-actions">
          <button class="mark-button mine" type="button" data-action="me" data-file-name="${escapeHtml(player.fileName)}">Me</button>
          <button class="mark-button competitor" type="button" data-action="competitor" data-file-name="${escapeHtml(player.fileName)}">Competitor</button>
          <button class="mark-button available" type="button" data-action="available" data-file-name="${escapeHtml(player.fileName)}">Undo</button>
        </div>
      </td>
    </tr>
  `;
}

function getRemainingForPosition(position) {
  const wanted = position.toLowerCase();
  return players
    .filter((player) => player.position.toLowerCase() === wanted && getPlayerStatus(player) === "available")
    .sort((a, b) => b.auctionValue - a.auctionValue || a.rank - b.rank);
}

function isHandcuff(player) {
  if (getPlayerStatus(player) !== "available") return false;
  if (!player.team || !player.position) return false;

  return draftOrder.some((fileName) => {
    const draftedPlayer = players.find((candidate) => candidate.fileName === fileName);
    if (!draftedPlayer) return false;

    const isSameDepthChart = draftedPlayer.team === player.team && draftedPlayer.position === player.position;
    if (!isSameDepthChart) return false;

    return player.rank > draftedPlayer.rank || (player.rank === draftedPlayer.rank && player.auctionValue < draftedPlayer.auctionValue);
  });
}

function setPlayerStatus(fileName, status) {
  const previousStatus = statusByFileName[fileName] || "available";
  if (previousStatus === status) return;

  statusHistory.push({ fileName, previousStatus, previousDraftOrder: [...draftOrder] });
  applyPlayerStatus(fileName, status);
}

function handleKeyboardShortcut(event) {
  const activeElement = document.activeElement;
  const isTyping = activeElement instanceof HTMLInputElement || activeElement instanceof HTMLTextAreaElement;
  const isNativeControl = activeElement instanceof HTMLButtonElement || activeElement instanceof HTMLSelectElement;
  const hasModifier = event.altKey || event.ctrlKey || event.metaKey;

  if (hasModifier) return;

  if (event.key === "/") {
    if (isTyping || isNativeControl) return;
    event.preventDefault();
    els.searchInput.focus();
    els.searchInput.select();
    return;
  }

  if (event.key === "Escape") {
    if (els.scoringMenuButton.getAttribute("aria-expanded") === "true") setMenuOpen(false);
    if (els.searchInput.value) {
      els.searchInput.value = "";
      render();
    }
    return;
  }

  if (event.key === "Enter") {
    if (isNativeControl) return;
    const topPlayer = getFilteredPlayers()[0];
    if (!topPlayer) return;
    event.preventDefault();
    setPlayerStatus(topPlayer.fileName, event.shiftKey ? "me" : "competitor");
    return;
  }
}

function undoLastStatusChange() {
  const change = statusHistory.pop();
  if (!change) return;

  draftOrder = change.previousDraftOrder;
  applyPlayerStatus(change.fileName, change.previousStatus, { preserveDraftOrder: true });
}

function applyPlayerStatus(fileName, status, options = {}) {
  if (status === "available") {
    delete statusByFileName[fileName];
  } else {
    statusByFileName[fileName] = status;
  }

  if (!options.preserveDraftOrder) {
    draftOrder = draftOrder.filter((draftedFileName) => draftedFileName !== fileName);
    if (status === "me") draftOrder.push(fileName);
  }

  localStorage.setItem(STORAGE_KEY, JSON.stringify(statusByFileName));
  localStorage.setItem(DRAFT_ORDER_STORAGE_KEY, JSON.stringify(draftOrder));
  render();
}

function renderUndoButton() {
  const lastChange = statusHistory[statusHistory.length - 1];
  els.undoButton.disabled = !lastChange;
  els.undoButton.textContent = lastChange ? `Undo ${getPlayerName(lastChange.fileName)}` : "Undo";
}

function getPlayerName(fileName) {
  return players.find((player) => player.fileName === fileName)?.name || "last";
}

function getPlayerStatus(player) {
  return getPlayerStatusFromMap(player, statusByFileName);
}

function normalizePlayer(row) {
  const fields = DATA_SOURCE_CONFIG.fields || {};
  const firstName = getRowValue(row, fields.firstName);
  const lastName = getRowValue(row, fields.lastName);
  const fallbackName = getRowValue(row, fields.fallbackName);
  const fileName = getRowValue(row, fields.playerId) || normalizeSearch(`${firstName} ${lastName} ${fallbackName}`);
  const name = `${firstName} ${lastName}`.trim() || fallbackName;
  const team = getRowValue(row, fields.team);
  const searchText = normalizeSearch(`${name} ${fileName} ${team}`);

  return {
    fileName,
    name,
    ranks: Object.fromEntries(SCORING_MODES.map((mode) => [mode.key, toNumber(getRowValue(row, [mode.rank, mode.fallbackRank]) || "9999")])),
    position: getRowValue(row, fields.position).toUpperCase(),
    team,
    searchText,
    compactSearchText: compactSearch(searchText),
    auctionValues: Object.fromEntries(SCORING_MODES.map((mode) => [mode.key, toNumber(getRowValue(row, mode.auctionValue))])),
    get rank() {
      return this.ranks[activeScoringKey] || this.ranks.superflex || 9999;
    },
    get auctionValue() {
      return this.auctionValues[activeScoringKey] || 0;
    },
  };
}

function getRowValue(row, fieldConfig) {
  const fields = Array.isArray(fieldConfig) ? fieldConfig : [fieldConfig];
  for (const field of fields) {
    if (typeof field !== "string") continue;
    const value = row[field];
    if (value) return value;
  }
  return "";
}

function sortPlayers() {
  players.sort((a, b) => a.rank - b.rank || b.auctionValue - a.auctionValue);
}

function getScoringMode() {
  return SCORING_MODES.find((mode) => mode.key === activeScoringKey) || SCORING_MODES[0] || { key: "", label: "Auction Value" };
}

function loadScoringMode() {
  const stored = localStorage.getItem(SCORING_STORAGE_KEY);
  return SCORING_MODES.some((mode) => mode.key === stored) ? stored : SCORING_MODES[0]?.key || "";
}

function toNumber(value) {
  const number = Number(String(value ?? "").replace(/[^0-9.-]/g, ""));
  return Number.isFinite(number) ? number : 0;
}

function loadStatuses() {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function loadDraftOrder() {
  try {
    const parsed = JSON.parse(localStorage.getItem(DRAFT_ORDER_STORAGE_KEY) || "[]");
    return Array.isArray(parsed) ? parsed.filter((fileName) => typeof fileName === "string") : [];
  } catch {
    return [];
  }
}

function reconcileDraftOrder() {
  const validMine = new Set(
    players.filter((player) => getPlayerStatus(player) === "me").map((player) => player.fileName),
  );
  const ordered = draftOrder.filter((fileName) => validMine.has(fileName));
  const orderedSet = new Set(ordered);
  const missing = players.filter((player) => validMine.has(player.fileName) && !orderedSet.has(player.fileName)).map((player) => player.fileName);

  draftOrder = [...ordered, ...missing];
  localStorage.setItem(DRAFT_ORDER_STORAGE_KEY, JSON.stringify(draftOrder));
}

function sparkline(sparkPlayers) {
  const width = 220;
  const height = 76;
  const pad = 5;
  const values = sparkPlayers.map((player) => player.auctionValue);

  if (!values.length) {
    return `<svg class="sparkline" viewBox="0 0 ${width} ${height}" role="img" aria-label="No remaining values"></svg>`;
  }

  const max = Math.max(...values);
  const min = Math.min(...values);
  const range = max - min || 1;
  const step = values.length > 1 ? (width - pad * 2) / (values.length - 1) : 0;
  const points = values.map((value, index) => {
    const x = pad + index * step;
    const y = pad + (1 - (value - min) / range) * (height - pad * 2);
    return [x, y];
  });
  const line = points.map(([x, y]) => `${round(x)},${round(y)}`).join(" ");
  const area = `${pad},${height - pad} ${line} ${width - pad},${height - pad}`;

  return `
    <svg class="sparkline" viewBox="0 0 ${width} ${height}" role="img" aria-label="Top ten remaining auction values: ${values.join(", ")}">
      <polyline class="spark-area" points="${area}"></polyline>
      <polyline class="spark-line" points="${line}"></polyline>
      ${points
        .map(
          ([x, y], index) => `
            <circle class="spark-point ${isHandcuff(sparkPlayers[index]) ? "is-handcuff" : ""}" cx="${round(x)}" cy="${round(y)}" r="4"></circle>
            <text class="spark-label" x="${round(x)}" y="${round(Math.max(11, y - 8))}" text-anchor="middle">${values[index]}</text>
          `,
        )
        .join("")}
    </svg>
  `;
}

function round(number) {
  return Math.round(number * 10) / 10;
}

function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    const next = text[i + 1];

    if (char === '"' && inQuotes && next === '"') {
      field += '"';
      i += 1;
    } else if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === "," && !inQuotes) {
      row.push(field);
      field = "";
    } else if ((char === "\n" || char === "\r") && !inQuotes) {
      if (char === "\r" && next === "\n") i += 1;
      row.push(field);
      if (row.some((cell) => cell.length)) rows.push(row);
      row = [];
      field = "";
    } else {
      field += char;
    }
  }

  if (field.length || row.length) {
    row.push(field);
    rows.push(row);
  }

  const headers = rows.shift() || [];
  return rows.map((cells) => Object.fromEntries(headers.map((header, index) => [header, cells[index] || ""])));
}

function uniquePositions() {
  const positionSet = new Set(POSITIONS);
  players.forEach((player) => {
    if (player.position) positionSet.add(player.position);
  });
  return [...positionSet].sort((a, b) => {
    const aIndex = POSITIONS.indexOf(a);
    const bIndex = POSITIONS.indexOf(b);
    if (aIndex !== -1 || bIndex !== -1) {
      if (aIndex === -1) return 1;
      if (bIndex === -1) return -1;
      return aIndex - bIndex;
    }
    return a.localeCompare(b);
  });
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (char) => {
    const entities = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#039;",
    };
    return entities[char];
  });
}
