import serverless from 'serverless-http';
process.env.NETLIFY = 'true';
process.env.NODE_ENV = 'production';
const {default:app} = await import('../../.netlify/runtime/app.mjs');
const handle=serverless(app,{binary:['image/*','video/*','application/octet-stream']});
// The native Functions API preserves ESM and supplies Blob/Database request context.
export default async function handler(request,context){
  const url = new URL(request.url);
  const result = await handle({
    version: '2.0',
    rawPath: url.pathname.replace(/^\/\.netlify\/functions\/api(?=\/)/, ''),
    rawQueryString: url.search.slice(1),
    headers: Object.fromEntries(request.headers),
    requestContext: { http: { method: request.method, sourceIp: context.ip } },
    body: Buffer.from(await request.arrayBuffer()).toString('base64'),
    isBase64Encoded: true,
  }, context);
  const headers = new Headers(result.headers);
  for (const cookie of result.cookies || []) headers.append('set-cookie', cookie);
  const body = result.isBase64Encoded ? Buffer.from(result.body, 'base64') : result.body;
  return new Response(request.method === 'HEAD' ? null : body, { status: result.statusCode, headers });
}
