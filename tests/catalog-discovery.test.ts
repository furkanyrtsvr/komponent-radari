import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {listingEvidence} from '../scripts/catalog/discover-pilsitesi';
import {isProductSitemap} from '../scripts/catalog/sitemap-kind.mjs';
test('Woo product categories and brands cannot be ingested as saleable products',()=>{
 for(const url of ['/product-sitemap.xml','/product-sitemap2.xml','/sitemap/products/1.xml','/xml/sitemap_product_49.xml'])assert.equal(isProductSitemap(url),true,url);
 for(const url of ['/product_cat-sitemap.xml','/product_brand-sitemap.xml','/sitemap_image_1.xml'])assert.equal(isProductSitemap(url),false,url);
});
test('Pil Sitesi fallback follows rendered product cards and pagination, never foreign or account links',()=>{
 const html=readFileSync(new URL('./fixtures/merchants/integration-2026-10-20/pilsitesi-listing.html',import.meta.url),'utf8');
 const found=listingEvidence(html+'<div class="productItem"><a class="detailLink" href="https://attacker.example/p">Foreign</a></div><a href="/hesabim">Account</a>','https://www.pilsitesi.com/sarj-cihazlari');
 assert.equal(found.products.length,2);assert.ok(found.products.every(url=>url.startsWith('https://www.pilsitesi.com/')));assert.ok(found.pages.includes('https://www.pilsitesi.com/sarj-cihazlari?sayfa=2'));assert.equal(found.pages.some(url=>url.endsWith('/hesabim')),false);
});
