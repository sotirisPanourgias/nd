#!/usr/bin/env node

const express = require("express");
const path = require("path");

const app = express();
const port = process.env.PORT || 8081;

app.use(express.json());
app.use(express.static(path.join(__dirname, "../frontend/public")));

const mysql = require("mysql2/promise");

const pool = mysql.createPool({
  host: "192.168.1.211",
  user: "impostor_user",
  password: "impostor_pass",
  database: "impostor",
  port: 3306,
  waitForConnections: true,
  connectionLimit: 10,
});

const dbAll = async (sql, params = []) => {
  const [rows] = await pool.query(sql, params);
  return rows;
};

const dbGet = async (sql, params = []) => {
  const [rows] = await pool.query(sql, params);
  return rows[0];
};

const dbRun = async (sql, params = []) => {
  const [result] = await pool.execute(sql, params);
  return result;
};

const handleDbError = (res, err) => {
  console.error("Database error:", err);
  return res.status(500).json({ error: "Database error" });
};

const gameState = { impostorPlayerId: null,playerName: null };

// GET /game?userId=1 -> returns the matching player for that user as well as role.
app.get("/game", async (req, res) => {
  try {
    const userId = Number(req.query.userId);
    if (!userId || Number.isNaN(userId) || userId < 1) {
      return res.status(400).json({ error: "userId query parameter is required (1 or greater)" });
    }

    if (!gameState.impostorPlayerId) {
      return res.status(400).json({ error: "Game not started. Call /game/reset first." });
    }

    const playerId = userId;
    const row = await dbGet("SELECT id, name AS name FROM users WHERE id = ?", [playerId]);
    // const playerRows = await dbAll("SELECT id, name FROM players");
    if (!row) return res.status(404).json({ error: "User not found" });

    const role = playerId === gameState.impostorPlayerId ? "impostor" : "crewmate";
    // const randomPlayerIndex = Math.floor(Math.random() * playerRows.length);
    // playerName = playerRows[randomPlayerIndex].name;
    res.json({ player: row, userId, role , playerName : gameState.playerName});
  } catch (err) {
    handleDbError(res, err);
  }
});

// POST /game/reset -> start a new round (re-roll impostor)
app.post("/game/reset", async (req, res) => {
  try {
    const rows = await dbAll("SELECT id FROM users");
    const playerRows = await dbAll("SELECT id, name FROM players");
    if (!rows || rows.length < 2) {
      return res.status(400).json({ error: "Not enough users. Add at least 2 users." });
    }

    const randomIndex = Math.floor(Math.random() * rows.length);
    gameState.impostorPlayerId = rows[randomIndex].id;
    const randomPlayerIndex = Math.floor(Math.random() * playerRows.length);
    gameState.playerName = playerRows[randomPlayerIndex].name;
    res.json({ ok: true, impostorPlayerId: gameState.impostorPlayerId,playerName: gameState.playerName });
  } catch (err) {
    handleDbError(res, err);
  }
});

// POST /game/end -> reset game and remove all players
app.post("/game/end", async (req, res) => {
  try {
    await dbRun("DELETE FROM users");
    gameState.impostorPlayerId = null;
    res.json({ ok: true });
  } catch (err) {
    handleDbError(res, err);
  }
});

// GET /users -> list all users (aliases as players)
app.get("/users", async (req, res) => {
  try {
    const rows = await dbAll("SELECT id, name AS name FROM users");
    res.json(rows);
  } catch (err) {
    handleDbError(res, err);
  }
});

// GET /users/:id -> returns a user record from the database
app.get("/users/:id", async (req, res) => {
  try {
    const playerId = Number(req.params.id);
    if (Number.isNaN(playerId)) {
      return res.status(400).json({ error: "Invalid player id" });
    }
    const row = await dbGet("SELECT id, name AS name FROM users WHERE id = ?", [playerId]);
    if (!row) return res.status(404).json({ error: "User not found" });
    res.json(row);
  } catch (err) {
    handleDbError(res, err);
  }
});

