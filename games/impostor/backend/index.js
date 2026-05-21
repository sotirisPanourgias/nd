#!/usr/bin/env node

const express = require("express");
const path = require("path");

const app = express();
const port = process.env.PORT || 8081;

app.use(express.json());
app.use(express.static(path.join(__dirname, "../frontend/public")));

const { Pool } = require("pg");

const pool = new Pool(
    process.env.DATABASE_URL
        ? { connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } }
        : {
          connectionString: 'postgresql://neondb_owner:npg_1AHcQMk6ouSv@ep-jolly-waterfall-akwyad7n-pooler.c-3.us-west-2.aws.neon.tech/neondb?sslmode=require&channel_binding=require',
          ssl: { rejectUnauthorized: false }
        }
);

const dbAll = async (sql, params = []) => {
  const result = await pool.query(sql, params);
  return result.rows;
};

const dbGet = async (sql, params = []) => {
  const result = await pool.query(sql, params);
  return result.rows[0];
};

const dbRun = async (sql, params = []) => {
  return await pool.query(sql, params);
};

const handleDbError = (res, err) => {
  console.error("Database error:", err);
  return res.status(500).json({ error: "Database error" });
};

const gameStates = new Map(); // roomId -> { impostorPlayerIds, playerName }

// GET /game?userId=1&roomId=xyz -> returns the matching player for that user as well as role.
app.get("/game", async (req, res) => {
  try {
    const userId = Number(req.query.userId);
    const roomId = req.query.roomId;
    if (!userId || Number.isNaN(userId) || userId < 1) {
      return res.status(400).json({ error: "userId query parameter is required (1 or greater)" });
    }
    if (!roomId) {
      return res.status(400).json({ error: "roomId query parameter is required" });
    }

    const state = gameStates.get(roomId);
    if (!state || !state.impostorPlayerIds.length) {
      return res.status(400).json({ error: "Game not started. Call /game/reset first." });
    }

    const playerId = userId;
    const row = await dbGet("SELECT id, name AS name FROM users WHERE room_id = $1 AND id = $2", [roomId, playerId]);
    if (!row) return res.status(404).json({ error: "User not found" });

    const role = state.impostorPlayerIds.includes(playerId) ? "impostor" : "crewmate";
    res.json({ player: row, userId, role, playerName: state.playerName });
  } catch (err) {
    handleDbError(res, err);
  }
});

// POST /game/reset -> start a new round (re-roll impostor)
app.post("/game/reset", async (req, res) => {
  try {
    const roomId = req.body && req.body.roomId;
    if (!roomId) {
      return res.status(400).json({ error: "roomId is required in the request body" });
    }
    const rows = await dbAll("SELECT id FROM users WHERE room_id = $1", [roomId]);
    const league = req.body && req.body.league;
    const category = req.body && req.body.category;
    const era = req.body && req.body.era;
    const leagueFilter = league === "NBA" || league === "EUROLEAGUE";
    const validEras = ["ACTIVE", "LEGENDS", "BOTH"];
    const safeEra = validEras.includes(era) ? era : "ACTIVE";
    const activeClause = safeEra === "ACTIVE" ? "AND active = true" : safeEra === "LEGENDS" ? "AND active = false" : "";
    let playerRows;
    if (category === "GENERAL") {
      if (leagueFilter) {
        playerRows = await dbAll(
          `SELECT name FROM players WHERE league = $1 ${activeClause} UNION ALL SELECT name FROM coaches WHERE league = $1 ${activeClause}`,
          [league]
        );
      } else {
        playerRows = await dbAll(
          `SELECT name FROM players WHERE 1=1 ${activeClause} UNION ALL SELECT name FROM coaches WHERE 1=1 ${activeClause}`
        );
      }
    } else {
      if (leagueFilter) {
        playerRows = await dbAll(`SELECT name FROM players WHERE league = $1 ${activeClause}`, [league]);
      } else {
        playerRows = await dbAll(`SELECT name FROM players WHERE 1=1 ${activeClause}`);
      }
    }
    if (!rows || rows.length < 2) {
      return res.status(400).json({ error: "Not enough users. Add at least 2 users." });
    }

    const requestedImpostors = Math.floor(Number(req.body && req.body.numImpostors) || 1);
    const impostorCount = Math.max(1, Math.min(requestedImpostors, rows.length - 1));
    const shuffled = [...rows].sort(() => Math.random() - 0.5);
    const impostorPlayerIds = shuffled.slice(0, impostorCount).map((r) => r.id);
    const randomPlayerIndex = Math.floor(Math.random() * playerRows.length);
    const playerName = playerRows[randomPlayerIndex].name;
    gameStates.set(roomId, { impostorPlayerIds, playerName });
    res.json({ ok: true, roomId, impostorPlayerIds, playerName });
  } catch (err) {
    handleDbError(res, err);
  }
});

