export const ARCHIVE_VERIFY_PAGE=6;
export const ARCHIVE_READY_PAGE=10;
export const ARCHIVE_PAYLOAD_PAGE=25;
export const ARCHIVE_CACHE_BYTES=4*1024*1024;
export function assetPage<T>(rows:T[],cursor:number){if(!Number.isInteger(cursor)||cursor<0||cursor>rows.length)throw new Error('Dosya denetim sırası geçersiz.');return {rows:rows.slice(cursor,cursor+ARCHIVE_VERIFY_PAGE),next:Math.min(rows.length,cursor+ARCHIVE_VERIFY_PAGE)};}
/** Entries are bounded by decoded size, not just the number of compressed files. */
export class ByteCache<T>{
 private values=new Map<string,{value:T;bytes:number}>();bytes=0;
 constructor(private limit=ARCHIVE_CACHE_BYTES){}
 get(key:string){return this.values.get(key)?.value;}
 set(key:string,value:T,bytes:number){this.delete(key);if(bytes>this.limit/2)return;while(this.bytes+bytes>this.limit&&this.values.size)this.delete(this.values.keys().next().value!);this.values.set(key,{value,bytes});this.bytes+=bytes;}
 delete(key:string){const old=this.values.get(key);if(old){this.bytes-=old.bytes;this.values.delete(key);}}
}
export async function boundedText(stream:ReadableStream<Uint8Array>,limit=8*1024*1024){const reader=stream.getReader(),decoder=new TextDecoder(),parts:string[]=[];let size=0;try{for(;;){const {value,done}=await reader.read();if(done)break;size+=value.byteLength;if(size>limit)throw new Error('Katalog parçası güvenli bellek sınırını aşıyor.');parts.push(decoder.decode(value,{stream:true}));}parts.push(decoder.decode());return {text:parts.join(''),bytes:size};}finally{await reader.cancel().catch(()=>{});}}
