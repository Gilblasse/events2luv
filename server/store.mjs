// Keep local Docker/SQLite support; Netlify uses durable managed PostgreSQL.
const backend = process.env.NETLIFY ? await import('./postgres-store.mjs') : await import('./sqlite-store.mjs');
export const { db, dataDir, verify, hashToken, passwordHash, allBlocks, saveBlock, changePassword, createSession } = backend;
