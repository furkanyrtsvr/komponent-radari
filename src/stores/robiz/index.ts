import {salePack} from '../sale-evidence';
import { load } from "cheerio";
import { JsonLdAdapter, parsePrice, parseProduct } from "../base";

export function parseRobizProduct(html: string, url: string) {
    const p = parseProduct(html, url);
    const $ = load(html);
    const displayed = parsePrice($(".product-price").first().text());
    const netText = $(".product-tax").first().text();
    const net = /\+\s*KDV|KDV\s*Hariç/i.test(netText) ? parsePrice(netText) : null;
    const explicitGross = net !== null && displayed !== null && net > 0 && displayed > net;
    const minimum = Number($("#product-quantity").attr("data-minimum"));
    if (
      displayed !== p.price ||
      !Number.isSafeInteger(minimum) || minimum < 1 ||
      (!p.vatIncluded && !explicitGross) || p.currency !== "TRY"
    ) return p;
    if($('[name^="option["]').length)return p;
    const pack=salePack(p.name);
    const priceTiers = $(".product-discount").map((_, element) => {
      const text=$(element).text(), range=text.match(/^(\d+)\s+adet\s+ve\s+[üu]zeri\s+([\d.,]+)\s*TL/i);
      return range ? {minimum:Number(range[1])*pack,maximum:null,price:parsePrice(range[2])!} : null;
    }).get().filter(tier=>tier && tier.price>0 && tier.price<=displayed!);
    return { ...p, vatIncluded:true, priceNet:net ?? p.price, vatRate:explicitGross ? Math.round((displayed!/net!-1)*10000)/10000 : p.vatRate,
      packageQuantity: pack, minimumOrderQuantity: minimum*pack,priceTiers,
      orderStep: pack, quantityVerified: true,
      warnings: ["Görünen KDV dahil fiyat ve minimum sipariş miktarı doğrulandı. Kargo ödeme ekranında doğrulanmalıdır."],
    };
}
export class RobizAdapter extends JsonLdAdapter {
  async getProduct(raw: string) {
    const page = await this.readPage(raw);
    return parseRobizProduct(page.html, page.url);
  }
}
