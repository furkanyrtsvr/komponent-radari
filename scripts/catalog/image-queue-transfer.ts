import type {DatabaseSync} from 'node:sqlite';
import {rememberImage} from './image-queue-state';
type Image={key:string;bytes:Uint8Array;originalBytes:number};
/** A downloaded but unacknowledged file stays in the durable queue. Retrying
 * server uploads/registration must never fetch its merchant source again. */
export async function stageQueuedImage(db:DatabaseSync,source:string,hooks:{prepare:(source:string)=>Promise<Image>;upload:(key:string,bytes:Uint8Array)=>Promise<unknown>}){
 let row=db.prepare('SELECT * FROM jobs WHERE source=?').get(source) as any;if(!row)throw Error('Görsel işi bulunamadı.');if(row.key&&row.indexed>0)return {downloaded:false};let downloaded=false;
 if(!row.key){const image=await hooks.prepare(source);rememberImage(db,source,{key:image.key,bytes:image.bytes.length,original_bytes:image.originalBytes,indexed:false},image.bytes);downloaded=true;row=db.prepare('SELECT * FROM jobs WHERE source=?').get(source);}
 if(row.blob){await hooks.upload(row.key,row.blob);db.prepare('UPDATE jobs SET blob=NULL WHERE source=?').run(source);}
 return {downloaded};
}
