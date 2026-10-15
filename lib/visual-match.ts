import jpeg from 'jpeg-js';
import {decode as decodePng,convertIndexedToRgb} from 'fast-png';
export type VisualFingerprint={bits:string;histogram:number[];aspect:number};
export type VisualMatch='same-photo'|'similar-photo'|'different-photo'|'unavailable';
type Pixels={width:number;height:number;data:ArrayLike<number>;channels:number};
/** Compact image evidence, not an assertion of electrical interchangeability.
 * Different angles or backgrounds must never reject a correctly specified item. */
export function fingerprintPixels({width,height,data,channels}:Pixels):VisualFingerprint|null{
 if(width<24||height<24||width*height>1_500_000||channels<3)return null;
 const luminance=(x:number,y:number)=>{const i=(y*width+x)*channels,alpha=channels===4?data[i+3]/255:1;return (data[i]*.299+data[i+1]*.587+data[i+2]*.114)*alpha+255*(1-alpha);};
 let minX=width,minY=height,maxX=0,maxY=0,count=0;
 const stride=Math.max(1,Math.floor(Math.sqrt(width*height/50000)));
 // Trim white catalog margins so resizing and padding do not dominate the hash.
 for(let y=0;y<height;y+=stride)for(let x=0;x<width;x+=stride)if(luminance(x,y)<238){minX=Math.min(minX,x);maxX=Math.max(maxX,x);minY=Math.min(minY,y);maxY=Math.max(maxY,y);count++;}
 if(count<40||maxX-minX<12||maxY-minY<12)return null;
 const w=maxX-minX+1,h=maxY-minY+1,histogram=Array(12).fill(0) as number[];
 const sample=(sx:number,sy:number)=>{
  const x=Math.min(width-1,Math.round(minX+(sx+.5)*w/9)),y=Math.min(height-1,Math.round(minY+(sy+.5)*h/8));
  return luminance(x,y);
 };
 let bits='';
 for(let y=0;y<8;y++)for(let x=0;x<8;x++)bits+=sample(x,y)>sample(x+1,y)?'1':'0';
 let samples=0;
 for(let y=minY;y<=maxY;y+=stride)for(let x=minX;x<=maxX;x+=stride){const i=(y*width+x)*channels;if(luminance(x,y)>238)continue;for(let c=0;c<3;c++)histogram[c*4+Math.min(3,Math.floor(data[i+c]/64))]++;samples++;}
 if(!samples||Math.min([...bits].filter(b=>b==='1').length,[...bits].filter(b=>b==='0').length)<4)return null;
 return {bits,histogram:histogram.map(n=>n/(samples*3)),aspect:w/h};
}
export function fingerprintImage(bytes:Uint8Array):VisualFingerprint|null{
 try{
  if(bytes[0]===255&&bytes[1]===216){const p=jpeg.decode(bytes,{useTArray:true,maxResolutionInMP:1.5,maxMemoryUsageInMB:32});return fingerprintPixels({...p,channels:4});}
  if(bytes[0]===137&&bytes[1]===80&&bytes.length>24){
   const view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);
   if(view.getUint32(16)*view.getUint32(20)>1_500_000)return null;
   let p=decodePng(bytes);if(p.palette)p={...p,data:convertIndexedToRgb(p),channels:p.palette[0].length,depth:8};
   if(p.depth!==8)return null;return fingerprintPixels(p);
  }
 }catch(error){console.warn('Product photo decode unavailable:',error instanceof Error?error.message:'unsupported image');}
 return null;
}
export function compareFingerprints(a:VisualFingerprint|null,b:VisualFingerprint|null):VisualMatch{
 if(!a||!b)return 'unavailable';
 const distance=[...a.bits].filter((v,i)=>v!==b.bits[i]).length;
 const color=a.histogram.reduce((n,v,i)=>n+Math.abs(v-b.histogram[i]),0);
 const aspect=Math.abs(Math.log(a.aspect/b.aspect));
 return distance===0&&color<.02&&aspect<.02?'same-photo':distance<=5&&color<.18&&aspect<.18?'similar-photo':'different-photo';
}
