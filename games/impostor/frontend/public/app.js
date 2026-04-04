const apiBase = "/";

const el = (id) => document.getElementById(id);
let selectedLeague = "NBA";
let selectedCategory = "PLAYERS";
let selectedEra = "ACTIVE";
let numImpostors = 1;
let playerNames = [];
const playersContainer = el("players");
const nameInput = el("name");
const gameTitle = el("gameTitle");
const numPlayersInput = el("numPlayers");
const playerInputsContainer = el("playerInputs");
const setupPlayersBtn = el("setupPlayers");
const nextPlayerBtn = el("nextPlayer");
const holdRoleBtn = el("holdRole");
const setupSection = el("setupSection");
const createSection = el("createSection");
const gameSection = el("gameSection");
const roleDisplay = el("role");
let pendingRoleData = null;
let currentPlayerId = 1;
let totalPlayers = 2;

const renderPlayerInputs = (count) => {
  playerInputsContainer.innerHTML = "";
  for (let i = 1; i <= count; i += 1) {
    const wrapper = document.createElement("div");
    wrapper.style.marginBottom = "0.5rem";

    const input = document.createElement("input");
    input.type = "text";
    input.placeholder = `Player ${i}`;
    input.dataset.playerIndex = i;

    wrapper.appendChild(input);
    playerInputsContainer.appendChild(wrapper);
  }
};

const updateUserIdRange = (maxId) => {
  const safeMax = Math.max(2, maxId);
  gameTitle.textContent = `Game (${safeMax} players)`;
};

const setPlayerCount = (count) => {
  const validCount = Math.max(2, Number(count) || 2);
  numPlayersInput.value = validCount;
  renderPlayerInputs(validCount);
  updateUserIdRange(validCount);
};

const showOnlySetup = () => {
  setupSection.style.display = "block";
  createSection.style.display = "none";
  gameSection.style.display = "none";
  nextPlayerBtn.style.display = "none";
};

const proceedToGame = () => {
  setupSection.style.display = "none";
  createSection.style.display = "none";
  gameSection.style.display = "block";
  holdRoleBtn.style.display = "flex";
  nextPlayerBtn.style.display = "inline-block";
};

const promptPlayerCount = () => {
  const response = prompt("How many players will play? (min 2)", numPlayersInput.value);
  const count = Number(response);
  if (!count || count < 2) return;
  setPlayerCount(count);
};

