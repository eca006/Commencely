import { DatabaseSync } from 'node:sqlite';
import { scrypt } from 'node:crypto';
import { promisify } from 'node:util';
import { mkdirSync, readFileSync } from 'node:fs';
import { accountRoute } from './sites/accounts.mjs';
import { createRecoveryMail } from './sites/recovery-mail.mjs';

const scryptAsync = promisify(scrypt);
let database;
let pending = 0;

function localStore() {
  if (!database) {
    const directory = new URL('./.account-data/', import.meta.url);
    mkdirSync(directory, { recursive: true, mode: 0o700 });
    const db = new DatabaseSync(new URL('accounts.sqlite', directory));
    try {
      db.exec(`
        CREATE TABLE IF NOT EXISTS accounts (id TEXT PRIMARY KEY, login TEXT UNIQUE, salt TEXT, hash TEXT);
        CREATE TABLE IF NOT EXISTS sessions (token TEXT PRIMARY KEY, account TEXT, expires INTEGER);
        CREATE TABLE IF NOT EXISTS schema_migrations (name TEXT PRIMARY KEY);
        BEGIN IMMEDIATE;
      `);
      for (const name of ['0001_two_factor', '0002_recovery']) {
        if (!db.prepare('SELECT name FROM schema_migrations WHERE name = ?').get(name)) {
          db.exec(readFileSync(new URL('./drizzle/' + name + '.sql', import.meta.url), 'utf8'));
          db.prepare('INSERT INTO schema_migrations VALUES (?)').run(name);
        }
      }
      db.exec('COMMIT');
      database = db;
    } catch (error) {
      db.close();
      throw error;
    }
  }
  return {
    prepare(sql) {
      return { bind(...args) {
        const query = database.prepare(sql);
        return {
          first(column) {
            const row = query.get(...args);
            return (column ? row?.[column] : row) ?? null;
          },
          run() { return { meta: { changes: query.run(...args).changes } }; }
        };
      } };
    },
    batch(statements) {
      database.exec('BEGIN IMMEDIATE');
      try {
        const results = statements.map(statement => statement.run());
        database.exec('COMMIT');
        return results;
      } catch (error) {
        database.exec('ROLLBACK');
        throw error;
      }
    }
  };
}

export async function accountRequest(req, res, path) {
  const send = (status, body, cookie) => {
    res.writeHead(status, {
      'Content-Type': 'application/json', 'Cache-Control': 'no-store',
      ...(cookie ? { 'Set-Cookie': cookie } : {})
    });
    res.end(JSON.stringify(body));
  };
  if (req.method === 'POST' && pending >= 4) return send(429, { error: 'Please try again in a moment.' });
  const protocol = req.socket.encrypted || process.env.ACCOUNT_SECURE_COOKIE === 'yes' ? 'https:' : 'http:';
  const url = new URL(path, protocol + '//' + req.headers.host);
  let body;
  if (req.method === 'POST') {
    body = '';
    for await (const chunk of req) {
      body += chunk;
      if (body.length > 4096) return send(413, { error: 'Request is too large.' });
    }
  }
  const request = new Request(url, { method: req.method, headers: req.headers, body });
  pending++;
  try {
    return await accountRoute(request, url, localStore(), send,
      async (password, salt) => (await scryptAsync(password, salt, 64)).toString('hex'),
      { mail: createRecoveryMail(process.env), clientAddress: req.socket.remoteAddress });
  } finally {
    pending--;
  }
}
