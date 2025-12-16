import * as SQLite from 'expo-sqlite';

// Open the database (async — we'll handle it in setup)
export const getDB = async () => {
  const db = await SQLite.openDatabaseAsync('discstats.db');

  // Enable WAL mode and foreign keys for better performance/reliability
  await db.execAsync(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;
  `);

  // Create all tables if they don't exist
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS games (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT,
      date TEXT NOT NULL,
      teamName TEXT,
      opponentName TEXT,
      teamSize INTEGER DEFAULT 7,
      genderRule TEXT DEFAULT 'none',
      createdAt TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS players (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      number INTEGER,
      gender TEXT DEFAULT 'other',
      createdAt TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS game_players (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      gameId INTEGER,
      playerId INTEGER,
      FOREIGN KEY(gameId) REFERENCES games(id) ON DELETE CASCADE,
      FOREIGN KEY(playerId) REFERENCES players(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS points (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      gameId INTEGER,
      pointNumber INTEGER,
      ourScoreAfter INTEGER,
      opponentScoreAfter INTEGER,
      startingOLine BOOLEAN,
      FOREIGN KEY(gameId) REFERENCES games(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      pointId INTEGER,
      eventType TEXT,
      throwerId INTEGER,
      receiverId INTEGER,
      defenderId INTEGER,
      timestamp TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(pointId) REFERENCES points(id) ON DELETE CASCADE
    );
  `);

  console.log('Database opened and tables created successfully! ✅');
  return db;
};

// We'll call this once on app start
export const setupDatabase = async () => {
  await getDB();  // Opens DB and runs setup
};