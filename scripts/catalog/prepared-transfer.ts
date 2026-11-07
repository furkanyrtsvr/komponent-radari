import {ARCHIVE_READY_PAGE} from '../../src/lib/archive-runtime-bounds';
/** Ready rows reuse durable images; bound concurrent requests as well as bodies. */
export async function transferPrepared<T>(rows:T[],send:(rows:T[])=>Promise<unknown>){let next=0;await Promise.all(Array.from({length:4},async()=>{for(;;){const start=next;next+=ARCHIVE_READY_PAGE;if(start>=rows.length)return;await send(rows.slice(start,start+ARCHIVE_READY_PAGE));}}));}
