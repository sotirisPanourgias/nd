#!/usr/bin/env node

const express = require("express");
const path = require("path");
const sqlite3 = require("sqlite3").verbose();

const app = express();
const port = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, "../frontend/public")));

// to do connect db 

// Simple game state: track which player (by player.id) is the impostor.
const gameState = {
  impostorPlayerId: null,
};

// GET /game?userId=1 -> returns the matching player for that user as well as role.
app.get("/game", (req, res) => {
  const userId = Number(req.query.userId);
  if (!userId || Number.isNaN(userId) || userId < 1) {
    return res.status(400).json({ error: "userId query parameter is required (1 or greater)" });
  }

  if (!gameState.impostorPlayerId) {
    return res.status(400).json({ error: "Game not started. Call /game/reset first." });
  }

  const playerId = userId;

  db.get(
    "SELECT id, name FROM players WHERE id = ?",
    [playerId],
    (err, row) => {
      if (err) return handleDbError(res, err);
      if (!row) return res.status(404).json({ error: "Player not found" });

      const role = playerId === gameState.impostorPlayerId ? "impostor" : "crewmate";
      res.json({ player: row, userId, role });
    }
  );
});

// POST /game/reset -> start a new round (re-roll impostor)
app.post("/game/reset", (req, res) => {
  db.all("SELECT id FROM players", (err, rows) => {
    if (err) return handleDbError(res, err);
    if (!rows || rows.length < 3) {
      return res.status(400).json({ error: "Not enough players. Add at least 3 players." });
    }

    const randomIndex = Math.floor(Math.random() * rows.length);
    gameState.impostorPlayerId = rows[randomIndex].id;
    res.json({ ok: true, impostorPlayerId: gameState.impostorPlayerId });
  });
});

// POST /game/end -> reset game and remove all players
app.post("/game/end", (req, res) => {
  db.run("DELETE FROM players", (err) => {
    if (err) return handleDbError(res, err);
    gameState.impostorUserId = null;
    res.json({ ok: true });
  });
});

// GET /players -> list all players
app.get("/players", (req, res) => {
  db.all("SELECT id, name FROM players", (err, rows) => {
    if (err) return handleDbError(res, err);
    res.json(rows);
  });
});

// GET /players/:id -> returns a player record from the database
app.get("/players/:id", (req, res) => {
  const playerId = Number(req.params.id);
  if (Number.isNaN(playerId)) {
    return res.status(400).json({ error: "Invalid player id" });
  }

  db.get(
    "SELECT id, name FROM players WHERE id = ?",
    [playerId],
    (err, row) => {
      if (err) return handleDbError(res, err);
      if (!row) return res.status(404).json({ error: "Player not found" });
      res.json(row);
    }
  );
});

// POST /players -> create a new player
app.post("/players", (req, res) => {
  const { name } = req.body;
  if (!name || typeof name !== "string") {
    return res.status(400).json({ error: "Name is required" });
  }

  db.run(
    "INSERT INTO players (name) VALUES (?)",
    [name],
    function (err) {
      if (err) return handleDbError(res, err);
      db.get(
        "SELECT id, name FROM players WHERE id = ?",
        [this.lastID],
        (err2, row) => {
          if (err2) return handleDbError(res, err2);
          res.status(201).json(row);
        }
      );
    }
  );
});

// PUT /players/:id -> update a player
app.put("/players/:id", (req, res) => {
  const playerId = Number(req.params.id);
  if (Number.isNaN(playerId)) {
    return res.status(400).json({ error: "Invalid player id" });
  }

  const { name } = req.body;
  if (name !== undefined && typeof name !== "string") {
    return res.status(400).json({ error: "Name must be a string" });
  }

  const updates = [];
  const params = [];

  if (name !== undefined) {
    updates.push("name = ?");
    params.push(name);
  }

  if (!updates.length) {
    return res.status(400).json({ error: "No fields to update" });
  }

  params.push(playerId);
  db.run(
    `UPDATE players SET ${updates.join(", ")} WHERE id = ?`,
    params,
    function (err) {
      if (err) return handleDbError(res, err);
      if (this.changes === 0) {
        return res.status(404).json({ error: "Player not found" });
      }
      db.get(
        "SELECT id, name, score FROM players WHERE id = ?",
        [playerId],
        (err2, row) => {
          if (err2) return handleDbError(res, err2);
          res.json(row);
        }
      );
    }
  );
});

// DELETE /players/:id -> delete a player
app.delete("/players/:id", (req, res) => {
  const playerId = Number(req.params.id);
  if (Number.isNaN(playerId)) {
    return res.status(400).json({ error: "Invalid player id" });
  }

  db.run(
    "DELETE FROM players WHERE id = ?",
    [playerId],
    function (err) {
      if (err) return handleDbError(res, err);
      if (this.changes === 0) {
        return res.status(404).json({ error: "Player not found" });
      }
      res.status(204).send();
    }
  );
});

app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
  console.log(`Try: curl http://localhost:${port}/players`);
});
