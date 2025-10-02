import sqlite3 from "sqlite3";
import path from "node:path";

sqlite3.verbose();

const databasePath = path.join(process.cwd(), "db", "transparency.sqlite");

function withDatabase(mode, executor) {
  return new Promise((resolve, reject) => {
    const db = new sqlite3.Database(databasePath, mode, (openError) => {
      if (openError) {
        reject(openError);
        return;
      }

      const settle = (error, result) => {
        db.close((closeError) => {
          if (error) {
            reject(error);
          } else if (closeError) {
            reject(closeError);
          } else {
            resolve(result);
          }
        });
      };

      Promise.resolve()
        .then(() => executor(db))
        .then((result) => settle(null, result))
        .catch((error) => settle(error));
    });
  });
}

function dbAll(db, query, params = []) {
  return new Promise((resolve, reject) => {
    db.all(query, params, (error, rows) => {
      if (error) {
        reject(error);
        return;
      }
      resolve(rows);
    });
  });
}

function dbGet(db, query, params = []) {
  return new Promise((resolve, reject) => {
    db.get(query, params, (error, row) => {
      if (error) {
        reject(error);
        return;
      }
      resolve(row ?? null);
    });
  });
}

function dbRun(db, query, params = []) {
  return new Promise((resolve, reject) => {
    db.run(query, params, function (error) {
      if (error) {
        reject(error);
        return;
      }
      resolve({ changes: this.changes, lastID: this.lastID });
    });
  });
}

export function queryAll(query, params = []) {
  return withDatabase(sqlite3.OPEN_READONLY, (db) => dbAll(db, query, params));
}

export function queryOne(query, params = []) {
  return withDatabase(sqlite3.OPEN_READONLY, (db) => dbGet(db, query, params));
}

export function runInTransaction(executor) {
  return withDatabase(sqlite3.OPEN_READWRITE, async (db) => {
    await dbRun(db, "BEGIN IMMEDIATE TRANSACTION");
    try {
      const result = await executor({
        run: (query, params) => dbRun(db, query, params),
        all: (query, params) => dbAll(db, query, params),
        get: (query, params) => dbGet(db, query, params),
      });
      await dbRun(db, "COMMIT");
      return result;
    } catch (error) {
      await dbRun(db, "ROLLBACK").catch(() => {});
      throw error;
    }
  });
}

export { queryAll as selectAll, queryOne as selectOne };
