import { mkdirSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { load } from "cheerio";

// Public sitemap snapshot. Run from the app root, then rebuild and publish the Site.
const merchants = [
  ["direnc", "www.direnc.net"], ["robotistan", "www.robotistan.com"],
  ["robo90", "www.robo90.com"], ["robiz", "robiz.net"],
  ["komponentci", "www.komponentci.net"], ["robotsepeti", "www.robotsepeti.com"],
  ["motorobit", "www.motorobit.com"], ["robolink", "www.robolinkmarket.com"],
  ["samm", "market.samm.com"], ["ozdisan", "www.ozdisan.com"],
  ["robotzade", "www.robotzade.com"], ["robitshop", "www.robitshop.com"],
  ["robocombo", "www.robocombo.com"], ["robotronik", "www.robotronik.com.tr"],
];
const selected=process.argv.find(arg=>arg.startsWith('--stores='))?.slice(9).split(',');
if(selected?.some(id=>!merchants.some(([known])=>known===id)))throw new Error('Unknown merchant');
mkdirSync("work/catalog", { recursive: true });
async function read(url, host) {
  const parsed = new URL(url);
  if (parsed.protocol !== "https:" || parsed.hostname.replace(/^www\./, "") !== host.replace(/^www\./, "")) throw new Error("Foreign sitemap URL");
  const response = await fetch(url, { headers: { "User-Agent": "EUB-PriceComparison/1.0 (+public sitemap indexing)" }, signal: AbortSignal.timeout(30000) });
  if (!response.ok || Number(response.headers.get("content-length") || 0) > 12000000) throw new Error(`${url}: ${response.status}`);
  const text = await response.text();
  if (text.length > 12000000) throw new Error(`${url}: sitemap too large`);
  return text;
}
for (const [id, host] of merchants) {
  if(selected && !selected.includes(id))continue;
  const robots = await read(`https://${host}/robots.txt`, host);
  writeFileSync(`work/catalog/${id}-robots.txt`, robots);
  const root = [...robots.matchAll(/^Sitemap:\s*(\S+)/gim)].map(m => m[1]).find(s => !/image|\/en\//i.test(s)) || `https://${host}/sitemap.xml`;
  const xml = await read(root, host);
  writeFileSync(`work/catalog/${id}-sitemap.xml`, xml);
  const $ = load(xml, { xmlMode: true });
  const maps = $("sitemap > loc").map((_, e) => $(e).text()).get().filter(s => /product|categor|collection|urunler|kategoriler/i.test(s) && !/\/en[/-]/i.test(s));
  const children = [];
  if(!$("sitemap > loc").length && id!=='robiz')children.push({url:root+'#products',locs:$("url > loc").map((_,e)=>$(e).text()).get()});
  for (const url of maps) {
    // IdeaSoft asks crawlers to leave 30 seconds between requests.
    if(/Crawl-delay:\s*30/i.test(robots))await new Promise(resolve=>setTimeout(resolve,30000));
    try {
      const content = await read(url, host);
      const page = load(content, { xmlMode: true });
      const locs=page("url > loc").map((_, e) => page(e).text()).get();
      if(!locs.length)throw new Error('Empty sitemap; keep the previous snapshot');
      children.push({ url:/urunler/i.test(url)?url+'#products':/kategoriler/i.test(url)?url+'#categories':url, locs });
    } catch (error) { throw new Error(`${id}: ${url}: ${error}`); }
  }
  writeFileSync(`work/catalog/${id}-children.json`, JSON.stringify(children));
  console.log(`${id}: ${children.filter(x => /product/i.test(x.url)).reduce((n, x) => n + x.locs.length, 0)} sitemap product URLs`);
}
const result = spawnSync(process.execPath, ["scripts/build-merchant-index.mjs",...(selected?['--stores='+selected.join(',')]:[])], { stdio: "inherit" });
if (result.status !== 0) process.exit(result.status || 1);
