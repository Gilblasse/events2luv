import serverless from 'serverless-http';
import { connectLambda } from '@netlify/blobs';
process.env.NETLIFY = 'true';
process.env.NODE_ENV = 'production';
const {default:app} = await import('../../server/index.mjs');
const handle=serverless(app,{binary:['image/*','video/*','application/octet-stream']});
export async function handler(event,context){
  connectLambda(event);
  event.path = event.path.replace(/^\/\.netlify\/functions\/api(?=\/)/, '');
  return handle(event,context);
}
