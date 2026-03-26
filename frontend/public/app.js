const apiBase = "/";

const el = (id) => document.getElementById(id);
const playersContainer = el("players");
const nameInput = el("name");
const userIdInput = el("userId");
const userIdRange = el("userIdRange");
const gameTitle = el("gameTitle");
const numPlayersInput = el("numPlayers");
const playerInputsContainer = el("playerInputs");
const setupPlayersBtn = el("setupPlayers");
const nextPlayerBtn = el("nextPlayer");
const setupSection = el("setupSection");
const createSection = el("createSection");
const gameSection = el("gameSection");
const playersSection = el("playersSection");
const roleDisplay = el("role");

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
  userIdRange.textContent = `1–${safeMax}`;
  userIdInput.max = safeMax;
  if (Number(userIdInput.value) > safeMax) userIdInput.value = 1;
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
  playersSection.style.display = "none";
  nextPlayerBtn.style.display = "none";
  nextPlayerBtn.disabled = false;
};

const proceedToGame = () => {
  setupSection.style.display = "none";
  createSection.style.display = "none";
  gameSection.style.display = "block";
  playersSection.style.display = "block";
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

const loadRole = async () => {
  const userId = Number(userIdInput.value);
  if (!userId || userId < 1) return;

  const res = await fetch(`${apiBase}game?userId=${userId}`);
  if (!res.ok) {
    roleDisplay.textContent = "Failed to load role";
    return;
  }

  const data = await res.json();
  const roleEmoji = data.role === "impostor" ? "🎭" : "🟢";
  if(data.role === "impostor"){
    roleDisplay.textContent = `${roleEmoji} You are the Impostor!`;
  } else {
    roleDisplay.textContent = `${roleEmoji} ${data.playerName}`;
  }
  //roleDisplay.textContent = `${roleEmoji} User ${data.userId} is ${data.role.toUpperCase()} (player: ${data.player.name}) Player is ${playerRes.name}`;
  roleDisplay.className = data.role === "impostor" ? "badge-impostor" : "badge-crewmate";
};

const newRound = async () => {
  const res = await fetch(`${apiBase}game/reset`, { method: "POST" });
  if (!res.ok) {
    let message = "Failed to start new round";
    try {
      const json = await res.json();
      if (json && json.error) message += `: ${json.error}`;
    } catch (e) {
      // ignore parse failures
    }
    roleDisplay.textContent = message;
    return false;
  }

  await loadRole();
  return true;
};

const endGame = async () => {
  const res = await fetch(`${apiBase}game/end`, { method: "POST" });
  if (!res.ok) {
    roleDisplay.textContent = "Failed to end game";
    return;
  }

  roleDisplay.textContent = "Game ended. Add players to start a new game.";
  await loadPlayers();
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
el("loadRole").addEventListener("click", loadRole);
el("newRound").addEventListener("click", newRound);
el("endGame").addEventListener("click", endGame);
el("nextPlayer").addEventListener("click", async () => {
  userIdInput.value = 1;
  await loadRole();
  nextPlayerBtn.disabled = true;
});

numPlayersInput.addEventListener("change", () => setPlayerCount(numPlayersInput.value));
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
    const name = names[i];   // παίρνουμε το i-οστό όνομα
    const aid = i + 1;       // id από 1 έως count

    await fetch(`${apiBase}users`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id:aid, name }),
    });
  }

  setPlayerCount(count);
  //await loadPlayers();
  const roundOk = await newRound();
  if (roundOk) {
    proceedToGame();
  }
});

// Initialize UI
setPlayerCount(numPlayersInput.value);
showOnlySetup();
