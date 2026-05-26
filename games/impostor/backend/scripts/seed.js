#!/usr/bin/env node
// Runs all DB migration + seed SQL files at startup.
// Safe to run multiple times: tables use IF NOT EXISTS, seeds are skipped if data already exists.

const { Pool } = require("pg");
const fs = require("fs");
const path = require("path");

const DEFAULT_DATABASE_URL =
  'postgresql://neondb_owner:npg_1AHcQMk6ouSv@ep-jolly-waterfall-akwyad7n-pooler.c-3.us-west-2.aws.neon.tech/neondb?sslmode=require&channel_binding=require';
const databaseUrl = process.env.DATABASE_URL || DEFAULT_DATABASE_URL;
const pool = new Pool({ connectionString: databaseUrl, ssl: { rejectUnauthorized: false } });

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

    // Migrate users table to support room_id for multi-session isolation
    await pool.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'users' AND column_name = 'room_id'
        ) THEN
          ALTER TABLE users DROP CONSTRAINT IF EXISTS users_pkey;
          ALTER TABLE users ADD COLUMN room_id VARCHAR(36) NOT NULL DEFAULT '';
          ALTER TABLE users ADD PRIMARY KEY (room_id, id);
        END IF;
      END $$;
    `);

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
