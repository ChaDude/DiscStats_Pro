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
      teamId INTEGER,
      startingPuller TEXT DEFAULT 'our', -- 'our' or 'opponent'
      createdAt TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(teamId) REFERENCES teams(id) ON DELETE SET NULL
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
      linePlayers TEXT,
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

    -- New tables for teams and rosters
    CREATE TABLE IF NOT EXISTS teams (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      createdAt TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS team_players (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      teamId INTEGER,
      playerId INTEGER,
      FOREIGN KEY(teamId) REFERENCES teams(id) ON DELETE CASCADE,
      FOREIGN KEY(playerId) REFERENCES players(id) ON DELETE CASCADE,
      UNIQUE(teamId, playerId)
    );
  `);

  return db;
};

// Seed function to populate data if empty
const seedDatabase = async (db: SQLite.SQLiteDatabase) => {
  console.log('Seeding database with example teams...');
  
  const teams = [
    { name: 'Aviators (Men)', type: 'men' },
    { name: 'Valkyries (Women)', type: 'women' },
    { name: 'Vortex (Mixed)', type: 'mixed' }
  ];

  // Helper to get random number 0-99
  const getNum = () => Math.floor(Math.random() * 100);

  // Common names for generation
  const maleNames = ['James', 'John', 'Robert', 'Michael', 'William', 'David', 'Richard', 'Joseph', 'Thomas', 'Charles', 'Christopher', 'Daniel', 'Matthew', 'Anthony', 'Donald', 'Mark', 'Paul', 'Steven', 'Andrew', 'Kenneth', 'Joshua', 'Kevin', 'Brian', 'George'];
  const femaleNames = ['Mary', 'Patricia', 'Jennifer', 'Linda', 'Elizabeth', 'Barbara', 'Susan', 'Jessica', 'Sarah', 'Karen', 'Nancy', 'Lisa', 'Betty', 'Margaret', 'Sandra', 'Ashley', 'Kimberly', 'Emily', 'Donna', 'Michelle', 'Dorothy', 'Carol', 'Amanda', 'Melissa'];

  for (const team of teams) {
    // 1. Create Team
    const result = await db.runAsync('INSERT INTO teams (name) VALUES (?)', [team.name]);
    const teamId = result.lastInsertRowId;

    // 2. Generate 24 Players
    for (let i = 0; i < 24; i++) {
      let name, gender;

      if (team.type === 'men') {
        name = `${maleNames[i % maleNames.length]} ${String.fromCharCode(65 + i)}.` ;
        gender = 'male';
      } else if (team.type === 'women') {
        name = `${femaleNames[i % femaleNames.length]} ${String.fromCharCode(65 + i)}.`;
        gender = 'female';
      } else {
        // Mixed: First 12 female, next 12 male
        if (i < 12) {
          name = `${femaleNames[i]} ${String.fromCharCode(65 + i)}.`;
          gender = 'female';
        } else {
          name = `${maleNames[i - 12]} ${String.fromCharCode(65 + (i - 12))}.`;
          gender = 'male';
        }
      }

      // Insert Player
      const playerResult = await db.runAsync(
        'INSERT INTO players (name, number, gender) VALUES (?, ?, ?)',
        [name, getNum(), gender]
      );
      
      // Link to Team
      await db.runAsync(
        'INSERT INTO team_players (teamId, playerId) VALUES (?, ?)',
        [teamId, playerResult.lastInsertRowId]
      );
    }
  }
  console.log('Seeding complete! 🌱');
};

// We'll call this once on app start
export const setupDatabase = async () => {
  const db = await getDB();
  
  // Check if we need to seed
  const result = await db.getFirstAsync<{ count: number }>('SELECT COUNT(*) as count FROM teams');
  if (result && result.count === 0) {
    await seedDatabase(db);
  } else {
    console.log('Database already initialized. ✅');
  }
};