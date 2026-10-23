import {mkdirSync,writeFileSync} from 'node:fs';
import {load} from 'cheerio';
import {JsonLdAdapter} from '../../src/stores/base';
import {parseOzdisanProduct} from '../../src/stores/ozdisan';
class Probe extends JsonLdAdapter {async page(url:string){return this.readPage(url);}}
const urls=['https://www.ozdisan.com/p/3d-yazici-aksesuarlari-904/anycubic-extruder-1598304','https://www.ozdisan.com/p/3d-yazici-aksesuarlari-904/anycubic-filament-det-module-1598315','https://www.ozdisan.com/p/3d-yazici-aksesuarlari-904/anycubic-gear-detection-1598296'];
const dir='outputs/ozdisan-diagnostic';mkdirSync(dir,{recursive:true});
for(const [i,url] of urls.entries()){
 if(i)await new Promise(r=>setTimeout(r,3100));
 try{const page=await new Probe({id:'ozdisan',domain:'www.ozdisan.com'}).page(url),$=load(page.html);
 let result;try{const p=parseOzdisanProduct(page.html,page.url);result={price:p.price,minimum:p.minimumOrderQuantity,step:p.orderStep};}catch(e){result={error:String(e)};}
 const cards=$('[class*="ProductDetailTapeCard"][class*="tape-card-container"]');
 const summary={url:page.url,lang:$('html').attr('lang'),title:$('h1').text(),cards:cards.length,cardText:cards.text().slice(0,8000),result};
 // Only public product evidence; no HTTP headers, cookies or account data.
 const scripts=$('script[type="application/ld+json"]').toArray().map(e=>$.html(e)).join('\n');
 const bodyText=$('body').clone().find('script,style').remove().end().text();
 const moq=bodyText.match(/MOQ:\s*[\d,]+/)?.[0]||'',multiple=bodyText.match(/Multiple:\s*[\d,]+/)?.[0]||'';
 writeFileSync(`${dir}/${i}.html`,`<html lang="${summary.lang}"><head>${scripts}</head><body>${$('h1').first().toString()}<p>${moq} ${multiple}</p>${cards.toArray().map(e=>$.html(e)).join('\n')}</body></html>`);
 writeFileSync(`${dir}/${i}.json`,JSON.stringify(summary,null,2));console.log(JSON.stringify(summary));
 }catch(e){console.error(JSON.stringify({url,error:String(e)}));process.exitCode=1;}
}