// POST /game/end -> reset game and remove all players
app.post("/game/end", async (req, res) => {
  try {
    const roomId = req.body && req.body.roomId;
    if (roomId) {
      await dbRun("DELETE FROM users WHERE room_id = $1", [roomId]);
      gameStates.delete(roomId);
    }
    res.json({ ok: true });
  } catch (err) {
    handleDbError(res, err);
  }
});

// GET /users -> list all users (aliases as players)
app.get("/users", async (req, res) => {
  try {
    const roomId = req.query.roomId || "";
    const rows = await dbAll("SELECT id, name AS name FROM users WHERE room_id = $1", [roomId]);
    res.json(rows);
  } catch (err) {
    handleDbError(res, err);
  }
});

// GET /users/:id -> returns a user record from the database
app.get("/users/:id", async (req, res) => {
  try {
    const playerId = Number(req.params.id);
    const roomId = req.query.roomId || "";
    if (Number.isNaN(playerId)) {
      return res.status(400).json({ error: "Invalid player id" });
    }
    const row = await dbGet("SELECT id, name AS name FROM users WHERE room_id = $1 AND id = $2", [roomId, playerId]);
    if (!row) return res.status(404).json({ error: "User not found" });
    res.json(row);
  } catch (err) {
    handleDbError(res, err);
  }
});

// POST /users -> create a new user
app.post("/users", async (req, res) => {
  try {
    const { id, name, roomId } = req.body;
    if (!name || typeof name !== "string") {
      return res.status(400).json({ error: "Name is required" });
    }
    if (!roomId) {
      return res.status(400).json({ error: "roomId is required" });
    }

    await dbRun("INSERT INTO users (room_id, id, name) VALUES ($1, $2, $3)", [roomId, id, name]);

    const row = await dbGet("SELECT id, name AS name FROM users WHERE room_id = $1 AND id = $2", [roomId, id]);
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
      updates.push("name = $1");
      params.push(name);
    }

    if (!updates.length) {
      return res.status(400).json({ error: "No fields to update" });
    }

    const roomId = req.body.roomId || req.query.roomId || "";
    params.push(roomId);
    params.push(playerId);
    const result = await dbRun(`UPDATE users SET ${updates.join(", ")} WHERE room_id = $2 AND id = $3`, params);
    const changes = result.rowCount || 0;
    if (changes === 0) {
      return res.status(404).json({ error: "User not found" });
    }

    const row = await dbGet("SELECT id, name AS name FROM users WHERE room_id = $1 AND id = $2", [roomId, playerId]);
    res.json(row);
  } catch (err) {
    handleDbError(res, err);
  }
});

// DELETE /users/:id -> delete a user
app.delete("/users/:id", async (req, res) => {
  try {
    const playerId = Number(req.params.id);
    const roomId = req.query.roomId || "";
    if (Number.isNaN(playerId)) {
      return res.status(400).json({ error: "Invalid player id" });
    }

    const result = await dbRun("DELETE FROM users WHERE room_id = $1 AND id = $2", [roomId, playerId]);
    const changes = result.rowCount || 0;
    if (changes === 0) {
      return res.status(404).json({ error: "User not found" });
    }

    res.status(204).send();
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
    const row = await dbGet("SELECT name AS name FROM players WHERE id = $1", [playerId]);
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

    const result = await dbRun("INSERT INTO players (id, name, league, active) VALUES (gen_random_uuid(), $1, $2, true) RETURNING id", [name, req.body.league || 'NBA']);
    const id = result.rows[0].id;

    const row = await dbGet("SELECT id, name AS name FROM players WHERE id = $1", [id]);
    res.status(201).json(row);
  } catch (err) {
    handleDbError(res, err);
  }
});

app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
  console.log(`DB mode: PostgreSQL`);
});
