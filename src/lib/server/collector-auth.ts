import {config,HttpError} from './db';
export function authorizeCollector(request:Request){const secret=config('CATALOG_INGEST_SECRET');if(secret.length<32||request.headers.get('authorization')!==`Bearer ${secret}`)throw new HttpError(401,'Yetkisiz veri toplayıcı.');}
