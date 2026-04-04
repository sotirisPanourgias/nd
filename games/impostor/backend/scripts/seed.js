#!/usr/bin/env node
// Runs all DB migration + seed SQL files at startup.
// Safe to run multiple times: tables use IF NOT EXISTS, seeds are skipped if data already exists.

const { Pool } = require("pg");
const fs = require("fs");
const path = require("path");

const pool = new Pool(
  process.env.DATABASE_URL
    ? { connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } }
    : {
        host: process.env.DB_HOST || "127.0.0.1",
        user: process.env.DB_USER || "impostor_user",
        password: process.env.DB_PASSWORD || "impostor_pass",
        database: process.env.DB_NAME || "impostor",
        port: Number(process.env.DB_PORT) || 5432,
      }
);

const DB_SCRIPTS_DIR = path.join(__dirname, "../../db/scripts");

const runFile = async (filePath) => {
  const sql = fs.readFileSync(filePath, "utf8").replace(/^\uFEFF/, "");
  await pool.query(sql);
  console.log(`[seed] ran ${path.basename(filePath)}`);
};

const seed = async () => {
  try {
    // Always run schema (IF NOT EXISTS guards it)
    await runFile(path.join(DB_SCRIPTS_DIR, "001_create_tables.sql"));

    // Only seed if tables are empty
    const { rows } = await pool.query("SELECT COUNT(*) AS count FROM players");
    if (parseInt(rows[0].count, 10) > 0) {
      console.log("[seed] data already present, skipping seed files.");
      return;
    }

    const seedFiles = fs
      .readdirSync(DB_SCRIPTS_DIR)
      .filter((f) => f.endsWith(".sql") && f !== "001_create_tables.sql")
      .sort();

    for (const file of seedFiles) {
      await runFile(path.join(DB_SCRIPTS_DIR, file));
    }

    console.log("[seed] database seeded successfully.");
  } catch (err) {
    console.error("[seed] error:", err.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
};

seed();
