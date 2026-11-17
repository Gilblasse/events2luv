import serverless from 'serverless-http';
import { connectLambda } from '@netlify/blobs';
import app from '../../server/index.mjs';
const handle=serverless(app,{binary:['image/*','video/*','application/octet-stream']});
export async function handler(event,context){
  connectLambda(event);
  event.path = event.path.replace(/^\/\.netlify\/functions\/api(?=\/)/, "");
  return handle(event,context);
}