const renderPlayers = (players) => {
  playersContainer.innerHTML = "";
  players.forEach((player) => {
    const row = document.createElement("div");
    row.className = "player";

    const info = document.createElement("div");
    info.className = "player-info";

    const icon = document.createElement("span");
    icon.textContent = "🏀";
    icon.style.fontSize = "1.2rem";
    info.appendChild(icon);

    const name = document.createElement("span");
    name.textContent = player.name;
    name.className = "player-name";
    info.appendChild(name);

    const badge = document.createElement("span");
    badge.className = "player-badge";
    badge.textContent = `#${player.id}`;
    info.appendChild(badge);

    row.appendChild(info);

    const updateBtn = document.createElement("button");
    updateBtn.textContent = "Rename";
    updateBtn.onclick = async () => {
      const newName = prompt("New name:", player.name);
      if (!newName) return;

      await fetch(`${apiBase}users/${player.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newName }),
      });
      await loadPlayers();
    };
    row.appendChild(updateBtn);

    const deleteBtn = document.createElement("button");
    deleteBtn.textContent = "Delete";
    deleteBtn.onclick = async () => {
      await fetch(`${apiBase}users/${player.id}`, { method: "DELETE" });
      await loadPlayers();
    };
    row.appendChild(deleteBtn);

    playersContainer.appendChild(row);
  });
};

const loadPlayers = async () => {
  const res = await fetch(`${apiBase}users`);
  const players = await res.json();
  renderPlayers(players);

  const maxPlayerId = players.reduce((max, p) => Math.max(max, p.id), 0);
  if (maxPlayerId > 0) updateUserIdRange(maxPlayerId);
};

const loadRoleSilent = async (userId) => {
  const res = await fetch(`${apiBase}game?userId=${userId}`);
  if (!res.ok) return;
  pendingRoleData = await res.json();
  roleDisplay.textContent = "";
  roleDisplay.className = "";
};

const revealRole = () => {
  if (!pendingRoleData) return;
  const emoji = pendingRoleData.role === "impostor" ? "🎭" : "🟢";
  roleDisplay.textContent = pendingRoleData.role === "impostor"
    ? `${emoji} You are the Impostor!`
    : `${emoji} ${pendingRoleData.playerName}`;
  roleDisplay.className = pendingRoleData.role === "impostor" ? "badge-impostor" : "badge-crewmate";
};

const hideRole = () => {
  roleDisplay.textContent = "";
  roleDisplay.className = "";
};

const newRound = async () => {
  const res = await fetch(`${apiBase}game/reset`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ league: selectedLeague, category: selectedCategory, era: selectedEra, numImpostors }),
  });
  if (!res.ok) {
    roleDisplay.textContent = "Failed to start new round";
    return false;
  }
  currentPlayerId = 1;
  el("currentPlayerLabel").textContent = `Player 1 of ${totalPlayers} — hold the button to see your role`;
  el("roundEndSection").style.display = "none";
  el("starterAnnouncement").textContent = "";
  holdRoleBtn.style.display = "flex";
  nextPlayerBtn.style.display = "inline-block";
  hideRole();
  await loadRoleSilent(1);
  return true;
};

const endGame = async () => {
  const res = await fetch(`${apiBase}game/end`, { method: "POST" });
  if (!res.ok) {
    roleDisplay.textContent = "Failed to end game";
    return;
  }
  hideRole();
  pendingRoleData = null;
  showOnlySetup();
};

const createPlayer = async () => {
  const name = nameInput.value.trim();
  if (!name) return;

  await fetch(`${apiBase}players`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name }),
  });

  nameInput.value = "";
  await loadPlayers();
};

el("create").addEventListener("click", async () => {
  await createPlayer();
  await loadPlayers();
});

holdRoleBtn.addEventListener("mousedown", revealRole);
holdRoleBtn.addEventListener("touchstart", (e) => { e.preventDefault(); revealRole(); }, { passive: false });
holdRoleBtn.addEventListener("mouseup", hideRole);
holdRoleBtn.addEventListener("mouseleave", hideRole);
holdRoleBtn.addEventListener("touchend", hideRole);
holdRoleBtn.addEventListener("touchcancel", hideRole);

nextPlayerBtn.addEventListener("click", async () => {
  hideRole();
  if (currentPlayerId >= totalPlayers) {
    holdRoleBtn.style.display = "none";
    nextPlayerBtn.style.display = "none";
    el("roundEndSection").style.display = "block";
    el("currentPlayerLabel").textContent = "All players done!";
    const starter = playerNames[Math.floor(Math.random() * playerNames.length)];
    el("starterAnnouncement").textContent = `🎙️ ${starter} starts !`;
  } else {
    currentPlayerId++;
    el("currentPlayerLabel").textContent = `Player ${currentPlayerId} of ${totalPlayers} — hold the button to see your role`;
    await loadRoleSilent(currentPlayerId);
  }
});

el("newRoundBtn").addEventListener("click", newRound);
el("endGameBtn").addEventListener("click", endGame);

// Impostor stepper
el("impostorDec").addEventListener("click", () => {
  if (numImpostors > 1) {
    numImpostors--;
    el("impostorCount").textContent = numImpostors;
  }
});
el("impostorInc").addEventListener("click", () => {
  const max = Math.max(1, Number(el("numPlayers").value) - 1);
  if (numImpostors < max) {
    numImpostors++;
    el("impostorCount").textContent = numImpostors;
  }
});
numPlayersInput.addEventListener("change", () => {
  const max = Math.max(1, Number(numPlayersInput.value) - 1);
  if (numImpostors > max) {
    numImpostors = max;
    el("impostorCount").textContent = numImpostors;
  }
  setPlayerCount(numPlayersInput.value);
});

setupPlayersBtn.addEventListener("click", async () => {
  const count = Number(numPlayersInput.value);
  if (!count || count < 2) {
    alert("Please enter at least 2 players.");
    return;
  }

  // Reset state and create a fresh list of players.
  await fetch(`${apiBase}game/end`, { method: "POST" });

  const inputs = Array.from(playerInputsContainer.querySelectorAll("input"));
  const names = inputs.map((i) => i.value.trim()).filter(Boolean);

  if (names.length < count) {
    alert("Please fill in all player names.");
    return;
  }

  for (let i = 0; i < count; i++) {
    const name = names[i];
    const aid = i + 1;

    await fetch(`${apiBase}users`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: aid, name }),
    });
  }

  playerNames = names.slice(0, count);
  totalPlayers = count;
  setPlayerCount(count);
  const roundOk = await newRound();
  if (roundOk) {
    proceedToGame();
  }
});

// Era toggle
document.getElementById("eraToggle").addEventListener("click", (e) => {
  const btn = e.target.closest("button[data-era]");
  if (!btn) return;
  selectedEra = btn.dataset.era;
  document.querySelectorAll("#eraToggle button").forEach((b) => b.classList.remove("active"));
  btn.classList.add("active");
});

// Category toggle
document.getElementById("categoryToggle").addEventListener("click", (e) => {
  const btn = e.target.closest("button[data-category]");
  if (!btn) return;
  selectedCategory = btn.dataset.category;
  document.querySelectorAll("#categoryToggle button").forEach((b) => b.classList.remove("active"));
  btn.classList.add("active");
});

// League toggle
document.getElementById("leagueToggle").addEventListener("click", (e) => {
  const btn = e.target.closest("button[data-league]");
  if (!btn) return;
  selectedLeague = btn.dataset.league;
  document.querySelectorAll("#leagueToggle button").forEach((b) => b.classList.remove("active"));
  btn.classList.add("active");
});

// Initialize UI
setPlayerCount(numPlayersInput.value);
showOnlySetup();