// POST /users -> create a new user
app.post("/users", async (req, res) => {
  try {
    const { id,name } = req.body;
    if (!name || typeof name !== "string") {
      return res.status(400).json({ error: "Name is required" });
    }

    const result = await dbRun("INSERT INTO users (id, name) VALUES (?, ?)", [id, name]);
    const userId = result.insertId || result.insertID || result.lastID || null;
    if (!userId) {
      return res.status(500).json({ error: "Failed to create user" });
    }

    const row = await dbGet("SELECT id, name AS name FROM users WHERE id = ?", [id]);
    res.status(201).json(row);
  } catch (err) {
    handleDbError(res, err);
  }
});

// PUT /users/:id -> update a user
app.put("/users/:id", async (req, res) => {
  try {
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
    const result = await dbRun(`UPDATE users SET ${updates.join(", ")} WHERE id = ?`, params);
    const changes = result.affectedRows || result.changes || 0;
    if (changes === 0) {
      return res.status(404).json({ error: "User not found" });
    }

    const row = await dbGet("SELECT id, name AS name FROM users WHERE id = ?", [playerId]);
    res.json(row);
  } catch (err) {
    handleDbError(res, err);
  }
});

// DELETE /users/:id -> delete a user
app.delete("/users/:id", async (req, res) => {
  try {
    const playerId = Number(req.params.id);
    if (Number.isNaN(playerId)) {
      return res.status(400).json({ error: "Invalid player id" });
    }

    const result = await dbRun("DELETE FROM users WHERE id = ?", [playerId]);
    const changes = result.affectedRows || result.changes || 0;
    if (changes === 0) {
      return res.status(404).json({ error: "User not found" });
    }

    res.status(204).send();
  } catch (err) {
    handleDbError(res, err);
  }
});

// Alias route to match users style
app.get("/users", async (req, res) => {
  try {
    const rows = await dbAll("SELECT id, name AS name FROM users");
    res.json(rows);
  } catch (err) {
    handleDbError(res, err);
  }
});

app.get("/users/:id", async (req, res) => {
  try {
    const userId = Number(req.params.id);
    if (Number.isNaN(userId)) {
      return res.status(400).json({ error: "Invalid user id" });
    }
    const row = await dbGet("SELECT id, name AS name FROM users WHERE id = ?", [userId]);
    if (!row) return res.status(404).json({ error: "User not found" });
    res.json(row);
  } catch (err) {
    handleDbError(res, err);
  }
});
// GET /players -> returns a user record from the database
app.get("/players", async (req, res) => {
  try {
    //const playerId = Math.floor(Math.random() * 100) + 1; // από 1 έως 100
    const playerId = Math.floor(Math.random() * 2) + 29;
    if (Number.isNaN(playerId)) {
      return res.status(400).json({ error: "Invalid player id" });
    }
    const row = await dbGet("SELECT  name AS name FROM players WHERE id = ?", [playerId]);
    if (!row) return res.status(404).json({ error: "Player not found" });
    res.json(row);
  } catch (err) {
    handleDbError(res, err);
  }
});
// POST /players -> create a new player
app.post("/players", async (req, res) => {
  try {
    const { name } = req.body;
    if (!name || typeof name !== "string") {
      return res.status(400).json({ error: "Name is required" });
    }

    const result = await dbRun("INSERT INTO players (name) VALUES (?)", [name]);
    const id = result.insertId || result.insertID || result.lastID || null;
    if (!id) {
      return res.status(500).json({ error: "Failed to create player" });
    }

    const row = await dbGet("SELECT id, name AS name FROM players WHERE id = ?", [id]);
    res.status(201).json(row);
  } catch (err) {
    handleDbError(res, err);
  }
});

app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
  console.log(`DB mode: MySQL`);
});
