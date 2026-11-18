import { readdir, rm, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { build } from 'esbuild';

const { CONTEXT: deployContext, BRANCH: branch } = process.env;
const isProduction = deployContext === 'production';
if (!isProduction && (!['branch-deploy', 'deploy-preview'].includes(deployContext) || !branch)) {
  throw new Error('A Netlify deploy context and Git branch are required.');
}
const sandbox = isProduction ? '' :
  `e2l_qa_${createHash('sha256').update(`${deployContext}:${branch}`).digest('hex').slice(0, 24)}`;

// ffprobe-static ships every OS; retain only the build target to fit Lambda's package limit.
const base='node_modules/ffprobe-static/bin';
for(const os of await readdir(base)) {
  if(os!==process.platform) await rm(join(base,os),{recursive:true,force:true});
  else for(const arch of await readdir(join(base,os))) if(arch!==process.arch)await rm(join(base,os,arch),{recursive:true,force:true});
}
execFileSync(process.execPath,['node_modules/vite/bin/vite.js','build'],{stdio:'inherit'});
if (sandbox) {
  await writeFile('dist/_headers', '/*\n  X-Robots-Tag: noindex, nofollow\n');
}
// Remove local SQLite, Vite and disk-serving branches from the hosted runtime.
await build({
  entryPoints:['server/index.mjs'], outfile:'.netlify/runtime/app.mjs',
  bundle:true, platform:'node', target:'node24', format:'esm', packages:'external', minifySyntax:true,
  define:{
    'process.env.NETLIFY':'"true"',
    'process.env.NODE_ENV':'"production"',
    'process.env.E2L_SANDBOX': JSON.stringify(sandbox),
  },
});
if (isProduction && (process.env.E2L_ADMIN_EMAIL || process.env.E2L_ADMIN_PASSWORD)) {
  await import('./bootstrap-admin.mjs');
} else if (deployContext === 'branch-deploy' && branch === 'staging' &&
    (process.env.E2L_QA_ADMIN_EMAIL || process.env.E2L_QA_ADMIN_PASSWORD)) {
  process.env.E2L_SANDBOX = sandbox;
  process.env.E2L_ADMIN_EMAIL = process.env.E2L_QA_ADMIN_EMAIL;
  process.env.E2L_ADMIN_PASSWORD = process.env.E2L_QA_ADMIN_PASSWORD;
  await import('./bootstrap-admin.mjs');
}
