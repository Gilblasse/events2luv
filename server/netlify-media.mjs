import express from 'express';
import { getStore } from '@netlify/blobs';
import { randomUUID } from 'node:crypto';
const CHUNK = 2 * 1024 * 1024;
const sandbox = process.env.E2L_SANDBOX;
const store = () => getStore({
  name: sandbox ? `events2luv-media-${sandbox}` : 'events2luv-media',
  consistency: 'strong',
});
export async function putMedia(id,buffer,storage=store()) {
  for(let i=0;i<buffer.length;i+=CHUNK) await storage.set(`${id}/${i/CHUNK}`,buffer.subarray(i,i+CHUNK));
  await storage.setJSON(`${id}/meta`,{size:buffer.length});
}
export async function removeMedia(id,storage=store()) {
  const m=await storage.get(`${id}/meta`,{type:'json'});
  if(m) for(let i=0;i<Math.ceil(m.size/CHUNK);i++) await storage.delete(`${id}/${i}`);
  await storage.delete(`${id}/meta`);
}
export async function sendMedia(req,res,m,storage=store()) {
  const meta=await storage.get(`${m.id}/meta`,{type:'json'});
  if(!meta) return res.sendStatus(404);
  const range=req.headers.range;
  let start=0,end=meta.size-1;
  if(range) {
    const r=/^bytes=(\d*)-(\d*)$/.exec(range);
    if(!r || (!r[1]&&!r[2])) return res.status(416).set('Content-Range',`bytes */${meta.size}`).end();
    if(!r[1]) start=Math.max(0,meta.size-Number(r[2]));
    else {start=Number(r[1]); if(r[2])end=Math.min(end,Number(r[2]));}
    end=Math.min(end,start+CHUNK-1);
    if(start>end || start>=meta.size) return res.status(416).set('Content-Range',`bytes */${meta.size}`).end();
    res.status(206).set('Content-Range',`bytes ${start}-${end}/${meta.size}`);
  } else if(meta.size>CHUNK && m.mime.startsWith('video/')) {
    end=CHUNK-1;
    res.status(206).set('Content-Range',`bytes 0-${end}/${meta.size}`);
  }
  const pieces=[];
  for(let i=Math.floor(start/CHUNK);i<=Math.floor(end/CHUNK);i++) {
    const b=await storage.get(`${m.id}/${i}`,{type:'arrayBuffer'});
    if(!b)return res.sendStatus(404);
    pieces.push(Buffer.from(b).subarray(Math.max(0,start-i*CHUNK),Math.min(CHUNK,end-i*CHUNK+1)));
  }
  res.set({'Accept-Ranges':'bytes','Content-Length':String(end-start+1)}).send(Buffer.concat(pieces));
}
export function installChunkUploads(app,{gate,origin,csrf,db,processVideo,sharp}) {
  if(!process.env.NETLIFY)return;
  app.post('/api/uploads/start',gate,origin,csrf,async(req,res)=>{
    const {size,mime,name}=req.body;
    if(!Number.isInteger(size)||size<1||size>100*1024*1024||typeof name!=='string'||name.length>250||!['image/jpeg','image/png','image/webp','video/mp4','video/webm','text/vtt'].includes(mime)) return res.status(400).json({error:'Choose a supported file under 100 MB.'});
    const {rate}=await import('./postgres-store.mjs');
    if(!await rate('upload:'+req.session.email,30,3600000))return res.status(429).json({error:'Upload limit reached. Try again later.'});
    const id=randomUUID();
    await store().setJSON(`pending/${id}/meta`,{size,mime,name,owner:req.session.email,expires:Date.now()+3600000});
    res.json({id,chunkSize:CHUNK});
  });
  const metaFor=async(req)=>{
    if(!/^[a-f0-9-]{36}$/.test(req.params.id))return null;
    const m=await store().get(`pending/${req.params.id}/meta`,{type:'json'});
    return m&&m.owner===req.session.email&&m.expires>Date.now()?m:null;
  };
  app.put('/api/uploads/:id/:part',gate,origin,csrf,express.raw({type:'application/octet-stream',limit:CHUNK}),async(req,res)=>{
    const m=await metaFor(req),i=Number(req.params.part);
    if(!m||!Number.isInteger(i)||i<0||i>=Math.ceil(m.size/CHUNK)||!Buffer.isBuffer(req.body)||req.body.length!==Math.min(CHUNK,m.size-i*CHUNK))return res.status(400).json({error:'Invalid upload chunk.'});
    await store().set(`pending/${req.params.id}/${i}`,req.body);
    res.json({ok:true});
  });
  app.post('/api/uploads/:id/finish',gate,origin,csrf,async(req,res)=>{
    const m=await metaFor(req);
    if(!m)return res.status(400).json({error:'Upload expired. Choose the file again.'});
    try {
      const parts=[];
      for(let i=0;i<Math.ceil(m.size/CHUNK);i++) {
        const b=await store().get(`pending/${req.params.id}/${i}`,{type:'arrayBuffer'});
        if(!b||b.byteLength!==Math.min(CHUNK,m.size-i*CHUNK))throw Error('Upload is incomplete. Choose the file again.');
        parts.push(Buffer.from(b));
      }
      const input=Buffer.concat(parts); let buffer,mime,ext,meta={};
      if(m.mime.startsWith('image/')) {
        if(input.length>15*1024*1024)throw Error('Images must be 15 MB or smaller.');
        const info=await sharp(input,{limitInputPixels:40000000}).metadata();
        if(!['jpeg','png','webp'].includes(info.format))throw Error('Use JPG, PNG or WebP.');
        buffer=await sharp(input,{limitInputPixels:40000000}).rotate().resize({width:3000,height:3000,fit:'inside',withoutEnlargement:true}).webp({quality:85}).toBuffer();
        if(buffer.length>CHUNK)throw Error('This image is too detailed. Resize it below 2000 pixels and try again.');
        const out=await sharp(buffer).metadata();meta={width:out.width,height:out.height};mime='image/webp';ext='webp';
      } else if(m.mime==='text/vtt') {
        if(input.length>1024*1024||!input.toString('utf8').startsWith('WEBVTT'))throw Error('Use valid WebVTT captions under 1 MB.');
        buffer=input;mime='text/vtt';ext='vtt';
      } else ({buffer,mime,ext,meta}=await processVideo(input));
      const id=randomUUID()+'.'+ext;
      await putMedia(id,buffer);
      await db.prepare('INSERT INTO media VALUES(?,?,?,?,0,?)').run(id,id,mime,req.session.email,new Date().toISOString());
      for(let i=0;i<parts.length;i++)await store().delete(`pending/${req.params.id}/${i}`);
      await store().delete(`pending/${req.params.id}/meta`);
      res.json({src:'/media/'+id,mime,...meta});
    }catch(e){res.status(400).json({error:e.message||'Upload could not be processed.'});}
  });
}
