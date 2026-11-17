import { readdir, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { build } from 'esbuild';
// ffprobe-static ships every OS; retain only the build target to fit Lambda's package limit.
const base='node_modules/ffprobe-static/bin';
for(const os of await readdir(base)) {
  if(os!==process.platform) await rm(join(base,os),{recursive:true,force:true});
  else for(const arch of await readdir(join(base,os))) if(arch!==process.arch)await rm(join(base,os,arch),{recursive:true,force:true});
}
execFileSync(process.execPath,['node_modules/vite/bin/vite.js','build'],{stdio:'inherit'});
// Remove local SQLite, Vite and disk-serving branches from the hosted runtime.
await build({
  entryPoints:['server/index.mjs'], outfile:'.netlify/runtime/app.mjs',
  bundle:true, platform:'node', target:'node24', format:'esm', packages:'external', minifySyntax:true,
  define:{'process.env.NETLIFY':'"true"','process.env.NODE_ENV':'"production"'},
});
if (process.env.E2L_ADMIN_EMAIL || process.env.E2L_ADMIN_PASSWORD)
  await import('./bootstrap-admin.mjs');
