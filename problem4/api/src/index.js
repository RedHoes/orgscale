const express = require("express");
const { Pool } = require("pg");
const Redis = require("ioredis");

const app = express();
const port = Number(process.env.PORT || 3000);

const pool = new Pool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER || "app",
  password: process.env.DB_PASSWORD || "app",
  database: process.env.DB_NAME || "app",
  port: 5432,
  max: 10,
});

const redis = new Redis({
  host: process.env.REDIS_HOST,
  port: 6379,
  lazyConnect: true,
  maxRetriesPerRequest: 1,
});

async function checkDependencies() {
  await pool.query("SELECT 1");

  if (redis.status !== "ready") {
    await redis.connect();
  }

  await redis.ping();
}

app.get("/api/users", async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT id, name, role FROM users ORDER BY id ASC"
    );

    await redis.set("last_call", String(Date.now()));
    res.json({ ok: true, users: result.rows });
  } catch (err) {
    console.error("users endpoint failed", err);
    res.status(500).json({ ok: false, error: err.message });
  }
});

app.get("/status", (req, res) => {
  res.json({ status: "ok" });
});

app.get("/healthz", async (req, res) => {
  try {
    await checkDependencies();
    res.json({ status: "ok" });
  } catch (err) {
    console.error("healthcheck failed", err.message);
    res.status(503).json({ status: "degraded", error: err.message });
  }
});

app.listen(port, async () => {
  try {
    await checkDependencies();
    console.log(`API running on ${port}`);
  } catch (err) {
    console.error("startup dependency check failed", err.message);
  }
});
