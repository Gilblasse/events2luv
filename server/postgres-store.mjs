import { getDatabase } from '@netlify/database';
export { verify, hashToken, passwordHash } from './password.mjs';
export const dataDir = '/tmp/events2luv';
let cachedPool;
const defaultPool = () => (cachedPool ??= getDatabase().pool);
export function createPostgresStore(pool, sandbox = '') {
if (sandbox && !/^e2l_qa_[0-9a-f]{24}$/.test(sandbox)) {
  throw new Error('Invalid QA database schema.');
}
async function transaction(work) {
  const client = await pool().connect();
  try {
    await client.query('BEGIN');
    if (sandbox) await client.query(`SET LOCAL search_path TO "${sandbox}"`);
    const result = await work(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
function query(sql, args) {
  if (sandbox) return transaction(client => client.query(sql, args));
  return pool().query(sql, args);
}
let ready;
const schema = `
CREATE TABLE IF NOT EXISTS blocks(id TEXT PRIMARY KEY,value TEXT NOT NULL,version INTEGER NOT NULL DEFAULT 1,updated_at TEXT,editor TEXT);
CREATE TABLE IF NOT EXISTS admins(email TEXT PRIMARY KEY,password TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS sessions(token TEXT PRIMARY KEY,email TEXT NOT NULL,csrf TEXT NOT NULL,expires BIGINT NOT NULL);
CREATE TABLE IF NOT EXISTS revisions(id BIGSERIAL PRIMARY KEY,block TEXT,value TEXT,version INTEGER,editor TEXT,created_at TEXT);
CREATE TABLE IF NOT EXISTS media(id TEXT PRIMARY KEY,path TEXT NOT NULL,mime TEXT NOT NULL,owner TEXT NOT NULL,published INTEGER NOT NULL DEFAULT 0,created_at TEXT);
CREATE TABLE IF NOT EXISTS inquiries(id TEXT PRIMARY KEY,payload TEXT NOT NULL,created_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS rate_limits(id TEXT PRIMARY KEY,count INTEGER NOT NULL,expires BIGINT NOT NULL);
`;
async function init() {
  if (!ready) {
    const setup = sandbox ? transaction(async client => {
      await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [sandbox]);
      await client.query(`CREATE SCHEMA IF NOT EXISTS "${sandbox}"`);
      await client.query(schema);
    }) : query(schema);
    ready = setup.catch(error => { ready = null; throw error; });
  }
  await ready;
}
function parameters(sql) { let n = 0; return sql.replace(/\?/g, () => '$' + ++n); }
const db = { prepare(sql) {
  const run = async (...values) => { await init(); return query(parameters(sql), values); };
  return { run, get: async (...v) => (await run(...v)).rows[0], all: async (...v) => (await run(...v)).rows };
}};
async function allBlocks() {
  return Object.fromEntries((await db.prepare('SELECT * FROM blocks').all()).map(r => [r.id,{value:JSON.parse(r.value),version:r.version}]));
}
async function saveBlock(id,value,version,email) {
  await init();
  return transaction(async client => {
    // Serialize creates as well as updates to this block across function instances.
    await client.query('SELECT pg_advisory_xact_lock(hashtext($1))',[sandbox ? `${sandbox}:${id}` : id]);
    const old = (await client.query('SELECT * FROM blocks WHERE id=$1 FOR UPDATE',[id])).rows[0];
    if ((old?.version || 0) !== version) return null;
    if (old) await client.query('INSERT INTO revisions(block,value,version,editor,created_at) VALUES($1,$2,$3,$4,$5)',[id,old.value,old.version,email,new Date().toISOString()]);
    // Media publication and the block update commit together.
    for (const u of [value.src,value.poster,value.captions]) if (u?.startsWith('/media/')) {
      const r = await client.query('UPDATE media SET published=1 WHERE id=$1 AND (published=1 OR owner=$2) RETURNING id',[u.slice(7),email]);
      if (!r.rowCount) throw Error('Upload is not available.');
    }
    await client.query('INSERT INTO blocks VALUES($1,$2,$3,$4,$5) ON CONFLICT(id) DO UPDATE SET value=excluded.value,version=excluded.version,updated_at=excluded.updated_at,editor=excluded.editor',[id,JSON.stringify(value),version+1,new Date().toISOString(),email]);
    return {value,version:version+1};
  });
}
async function rate(key,max,window) {
  await init();
  const now=Date.now();
  const {rows} = await query(`INSERT INTO rate_limits VALUES($1,1,$2)
    ON CONFLICT(id) DO UPDATE SET count=CASE WHEN rate_limits.expires<$3 THEN 1 ELSE rate_limits.count+1 END,
    expires=CASE WHEN rate_limits.expires<$3 THEN $2 ELSE rate_limits.expires END RETURNING count`,[key,now+window,now]);
  return rows[0].count<=max;
}

return { db, allBlocks, saveBlock, rate };
}
export const { db, allBlocks, saveBlock, rate } = createPostgresStore(defaultPool, process.env.E2L_SANDBOX);
