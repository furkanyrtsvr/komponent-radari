import test from 'node:test';
import assert from 'node:assert/strict';
import jpeg from 'jpeg-js';
import {encode as encodePng} from 'fast-png';
import {fingerprintPixels,fingerprintImage,compareFingerprints} from '../src/lib/visual-match';
import {safeImageUrl,visualMatches} from '../src/lib/server/visual-match';
import {demoOffers,products,storeCatalog} from '../src/lib/catalog';
function photograph(width:number,height:number){
 const data=new Uint8Array(width*height*4);data.fill(255);
 for(let y=0;y<height;y++)for(let x=0;x<width;x++)if(x>width*.15&&x<width*.85&&y>height*.2&&y<height*.8){const i=(y*width+x)*4;data[i]=Math.round(25+150*x/width);data[i+1]=Math.round(30+150*y/height);data[i+2]=Math.round(40+100*Math.sin(x/width*10));}
 return {width,height,data,channels:4};
}
test('visual support compares the actual pixels across resized photos and rejects blank placeholders',()=>{
 const a=fingerprintPixels(photograph(160,160)),b=fingerprintPixels(photograph(240,240));assert.ok(a);assert.ok(b);
 assert.equal(compareFingerprints(a,a),'same-photo');assert.ok(['same-photo','similar-photo'].includes(compareFingerprints(a,b)));
 const blank=new Uint8Array(160*160*4);blank.fill(255);assert.equal(fingerprintPixels({width:160,height:160,data:blank,channels:4}),null);
 assert.equal(compareFingerprints(a,null),'unavailable');
 assert.equal(compareFingerprints(a,{...a,bits:[...a.bits].map(v=>v==='0'?'1':'0').join('')}),'different-photo');
});
test('bounded JPEG and PNG decoding share image evidence without claiming unsupported formats are matches',()=>{
 const p=photograph(100,100),png=encodePng(p),jpg=jpeg.encode(p,90).data;
 assert.ok(fingerprintImage(png));assert.ok(fingerprintImage(jpg));assert.equal(fingerprintImage(new Uint8Array([82,73,70,70])),null);
 assert.equal(fingerprintImage(new Uint8Array([255,216,0])),null);
});
test('image sources cannot request private addresses, foreign hosts or credentials',()=>{
 assert.ok(safeImageUrl('https://robiz.net/image/product.jpg',storeCatalog));assert.ok(safeImageUrl('https://robotistan.witcdn.net/product.png',storeCatalog));
 for(const raw of ['http://robiz.net/image.jpg','https://127.0.0.1/a','https://169.254.169.254/a','https://robiz.net.evil.test/a','https://x:secret@robiz.net/a','https://robiz.net:8000/a'])assert.equal(safeImageUrl(raw,storeCatalog),null);
});
test('image redirects use the Worker-compatible manual mode and cannot reach a foreign host',async()=>{
 const previous=globalThis.fetch,calls:string[]=[];
 globalThis.fetch=(async(input:URL,options:RequestInit)=>{calls.push(input.href);assert.equal(options.redirect,'manual');return new Response(null,{status:302,headers:{location:'https://127.0.0.1/secret'}});}) as typeof fetch;
 try{const p={...products[0],image:'https://robiz.net/redirect-test.jpg'},result=await visualMatches(p,[{...demoOffers[0],id:'redirect',image_url:null}],storeCatalog);assert.equal(result.redirect,'unavailable');assert.equal(calls.length,1);}finally{globalThis.fetch=previous;}
});
test('a copied photograph cannot promote a known different product or electrical variant',async()=>{
 const p={...products[0],image:null};const o={...demoOffers[0],id:'wrong',image_url:null,variant_conflict:'Entegre / modül türü farklı'};
 const result=await visualMatches(p,[o],storeCatalog);assert.equal(result.wrong,'unavailable');assert.ok(o.variant_conflict);
});
