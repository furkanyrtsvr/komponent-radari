import { cookies } from "next/headers";
import {ensureFeedback,feedbackFor} from '@/lib/server/feedback';
import {FeedbackError} from '@/lib/feedback-service';
import { dataSource, storesForSource } from "@/lib/server/mode";
import { syncLive, searchLive } from "@/lib/server/live";
import { importCatalogBundle } from "@/lib/server/catalog-import";
import {importCatalogProduct} from "@/lib/server/catalog-import";
import {isFresh} from "@/lib/pricing";
import {applyCartShipping,type ShippingSetting} from "@/lib/cart-shipping";
import {linkQuotes} from "@/lib/link-quotes";
import {offersForProducts} from '@/lib/server/cart-offers';
import {visualMatches} from '@/lib/server/visual-match';
import {nameMatchScore} from '@/public/catalog/product-identity.js';
import {cartEvents} from "@/lib/server/cart-events";
import { previewCatalogProducts } from "@/lib/server/catalog-preview";
import { createLiveStarter } from "@/lib/server/carts";
import { z } from "zod";
import { user, isAdmin, requireAdmin, checkOrigin } from "@/lib/server/auth";
import { ensureSeed } from "@/lib/server/seed";
import {
  config,
  isSupabase,
  list,
  listIn,
  pages,
  one,
  insert,
  insertBatch,
  update,
  remove,
  rateLimit,
  HttpError,
  recent,
} from "@/lib/server/db";
import {
  access,
  cartView,
  userCarts,
  createCart,
  makeItem,
  cartOptimization,
  touchCart,
  joinShare,
} from "@/lib/server/carts";
import {
  id,
  now,
  normalize,
  type Product,
  type Offer,
  type Store,
  type CartItem,
} from "@/lib/domain";
import { parseBomRows } from "@/lib/bom";
import { refreshOffers, importUrl } from "@/lib/server/refresh";
import { approveOffer, reviewQueue, mergeCanonical } from "@/lib/server/admin";
export const dynamic = "force-dynamic";
const str = z.string().min(1).max(180),
  qty = z.number().int().min(1).max(100000);
