import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PGlite } from '@electric-sql/pglite';
import { createPostgresStore } from '../server/postgres-store.mjs';
import { putMedia, sendMedia, removeMedia } from '../server/netlify-media.mjs';

test('PostgreSQL adapter preserves versions, revisions, publication and durable sessions',async()=>{
  const pg=new PGlite();
  // PGlite is a single connection; advisory locks are exercised on the real host later.
  const query=async(sql,args=[])=>{
    if(sql.startsWith('SELECT pg_advisory_xact_lock'))return {rows:[]};
    if(sql.includes('CREATE TABLE')) {await pg.exec(sql);return {rows:[]};}
    const r=await pg.query(sql,args);return {...r,rowCount:r.affectedRows};
  };
  const pool={query,connect:async()=>({query,release(){}})};
  const a=createPostgresStore(()=>pool);
  const value={type:'text',text:'Saved on Netlify'};
  assert.equal((await a.saveBlock('test',value,0,'qa@example.test')).version,1);
  assert.equal(await a.saveBlock('test',{...value,text:'Stale'},0,'qa@example.test'),null);
  assert.equal((await a.allBlocks()).test.value.text,value.text);
  await a.saveBlock('test',{...value,text:'Revision two'},1,'qa@example.test');
  assert.equal((await a.db.prepare('SELECT * FROM revisions').all()).length,1);
  await a.db.prepare('INSERT INTO sessions VALUES(?,?,?,?)').run('hash','qa@example.test','csrf',Date.now()+5000);
  const b=createPostgresStore(()=>pool);
  assert.equal((await b.db.prepare('SELECT * FROM sessions WHERE token=?').get('hash')).csrf,'csrf');
  await a.db.prepare('INSERT INTO media VALUES(?,?,?,?,0,?)').run('image.webp','image.webp','image/webp','qa@example.test',new Date().toISOString());
  const picture={type:'image',src:'/media/image.webp',alt:'Test',x:50,y:50};
  await a.saveBlock('picture',picture,0,'qa@example.test');
  assert.equal((await a.db.prepare('SELECT * FROM media WHERE id=?').get('image.webp')).published,1);
  await assert.rejects(a.saveBlock('missing',{...picture,src:'/media/missing.webp'},0,'qa@example.test'),/not available/);
  assert.equal((await a.allBlocks()).missing,undefined);
  assert.equal(await a.rate('login',1,60000),true);
  assert.equal(await a.rate('login',1,60000),false);
  await pg.close();
});

test('durable media chunks support bounded video range reads and cancellation cleanup',async()=>{
  const map=new Map();
  const storage={set:async(k,v)=>map.set(k,Buffer.from(v)),setJSON:async(k,v)=>map.set(k,v),get:async(k)=>map.get(k)??null,delete:async(k)=>map.delete(k)};
  const input=Buffer.alloc(3*1024*1024,42);
  await putMedia('clip.mp4',input,storage);
  const response=()=>({statusCode:200,headers:{},status(n){this.statusCode=n;return this},set(k,v){if(typeof k==='object')Object.assign(this.headers,k);else this.headers[k]=v;return this},send(b){this.body=b;return this},end(){return this},sendStatus(n){this.statusCode=n;return this}});
  const res=response();
  await sendMedia({headers:{range:'bytes=2097150-2097160'}},res,{id:'clip.mp4',mime:'video/mp4'},storage);
  assert.equal(res.statusCode,206);assert.equal(res.body.length,11);assert.deepEqual(res.body,input.subarray(2097150,2097161));
  const bad=response();await sendMedia({headers:{range:'bytes=99999999-'}},bad,{id:'clip.mp4',mime:'video/mp4'},storage);assert.equal(bad.statusCode,416);
  await removeMedia('clip.mp4',storage);assert.equal(map.size,0);
});

test('staging writes stay in its own schema even when using the production pool', async () => {
  const pg = new PGlite();
  try {
    const query = async (sql, args) => {
      if (sql.startsWith('SELECT pg_advisory_xact_lock')) return { rows: [] };
      if (sql.includes('CREATE TABLE')) return pg.exec(sql);
      const result = await pg.query(sql, args);
      return { ...result, rowCount: result.affectedRows };
    };
    const pool = { query, connect: async () => ({ query, release() {} }) };
    const production = createPostgresStore(() => pool);
    const sandbox = 'e2l_qa_' + 'a'.repeat(24);
    const staging = createPostgresStore(() => pool, sandbox);
    const preview = createPostgresStore(() => pool, 'e2l_qa_' + 'b'.repeat(24));

    await production.saveBlock('hero', { type: 'text', text: 'Production' }, 0, 'owner@example.test');
    assert.deepEqual(await staging.allBlocks(), {});
    await staging.saveBlock('hero', { type: 'text', text: 'Staging' }, 0, 'qa@example.test');
    assert.equal((await staging.allBlocks()).hero.value.text, 'Staging');
    assert.equal((await production.allBlocks()).hero.value.text, 'Production');
    assert.deepEqual(await preview.allBlocks(), {});
  } finally {
    await pg.close();
  }
});
