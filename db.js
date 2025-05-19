// db.js
const path = require("path");
const dbPath = path.join(__dirname, "tg-bot", "bot.db");
const sqlite3 = require("sqlite3").verbose();

// This will create a file named 'data.db' or open it if it already exists
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error("Error opening database", err.message);
  } else {
    console.log("Connected to SQLite database");
  }
});

module.exports = db;