const settings = z.object({
  maxStores: z.number().int().min(1).max(14).optional(),
  exactOnly: z.boolean().optional(),
  allowLastKnown:z.boolean().optional(),
  selectedStores: z.array(str).max(14).optional(),
  minimumSaving: z.number().int().min(0).max(100000).optional(),
});
type Context = { params: Promise<{ path: string[] }> };
async function handle(request: Request, context: Context) {
  try {
    checkOrigin(request);
    const { path } = await context.params;
    const route = path.join("/"),
      method = request.method;
    // Public runtime settings must remain available while the database starts.
    if (route === "config" && method === "GET")
      return Response.json({
        demo: (await dataSource()) === "demo",
        supabaseUrl: config("SUPABASE_URL"),
        supabaseAnonKey: config("SUPABASE_ANON_KEY"),
        googleConfigured: isSupabase() && Boolean(config("SUPABASE_ANON_KEY")),
      });
    await rateLimit(
      `edge:${request.headers.get("cf-connecting-ip") || "local"}`,
      600,
    );
    await ensureSeed();
    const u = await user(request);
    await rateLimit(`api:${u.id}`, 180);
    let body: Record<string, unknown> = {};
    if (method === "POST" || method === "PATCH" || method === "PUT") {
      const raw = await request.text();
      if (raw.length > 500000) throw new HttpError(413, "İstek çok büyük.");
      body = JSON.parse(raw || "{}");
    }
    const source = await dataSource();
    if(path[0]==='feedback'){
      await ensureFeedback();const service=feedbackFor(u);
      if(path.length===1&&method==='GET')return Response.json(await service.list(new URL(request.url).searchParams.get('scope')==='all'));
      if(path.length===1&&method==='POST'){
        await rateLimit('feedback-create:'+u.id,8);
        return Response.json(await service.create(body),{status:201});
      }
      if(path[1]){
        const reportId=z.string().uuid().parse(path[1]);
        if(path.length===2&&method==='GET')return Response.json(await service.detail(reportId));
        if(path.length===3&&path[2]==='messages'&&method==='POST'){
          await rateLimit('feedback-message:'+u.id,30);
          return Response.json(await service.reply(reportId,body),{status:201});
        }
        if(path.length===2&&method==='PATCH')return Response.json(await service.status(reportId,z.enum(['open','reviewing','resolved']).parse(body.status)));
      }
      throw new HttpError(404,'İşlem bulunamadı.');
    }
    if (route === "mode" && method === "POST") {
      const mode = z.enum(["live", "demo"]).parse(body.mode);
      if(mode==="demo" && config("ENABLE_TEST_DATA")!=="true")throw new HttpError(400,"Uygulama yalnızca gerçek mağaza verilerini kullanır.");
      (await cookies()).set("eub_data_mode", mode, {
        httpOnly: true,
        sameSite: "lax",
        secure: new URL(request.url).protocol === "https:",
        path: "/",
        maxAge: 30 * 86400,
      });
      return Response.json({ mode });
    }
    if (route === "search-live" && method === "POST") {
      await rateLimit("search:" + u.id, 4);
      return Response.json(
        await searchLive(z.string().min(2).max(80).parse(body.query)),
      );
    }
    if (route === "catalog/import" && method === "POST") {
      await rateLimit("catalog-import:" + u.id, 5);
      const urls = body.urls
        ? z.array(z.string().url().max(2000)).min(1).max(14).parse(body.urls)
        : [z.string().url().max(2000).parse(body.url)];
      return Response.json(await importCatalogBundle(
        urls,
        z.string().max(80).parse(body.category),
      ));
    }
    if (route === "catalog/preview" && method === "POST") {
      await rateLimit("catalog-preview:" + u.id, 60);
      const urls = z.array(z.string().url().max(2000)).min(1).max(12).parse(body.urls);
      return Response.json(await previewCatalogProducts(urls, body.force === true));
    }
    if (route === "bootstrap") {
      let carts = (await userCarts(u.id)).filter(cart=>cart.data_source===source);
      if (!carts.some((c) => c.data_source === source)) {
        if (source === "live") await createLiveStarter(u);
        else await createCart(u, "Demo proje sepetim", true);
        carts = (await userCarts(u.id)).filter(cart=>cart.data_source===source);
      }
      carts.sort(
        (a, b) =>
          Number(b.data_source === source) - Number(a.data_source === source),
      );
      const requestedCartId=new URL(request.url).searchParams.get("cartId");
      const focusedCart=carts.find(cart=>cart.id===requestedCartId && cart.data_source===source) || carts[0];
      const cart = await cartView(focusedCart.id, u.id);
      const [initialProducts, stores, favorites, alerts,stockAlerts] = await Promise.all([
        list<Product>("canonical_products"),
        storesForSource(source),
        list<{ canonical_product_id: string }>("favorites", { user_id: u.id }),
        list("price_alerts", { user_id: u.id }),
        list("stock_alerts", { user_id: u.id }),
      ]);
      const tracked=[...alerts,...stockAlerts] as {canonical_product_id:string}[];
      const cartProducts=await listIn<Product>("canonical_products","id",[...cart.items.map(item=>item.canonical_product_id),...tracked.map(alert=>alert.canonical_product_id)]);
      const products=[...new Map([...initialProducts,...cartProducts].map(product=>[product.id,product])).values()];
      const offers=await offersForProducts(products,source,cart.offerSelections);
      return Response.json({
        user: { id: u.id, name: u.display_name, admin: isAdmin(u),email:u.email,authenticated:Boolean(u.email) },
        demo: source === "demo",
        products,
        offers,
        stores:applyCartShipping(stores,cart.shippingSettings || []),
        carts,
        cart,
        favorites: favorites.map((f) => f.canonical_product_id),
        alerts,
        stockAlerts,
      });
    }
    if (route === "products" && method === "GET") {
      const q = normalize(new URL(request.url).searchParams.get("q") || "");
      return Response.json(
        (await list<Product>("canonical_products")).filter((p) =>
          normalize(p.name + p.mpn + p.manufacturer).includes(q),
        ),
      );
    }
    if (route === "carts" && method === "GET")
      return Response.json((await userCarts(u.id)).filter(cart=>cart.data_source===source));
    if (route === "carts" && method === "POST") {
      const v = z
        .object({
          name: str,
          demo: z.boolean().optional(),
          sourceIds: z.array(str).max(14).optional(),
        })
        .parse(body);
      if(v.demo && source!=="demo")throw new HttpError(400,"Örnek sepetler kaldırıldı. Boş bir alışveriş sepeti oluşturabilirsiniz.");
      let items: CartItem[] | undefined;
      if (v.sourceIds) {
        items = [];
        for (const c of v.sourceIds) {
          await access(c, u.id);
          items.push(...(await cartView(c, u.id)).items);
        }
      }
      return Response.json(
        await createCart(
          u,
          v.name,
          Boolean(v.demo) && source === "demo",
          items,
        ),
        { status: 201 },
      );
    }
    if (path[0] === "carts" && path[1]) {
      const cid = path[1];
      if(path[2]==='offers' && path[3] && method==='GET'){
        const view=await cartView(cid,u.id);
        const product=await one<Product>('canonical_products',{id:path[3]});
        if(!product)throw new HttpError(404,'Ürün bulunamadı.');
        return Response.json(await offersForProducts([product],source,view.offerSelections));
      }
      if(path[2]==='offer-selection' && method==='PUT'){
        await access(cid,u.id,'edit');
        const v=z.object({productId:str,offerId:str,excluded:z.boolean()}).parse(body);
        const [product,offer]=await Promise.all([one<Product>('canonical_products',{id:v.productId}),one<Offer>('store_offers',{id:v.offerId})]);
        if(!product || !offer || offer.source!==source || offer.canonical_product_id!==product.id && nameMatchScore(product,{name:offer.title})<0.65)throw new HttpError(400,'Bu teklif ürünle ilişkili değil.');
        const row={id:JSON.stringify([cid,v.productId,v.offerId]),cart_id:cid,canonical_product_id:v.productId,offer_id:v.offerId,excluded:Number(v.excluded),updated_at:now()};
        await insert('cart_offer_selections',row,true);
        await update('cart_offer_selections',{excluded:row.excluded,updated_at:row.updated_at},{cart_id:cid,canonical_product_id:v.productId,offer_id:v.offerId});
        await touchCart(cid);return Response.json(await cartView(cid,u.id));
      }
      if(path[2]==="events" && method==="GET")return cartEvents(request,cid,u.id);
      if(path[2]==="shipping" && (method==="PUT" || method==="DELETE")){
        await access(cid,u.id,"edit");
        const storeId=str.parse(body.storeId || new URL(request.url).searchParams.get("storeId"));
        if(!(await one("stores",{id:storeId})))throw new HttpError(404,"Mağaza bulunamadı.");
        if(method==="DELETE")await remove("cart_shipping_settings",{cart_id:cid,store_id:storeId});
        else{
          const v=z.object({shippingPrice:z.number().int().min(0).max(1000000),freeShippingThreshold:z.number().int().min(0).max(10000000).nullable()}).parse(body);
          const existing=await one<ShippingSetting>("cart_shipping_settings",{cart_id:cid,store_id:storeId});
          await insert("cart_shipping_settings",{id:existing?.id || id(),cart_id:cid,store_id:storeId,shipping_price:v.shippingPrice,free_shipping_threshold:v.freeShippingThreshold,updated_at:now()},true);
          await update("cart_shipping_settings",{shipping_price:v.shippingPrice,free_shipping_threshold:v.freeShippingThreshold,updated_at:now()},{cart_id:cid,store_id:storeId});
        }
        await touchCart(cid);return Response.json(await cartView(cid,u.id));
      }
      if(path[2]==="members" && path[3] && (method==="PATCH" || method==="DELETE")){
        const {cart:owned}=await access(cid,u.id,"owner");
        if(path[3]===owned.owner_id)throw new HttpError(400,"Sepet sahibinin yetkisi değiştirilemez.");
        const member=await one<{id:string}>("cart_members",{cart_id:cid,user_id:path[3]});
        if(!member)throw new HttpError(404,"Katılımcı bulunamadı.");
        if(method==="DELETE")await remove("cart_members",{id:member.id});
        else await update("cart_members",{role:z.enum(["viewer","contributor","editor"]).parse(body.role)},{id:member.id});
        await touchCart(cid);return Response.json(await cartView(cid,u.id));
      }
      if (path.length === 2 && method === "GET")
        return Response.json(await cartView(cid, u.id));
      if (path.length === 2 && method === "PATCH") {
        await access(cid, u.id, "edit");
        await update(
          "carts",
          { name: str.parse(body.name), updated_at: now() },
          { id: cid },
        );
        return Response.json(await cartView(cid, u.id));
      }
      if (path[2] === "items" && method === "POST") {
        await access(cid, u.id, "add");
        const v = z
          .object({
            productId: str,
            quantity: qty,
            notes: z.string().max(500).optional(),
            allowAlternative: z.boolean().optional(),
            manufacturer: z.string().max(100).optional(),
            maximumUnitPrice: z.number().int().min(0).nullable().optional(),
          })
          .parse(body);
        if (!(await one("canonical_products", { id: v.productId })))
          throw new HttpError(404, "Ürün bulunamadı.");
        const count = (await list("cart_items", { cart_id: cid })).length;
        if (count >= 60)
          throw new HttpError(
            400,
            "Bir sepette en fazla 60 ihtiyaç satırı kullanılabilir.",
          );
        await insert("cart_items", {
          ...makeItem(cid, v.productId, v.quantity, u.id),
          notes: v.notes || "",
          allow_alternative: Number(v.allowAlternative || false),
          preferred_manufacturer: v.manufacturer || "",
          maximum_unit_price: v.maximumUnitPrice ?? null,
        });
        await touchCart(cid);
        return Response.json(await cartView(cid, u.id));
      }
      if (
        path[2] === "items" &&
        path[3] &&
        (method === "PATCH" || method === "DELETE")
      ) {
        await access(cid, u.id, "edit");
        if (method === "DELETE")
          await remove("cart_items", { id: path[3], cart_id: cid });
        else
          await update(
            "cart_items",
            { quantity: qty.parse(body.quantity) },
            { id: path[3], cart_id: cid },
          );
        await touchCart(cid);
        return Response.json(await cartView(cid, u.id));
      }
      if (path[2] === "optimize" && method === "POST") {
        await rateLimit(`opt:${u.id}`, 20);
        return Response.json(
          await cartOptimization(cid, u.id, settings.parse(body)),
        );
      }
      if (path[2] === "snapshot" && method === "POST") {
        await access(cid, u.id, "edit");
        const requested=settings.extend({planMode:z.enum(["upTo","exact"]).default("upTo"),scenarioCount:z.number().int().min(1).max(14).optional()}).parse(body);
        const result = await cartOptimization(cid, u.id, requested);
        const best = requested.planMode === "exact"
          ? result.exactScenarios?.find(s=>s.storeCount===(requested.scenarioCount ?? requested.maxStores))
          : requested.scenarioCount ? result.scenarios.find(s=>s.maxStores===requested.scenarioCount) : result.scenarios.at(-1);
        if (!best)
          throw new HttpError(
            400,
            "Eksik teklif nedeniyle sepet kaydedilemedi.",
          );
        const view = await cartView(cid, u.id);
        await insertBatch([
          {
            table: "cart_snapshots",
            row: {
              id: id(),
              cart_id: cid,
              created_at: now(),
              total: best.total,
              payload: JSON.stringify({ items: view.items, result, selectedScenario:best, planMode:requested.planMode }),
            },
          },
          {
            table: "saved_optimizations",
            row: {
              id: id(),
              cart_id: cid,
              created_at: now(),
              payload: JSON.stringify(result),
            },
          },
        ]);
        return Response.json(await cartView(cid, u.id));
      }
      if (path[2] === "share" && method === "POST") {
        await access(cid, u.id, "owner");
        const role = z
          .enum(["viewer", "contributor", "editor"])
          .parse(body.role);
        const token = id() + id();
        await insert("cart_shares", {
          id: token,
          cart_id: cid,
          role,
          created_at: now(),
          expires_at: new Date(Date.now() + 30 * 86400000).toISOString(),
        });
        return Response.json({ url: `/cart/share/${token}`, role });
      }
      if (path[2] === "shares" && method === "DELETE") {
        await access(cid, u.id, "owner");
        await remove("cart_shares", { cart_id: cid });
        return Response.json({ ok: true });
      }
      if (path[2] === "import" && method === "POST") {
        await access(cid, u.id, "add");
        const rows = z.array(z.record(z.unknown())).max(200).parse(body.rows);
        const parsed = parseBomRows(
          rows,
          await list<Product>("canonical_products"),
        );
        if (parsed.unmatched.length)
          return Response.json({ ...parsed, imported: 0 }, { status: 422 });
        if (
          parsed.items.length +
            (await list("cart_items", { cart_id: cid })).length >
          60
        )
          throw new HttpError(
            400,
            "Bir sepette en fazla 60 satır kullanılabilir.",
          );
        await insertBatch(
          parsed.items.map((i) => ({
            table: "cart_items",
            row: makeItem(cid, i.productId, i.quantity, u.id),
          })),
        );
        await touchCart(cid);
        return Response.json({
          cart: await cartView(cid, u.id),
          imported: parsed.items.length,
        });
      }
    }
    if (path[0] === "share" && path[1] && method === "POST")
      return Response.json(await joinShare(path[1], u));
    if (route === "manual" && method === "POST") {
      const v = z
        .object({
          name: str,
          manufacturer: z.string().max(100).default(""),
          mpn: z.string().max(100).default(""),
        })
        .parse(body);
      await rateLimit(`manual:${u.id}`, 10);
      const p: Product = {
        id: id(),
        name: v.name,
        manufacturer: v.manufacturer,
        mpn: v.mpn,
        model: v.mpn,
        category: "Manuel ihtiyaç",
        description:
          "Kullanıcı tarafından eklenen ihtiyaç. Henüz doğrulanmış teklif yok.",
        image: null,
        specifications: "{}",
        unit_type: "adet",
        package_quantity: 1,
        created_at: now(),
      };
      await insert("canonical_products", p);
      return Response.json(p);
    }
    if(route==='visual-match' && method==='POST'){
      await rateLimit(`visual:${u.id}`,20);
      const productId=str.parse(body.productId),offerIds=z.array(str).max(24).parse(body.offerIds);
      const product=await one<Product>('canonical_products',{id:productId});
      if(!product)throw new HttpError(404,'Ürün bulunamadı.');
      const offers=await offersForProducts([product],'live');
      const reference=offers.find(offer=>offer.id===body.referenceOfferId && !offer.variant_conflict);
      return Response.json(await visualMatches(reference?{...product,image:reference.image_url}:product,offers.filter(offer=>offerIds.includes(offer.id)&&!offer.variant_conflict),await storesForSource('live')));
    }
    if (route === "url" && method === "POST") {
      await rateLimit(`scrape:${u.id}`, 6);
      const cid=str.parse(body.cartId),quantity=qty.parse(body.quantity ?? 1);
      await access(cid,u.id,"add");
      if((await list("cart_items",{cart_id:cid})).length>=60)throw new HttpError(400,"Sepette en fazla 60 ihtiyaç satırı kullanılabilir.");
      const imported=await importCatalogProduct(z.string().url().max(2000).parse(body.url),"Diğer");
      await insert("cart_items",makeItem(cid,imported.product.id,quantity,u.id));
      await touchCart(cid);
      let refreshSummary="Diğer mağazaların kontrolü tamamlanamadı; mevcut doğrulanmış teklifler gösteriliyor. Yenile ile tekrar deneyebilirsin.";
      try{const refreshed=await syncLive([imported.product.id],false);refreshSummary=refreshed.message;}catch(error){console.warn("URL product refresh failed",error instanceof Error?error.name:"UnknownError");}
      const cart=await cartView(cid,u.id);
      const [validOffers,stores]=await Promise.all([offersForProducts([imported.product],'live',cart.offerSelections),storesForSource("live")]);
      const quotes=linkQuotes(validOffers,applyCartShipping(stores,cart.shippingSettings || []),quantity,false,true);
      const excludedQuotes=linkQuotes(validOffers.filter(offer=>offer.excluded),applyCartShipping(stores,cart.shippingSettings || []),quantity,true,true);
      const availability=validOffers.filter(offer=>!offer.excluded && !offer.variant_conflict && isFresh(offer)).map(offer=>({store:stores.find(store=>store.id===offer.store_id)?.name || offer.store_id,url:offer.product_url,status:offer.stock_status,price:offer.price_gross}));
      const compatible=quotes.filter(q=>!q.variantConflict),outOfStock=availability.some(offer=>offer.status==='out_of_stock');
      return Response.json({product:{...imported.product,...(imported.offer?{name:imported.offer.title,image:imported.offer.image_url}: {})},referenceOfferId:imported.offer?.id,cart,quotes,excludedQuotes,availability,quantity,verified:imported.verified,sourceStore:imported.store,message:(compatible.length?`${compatible.length} uygun ürün fiyatı bulundu${compatible.some(q=>q.lastKnown)?'; son alınan fiyatların kontrol tarihleri gösterilir':''}. Ürün sepete eklendi.`:outOfStock?"Ürün sepete eklendi. Bulunan teklifler stokta değil.":"Ürün sepete eklendi; henüz doğrulanmış, stokta uygun teklif bulunamadı.")+(imported.sourceWarning?` ${imported.sourceWarning}`:''),refreshSummary});
    }
    if (route === "refresh" && method === "POST") {
      await rateLimit(`refresh:${u.id}`, 3);
      return Response.json(
        await refreshOffers(
          z.array(str).max(60).parse(body.productIds),
          z.boolean().optional().parse(body.force) ?? true,
        ),
      );
    }
    if (route === "favorites" && method === "POST") {
      const productId = str.parse(body.productId);
      const f = await one<{ id: string }>("favorites", {
        user_id: u.id,
        canonical_product_id: productId,
      });
      if (f) await remove("favorites", { id: f.id });
      else
        await insert("favorites", {
          id: id(),
          user_id: u.id,
          canonical_product_id: productId,
        });
      return Response.json({ active: !f });
    }
    if (route === "alerts" && method === "POST") {
      const v = z
        .object({
          productId: str,
          targetPrice: z.number().int().min(1).optional(),
          kind: z.enum(["price", "stock"]),
        })
        .parse(body);
      if(!(await one("canonical_products",{id:v.productId})))throw new HttpError(404,"Ürün bulunamadı.");
      const table=v.kind==="price"?"price_alerts":"stock_alerts";
      const old=await one<{id:string}>(table,{user_id:u.id,canonical_product_id:v.productId});
      if(old){await update(table,{enabled:1,...(v.kind==="price"?{target_price:v.targetPrice || 1}:{})},{id:old.id});}
      else await insert(table, {
        id: id(),
        user_id: u.id,
        canonical_product_id: v.productId,
        ...(v.kind === "price" ? { target_price: v.targetPrice || 1 } : {}),
        enabled: 1,
        created_at: now(),
      });
      return Response.json({ ok: true, delivery: "in_app" });
    }
    if(path[0]==="alerts" && path[1] && path[2] && (method==="DELETE" || method==="PATCH")){
      const kind=z.enum(["price","stock"]).parse(path[1]),table=kind==="price"?"price_alerts":"stock_alerts";
      if(!(await one(table,{id:path[2],user_id:u.id})))throw new HttpError(404,"Takip bulunamadı.");
      if(method==="DELETE")await remove(table,{id:path[2],user_id:u.id});
      else await update(table,{enabled:Number(z.boolean().parse(body.enabled))},{id:path[2],user_id:u.id});
      return Response.json({ok:true});
    }
    if (path[0] === "history" && path[1]) {
      const offers = await list<Offer>("store_offers", {
        canonical_product_id: path[1],
      });
      const histories = await Promise.all(
        offers
          .filter((o) => o.source === source)
          .map((o) => list("price_history", { offer_id: o.id })),
      );
      return Response.json(histories.flat());
    }
    if (route === "health" && method === "GET"){
      const storeId=new URL(request.url).searchParams.get("storeId");
      return Response.json({
        health: await recent("store_health","checked_at",storeId?{store_id:str.parse(storeId)}:{}),
        jobs: await recent("scrape_jobs","created_at",storeId?{store_id:str.parse(storeId)}:{}),
      });
    }
    if (route === "admin/reviews" && method === "GET") {
      requireAdmin(u);
      return Response.json(await reviewQueue());
    }
    if (route === "admin/approve" && method === "POST") {
      requireAdmin(u);
      return Response.json(await approveOffer(body));
    }
    if (route === "admin/merge-products" && method === "POST") {
      requireAdmin(u);
      return Response.json(
        await mergeCanonical(
          str.parse(body.sourceId),
          str.parse(body.targetId),
        ),
      );
    }
    if (route === "admin/store" && method === "POST") {
      requireAdmin(u);
      const v = z
        .object({
          name: str,
          domain: z.string().regex(/^(?:[a-z0-9-]+\.)+[a-z]{2,}$/),
          shipping_base_price: z.number().int().min(0),
          free_shipping_threshold: z.number().int().min(0).nullable(),
        })
        .parse(body);
      await insert("stores", {
        id: id(),
        ...v,
        color: "#417d69",
        enabled: 1,
        adapter_type: "jsonld",
        supports_search: 0,
        supports_live_price: 0,
        supports_stock: 0,
        price_includes_vat: 1,
        last_successful_sync: null,
        status: "integration_pending",
      });
      return Response.json({ ok: true });
    }
    if (route === "admin/store" && method === "PATCH") {
      requireAdmin(u);
      const v = z
        .object({
          id: str,
          enabled: z.number().int().min(0).max(1),
          shipping_base_price: z.number().int().min(0).max(1000000),
          free_shipping_threshold: z
            .number()
            .int()
            .min(0)
            .max(10000000)
            .nullable(),
        })
        .parse(body);
      const { id: storeId, ...values } = v;
      await update("stores", values, { id: storeId });
      await insert("store_shipping_rules", {
        id: id(),
        store_id: storeId,
        rules: JSON.stringify(values),
        estimated: 1,
        source_url: null,
        last_updated: now(),
      });
      return Response.json({ ok: true });
    }
    if (route === "admin/match" && method === "PATCH") {
      requireAdmin(u);
      const v = z
        .object({
          offerId: str,
          productId: str,
          confidence: z.number().int().min(0).max(100),
          type: z.enum(["exact", "verified", "alternative", "candidate"]),
        })
        .parse(body);
      await update(
        "store_offers",
        {
          canonical_product_id: v.productId,
          match_confidence: v.confidence,
          match_type: v.type,
        },
        { id: v.offerId },
      );
      return Response.json({ ok: true });
    }
    throw new HttpError(404, "İşlem bulunamadı.");
  } catch (error) {
    if (error instanceof z.ZodError)
      return Response.json(
        {
          error: error.issues
            .map((e) => `${e.path.join(".")}: ${e.message}`)
            .join("; "),
        },
        { status: 400 },
      );
    if (error instanceof HttpError || error instanceof FeedbackError)
      return Response.json({ error: error.message }, { status: error.status });
    if (error instanceof SyntaxError)
      return Response.json({ error: "Geçersiz JSON." }, { status: 400 });
    console.error("API error", error);
    return Response.json(
      { error: "İşlem tamamlanamadı. Verileriniz korunuyor; yeniden deneyin." },
      { status: 500 },
    );
  }
}
export const GET = handle;
export const POST = handle;
export const PATCH = handle;
export const PUT = handle;
export const DELETE = handle;
