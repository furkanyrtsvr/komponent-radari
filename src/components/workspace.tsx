"use client";
import { useState, useEffect, useRef, useMemo, type ReactNode } from "react";
import {
  Cpu,
  Search,
  ShoppingBag,
  FolderOpen,
  Store as StoreIcon,
  Heart,
  Bell,
  Sun,
  Moon,
  Plus,
  ArrowUpRight,
  ArrowRight,
  ArrowDownToLine,
  Upload,
  Link2,
  Share2,
  Save,
  RefreshCw,
  Trash2,
  Minus,
  Check,
  ShieldCheck,
  Truck,
  SlidersHorizontal,
  Layers,
  ChevronRight,
  Copy,
  GitMerge,
  Users,
  Info,
  ExternalLink,
  Zap,
  Settings2,
  X,
  Activity,
  CheckCircle2,
  LoaderCircle,
  LogIn,
  Package,
  Clock3,
  BarChart3,
  ChevronsUpDown,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import {
  Table,
  TableHeader,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
} from "@/components/ui/table";
import {
  SidebarProvider,
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { Toaster, toast } from "sonner";
import { OptimizationDetails } from "@/components/optimization-details";
import { MerchantCatalog } from "@/components/merchant-catalog";
import { AdminTools } from "@/components/admin-tools";
import {LinkComparison,ShippingLogsPanel,WatchPanel,type LinkResult,type Watch} from "@/components/shopping-panels";
import { api, configureAuth, authClient } from "@/lib/client";
import {
  money,
  normalize,
  type Product,
  type Offer,
  type Store,
  type Cart,
  type CartView,
  type Optimization,
  type Scenario,
} from "@/lib/domain";
import { allocateCosts } from "@/lib/optimizer";
import { quoteOffer, isFresh,hasObservedPrice } from "@/lib/pricing";
import {distinctScenarios} from '@/lib/scenario-display';
import {offerAvailability} from '@/lib/offer-availability';
import {PricePhase} from './price-phase';
import { csvCell } from "@/lib/bom";
type Boot = {
  user: { id: string; name: string; admin: boolean;email:string;authenticated:boolean };
  demo: boolean;
  products: Product[];
  offers: Offer[];
  stores: Store[];
  carts: Cart[];
  cart: CartView;
  favorites: string[];
  alerts: Watch[];
  stockAlerts:Watch[];
};
type View =
  "cart" | "catalog" | "saved" | "stores" | "favorites" | "alerts" | "admin";
const labels: Record<View, string> = {
  cart: "Akıllı sepet",
  catalog: "Ürün keşfet",
  saved: "Sepetlerim",
  stores: "Mağazalar",
  favorites: "Favorilerim",
  alerts: "Fiyat / stok takibi",
  admin: "Yönetim",
};
const navs = [
  ["catalog", Search, "Ürün keşfet"],
  ["cart", ShoppingBag, "Akıllı sepet"],
  ["saved", FolderOpen, "Sepetlerim"],
  ["favorites", Heart, "Favorilerim"],
  ["alerts", Bell, "Fiyat / stok takibi"],
  ["stores", StoreIcon, "Mağazalar"],
] as const;
const timeAgo = (s: string) => {
  const mins = Math.max(
    0,
    Math.floor((Date.now() - new Date(s).getTime()) / 60000),
  );
  return mins < 1
    ? "az önce"
    : mins < 60
      ? `${mins} dk önce`
      : mins < 1440
        ? `${Math.floor(mins / 60)} sa önce`
        : `${Math.floor(mins / 1440)} gün önce`;
};
function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
    </label>
  );
}
function Choice({
  checked,
  onChange,
  children,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  children: ReactNode;
}) {
  return (
    <label className="choice">
      <Checkbox
        checked={checked}
        onCheckedChange={(v) => onChange(v === true)}
      />
      <span>{children}</span>
    </label>
  );
}
function SelectBox({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {options.map((o) => (
          <SelectItem key={o.value} value={o.value}>
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
function ProductMark({ category }: { category: string }) {
  const Icon = category.includes("Sensör")
    ? Activity
    : category.includes("Pasif")
      ? Layers
      : category.includes("Güç")
        ? Zap
        : Cpu;
  return (
    <span
      className={`product-mark ${category.includes("Sensör") ? "blue" : category.includes("Pasif") ? "amber" : ""}`}
    >
      <Icon size={23} strokeWidth={1.5} />
    </span>
  );
}
export default function Workspace({
  shareToken,
  productId,
}: {
  shareToken?: string;
  productId?: string;
}) {
  const [data, setData] = useState<Boot | null>(null),
    [error, setError] = useState(""),
    [view, setView] = useState<View>("cart"),
    [cart, setCart] = useState<CartView | null>(null),
    [query, setQuery] = useState(""),
    [category, setCategory] = useState("all"),
    [onlyStock, setOnlyStock] = useState(true),
    [exact, setExact] = useState(false),
    [syncMessage, setSyncMessage] = useState(""),
    [maxStores, setMaxStores] = useState("0"),
    [storeFilter, setStoreFilter] = useState<string[]>([]),
    [minSaving, setMinSaving] = useState(0),
    [busy, setBusy] = useState(""),
    [refreshing,setRefreshing]=useState(false),
    [refreshSeconds,setRefreshSeconds]=useState(0),
    [result, setResult] = useState<Optimization | null>(null),
    [selected, setSelected] = useState(2),
    [planMode, setPlanMode] = useState<"upTo" | "exact">("upTo"),
    [modal, setModal] = useState<string | null>(null),
    [detail, setDetail] = useState<Product | null>(null),
    [dark, setDark] = useState(false),
    [config, setConfig] = useState<{ googleConfigured: boolean } | null>(null),
    [selectedCarts, setSelectedCarts] = useState<string[]>([]),
    [shareLink, setShareLink] = useState(""),
    [shareRole, setShareRole] = useState("contributor"),
    [costMode, setCostMode] = useState<"equal" | "proportional">(
      "proportional",
    ),
    [history, setHistory] = useState<
      { checked_at: string; price_gross: number }[]
    >([]),
    [historyDays, setHistoryDays] = useState("30"),
    [urlResult, setUrlResult] = useState<LinkResult|null>(null),
    [alertKind,setAlertKind]=useState("price"),
    [sharedStatus,setSharedStatus]=useState("Bağlanıyor");
  const [form, setForm] = useState<Record<string, string>>({
    name: "",
    url: "",
    mpn: "",
    manufacturer: "",
    quantity: "1",
    notes: "",
    maxPrice: "",
    email: "",
    alertPrice: "100",
  });
  const [manualAlt, setManualAlt] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const latestCart = useRef(cart);
  latestCart.current = cart;
  const latestData=useRef(data);latestData.current=data;
  const operation = useRef(false);
  const priceRefresh=useRef(false);
  const queuedRefresh=useRef(new Set<string>());
  const queuedForce=useRef(false);
  const refreshAbort=useRef<AbortController|null>(null);
  const activeDemo=useRef(data?.demo);
  activeDemo.current=data?.demo;
  const runVersion = useRef(0);
  const loadVersion=useRef(0);
  const patch = (key: string, value: string) =>
    setForm((f) => ({ ...f, [key]: value }));
  async function work(label: string, fn: () => Promise<void>) {
    if (operation.current) return;
    operation.current = true;
    setBusy(label);
    try {
      await fn();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "İşlem tamamlanamadı.");
    } finally {
      operation.current = false;
      setBusy("");
    }
  }
  async function load(initial = false, focusedCartId?:string) {
    const version=++loadVersion.current;
    try {
      const c = await configureAuth();
      setConfig(c);
      const cid=focusedCartId || (!initial ? latestCart.current?.id : undefined);
      const d = await api<Boot>(`bootstrap${cid ? `?cartId=${encodeURIComponent(cid)}` : ""}`);
      if(version!==loadVersion.current)return;
      setData(d);
      setError("");
      if (initial) {
        setExact(d.demo);
        setStoreFilter(d.stores.filter((s) => s.enabled).map((s) => s.id));
        const v = shareToken
          ? await api<CartView>(`share/${shareToken}`, "POST", {})
          : d.cart;
        setCart(v);
        if (shareToken) return await load(false,v.id);
        if (productId) {
          setDetail(d.products.find((p) => p.id === productId) || null);
          setView("catalog");
        }
      }
      else if(!latestCart.current || d.cart.id===latestCart.current.id)setCart(d.cart);
      return d;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Veriler alınamadı.");
    }
  }
  async function refreshPrices(productIds:string[],force:boolean,notify=false){
    if(!productIds.length)return;
    if(priceRefresh.current){productIds.forEach(id=>queuedRefresh.current.add(id));queuedForce.current ||= force;return;}
    priceRefresh.current=true;
    const controller=new AbortController();
    refreshAbort.current=controller;
    const cartId=latestCart.current?.id;
    setRefreshing(true);
    setRefreshSeconds(0);
    setSyncMessage("Canlı fiyatlar arka planda kontrol ediliyor; uygulamayı kullanabilirsin.");
    const timer=setInterval(()=>setRefreshSeconds(seconds=>seconds+1),1000);
    const finish=()=>{
      clearInterval(timer);
      if(refreshAbort.current===controller){
        priceRefresh.current=false;
        refreshAbort.current=null;
        setRefreshing(false);
      }
    };
    try{
      const response=await api<{message:string}>("refresh","POST",{productIds,force},controller.signal);
      if(controller.signal.aborted || activeDemo.current)return;
      setSyncMessage(response.message);
      finish();
      if(!cartId || latestCart.current?.id===cartId){
        await load();
        if(!operation.current)changed();
      }
      if(notify)toast.info(response.message);
    }catch(error){
      if(controller.signal.aborted)return;
      const message=error instanceof Error && /TimeoutError|AbortError/.test(error.name)
        ? "Fiyat kontrolü süre sınırına ulaştı. Son doğrulanmış teklifler korunuyor; yeniden deneyebilirsin."
        : error instanceof Error ? error.message : "Mağazalara şu anda ulaşılamadı; yeniden deneyebilirsin.";
      setSyncMessage(message);
      if(notify)toast.warning(message);
    }finally{
      finish();
      if(queuedRefresh.current.size&&!controller.signal.aborted){
        const ids=[...queuedRefresh.current].slice(0,60),nextForce=queuedForce.current;
        queuedRefresh.current.clear();queuedForce.current=false;
        setTimeout(()=>void refreshPrices(ids,nextForce),1000);
      }
    }
  }
  useEffect(() => {
    void load(true).then((d) => {
      if (d && !d.demo){
        const ids=[...new Set([...d.cart.items.map(i=>i.canonical_product_id),...d.alerts.filter(a=>a.enabled).map(a=>a.canonical_product_id),...d.stockAlerts.filter(a=>a.enabled).map(a=>a.canonical_product_id)])];
        if(ids.length)void refreshPrices(ids.slice(0,60),false);
      }
    });
    const theme = localStorage.getItem("eub-theme");
    if (theme === "dark") {
      setDark(true);
      document.documentElement.classList.add("dark");
    }
    return ()=>refreshAbort.current?.abort();
  }, []);
  useEffect(() => {
    if (!data || data.demo) return;
    const timer = setInterval(
      () => {
        if (document.hidden || operation.current || priceRefresh.current) return;
        const ids=[...new Set([...(latestCart.current?.items.map(i=>i.canonical_product_id)||[]),...(latestData.current?.alerts || []).filter(a=>a.enabled).map(a=>a.canonical_product_id),...(latestData.current?.stockAlerts || []).filter(a=>a.enabled).map(a=>a.canonical_product_id)])];
        if(ids.length)void refreshPrices(ids.slice(0,60),false);
      },
      15 * 60 * 1000,
    );
    return () => clearInterval(timer);
  }, [data?.demo]);
  useEffect(() => {
    if (!cart) return;
    const cid = cart.id;
    let polling=false;
    const poll=async()=>{
      if (operation.current || document.hidden) return;
      if(polling)return;
      polling=true;
      try {
        const next = await api<CartView>(`carts/${cid}`);
        if (
          latestCart.current?.id === cid &&
          next.updated_at !== latestCart.current.updated_at
        ) {
          setCart(next);
          setResult(null);
          await load(false,cid);
          toast.info(
            "Ortak sepet güncellendi. Yeniden optimize edebilirsiniz.",
          );
        }
      } catch {
        /* Keep the visible cart intact when the connection briefly fails. */
      }finally{polling=false;}
    };
    const timer = setInterval(()=>void poll(),5000);
    const events=!authClient()?new EventSource(`/api/carts/${cid}/events`):null;
    events?.addEventListener("connected",()=>setSharedStatus("Canlı bağlantı açık"));
    events?.addEventListener("revision",()=>void poll());
    events?.addEventListener("access-error",()=>{events.close();setSharedStatus("Yetki değişti");void load(true);});
    if(events)events.onerror=()=>setSharedStatus("Bağlantı yenileniyor · otomatik kontrol sürüyor");
    const client = authClient();
    const channel = client
      ?.channel(`cart:${cid}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "cart_items",
          filter: `cart_id=eq.${cid}`,
        },
        () => {
          if (!operation.current)
            void api<CartView>(`carts/${cid}`).then((next) => {
              setCart(next);
              setResult(null);
            });
        },
      )
      .subscribe();
    return () => {
      clearInterval(timer);
      events?.close();
      if (channel) void client?.removeChannel(channel);
    };
  }, [cart?.id]);
  useEffect(() => {
    if (detail)
      void api<{ checked_at: string; price_gross: number }[]>(
        `history/${detail.id}`,
      )
        .then(setHistory)
        .catch(() => setHistory([]));
  }, [detail?.id]);
  useEffect(()=>{
    if(detail&&!activeDemo.current)void refreshPrices([detail.id],false);
  },[detail?.id]);
  const productMap = useMemo(
    () => new Map(data?.products.map((p) => [p.id, p]) || []),
    [data?.products],
  );
  const storeMap = useMemo(
    () => new Map(data?.stores.map((s) => [s.id, s]) || []),
    [data?.stores],
  );
  const settings = () => ({
    ...(maxStores !== "0" ? { maxStores: Number(maxStores) } : {}),
    exactOnly: exact,
    selectedStores: storeFilter,
    minimumSaving: Math.round(minSaving * 100),
  });
  async function optimizeCart() {
    if (!cart) return;
    const version = ++runVersion.current;
    await work("optimize", async () => {
      const r = await api<Optimization>(
        `carts/${cart.id}/optimize`,
        "POST",
        settings(),
      );
      if (version !== runVersion.current) return;
      setResult(r);
      setPlanMode("upTo");
      setSelected(r.recommendedMax || r.scenarios.at(-1)?.maxStores || 1);
      await load();
      if (r.missing.length)
        toast.error(
          "Bazı ürünler için uygun teklif yok. Eksik ürünleri kontrol edin.",
        );
      else if (!r.scenarios.length)
        toast.error("Bu mağaza sınırı ve stoklarla çözüm bulunamadı.");
      else toast.success("Kargo dahil kombinasyonlar hesaplandı.");
    });
  }
  function changed() {
    ++runVersion.current;
    setResult(null);
  }
  async function updateQty(itemId: string, quantity: number) {
    if (!cart || quantity < 1) return;
    await work("item", async () => {
      setCart(
        await api<CartView>(`carts/${cart.id}/items/${itemId}`, "PATCH", {
          quantity,
        }),
      );
      changed();
    });
  }
  async function addProduct(p: Product, quantity = 1) {
    if (!cart) return;
    await work("add", async () => {
      setCart(
        await api<CartView>(`carts/${cart.id}/items`, "POST", {
          productId: p.id,
          quantity,
        }),
      );
      changed();
      toast.success(`${p.name} sepete eklendi.`);
    });
    if(!data?.demo)void refreshPrices([...new Set([...(latestCart.current?.items.map(item=>item.canonical_product_id)||[]),p.id])],false);
  }
  async function excludeOffer(productId:string,offerId:string,excluded:boolean){
    if(!cart)return;
    await work('offer-selection',async()=>{
      const updated=await api<CartView>(`carts/${cart.id}/offer-selection`,'PUT',{productId,offerId,excluded});
      setCart(updated);changed();await load(false,cart.id);
      setUrlResult(current=>{
        if(!current || current.product.id!==productId)return current;
        const all=[...current.quotes,...(current.excludedQuotes || [])].map(quote=>quote.originalOfferId===offerId?{...quote,excluded}:quote);
        return {...current,cart:updated,quotes:all.filter(quote=>!quote.excluded),excludedQuotes:all.filter(quote=>quote.excluded)};
      });
      toast.success(excluded?'Teklif bu sepetin karşılaştırmasından çıkarıldı.':'Teklif karşılaştırmaya geri eklendi.');
    });
  }
  async function addIndexedProduct(urls: string[], indexedCategory: string) {
    if (!cart) return;
    await work("catalog-import", async () => {
      const found = await api<{ product: Product; verified: boolean; stores: string[]; verifiedStores: string[]; errors: string[] }>("catalog/import", "POST", { urls, category: indexedCategory });
      const refreshed = await load(false,cart.id);
      if (!refreshed) throw new Error("Ürün kaydedildi ancak katalog yenilenemedi.");
      const current = await api<CartView>(`carts/${cart.id}`);
      if (current.items.some((item) => item.canonical_product_id === found.product.id))
        setCart(current);
      else
        setCart(await api<CartView>(`carts/${cart.id}/items`, "POST", { productId: found.product.id, quantity: 1 }));
      await load(false,cart.id);
      changed();
      setView("cart");
      toast.success(found.verified
        ? `${found.product.name}: ${found.verifiedStores.join(", ")} fiyatı doğrulandı; ${found.stores.length} mağaza bağlantısı eşleştirildi.`
        : `${found.product.name}: ${found.stores.length} mağaza bağlantısı eşleştirildi; doğrulanmış fiyat henüz yok.`);
      if (found.errors.length) toast.warning(`${found.errors.length} mağaza eşleştirilemedi: ${found.errors.join(" · ")}`);
    });
    if(!data?.demo)void refreshPrices(latestCart.current?.items.map(item=>item.canonical_product_id)||[],false);
  }
  async function openCart(id: string) {
    await work("cart", async () => {
      setCart(await api<CartView>(`carts/${id}`));
      await load(false,id);
      setView("cart");
      changed();
    });
  }
  async function refresh() {
    const productIds = view === "cart"
      ? cart?.items.map(i=>i.canonical_product_id) || []
      : detail ? [detail.id] : cart?.items.map(i=>i.canonical_product_id) || [];
    if (!productIds.length) {
      toast.info("Fiyatını yenilemek için bir ürün seç veya sepete ekle.");
      return;
    }
    await refreshPrices(productIds,true,true);
  }
  const displayedScenarios=distinctScenarios((planMode==='exact'?result?.exactScenarios:result?.scenarios)||[]);
  const requestedScenario=(planMode==='exact'?result?.exactScenarios:result?.scenarios)?.find(s=>s.maxStores===selected);
  const scenario=displayedScenarios.find(s=>s.maxStores===selected)||displayedScenarios.find(s=>s.total===requestedScenario?.total);
  const editable = cart && ["owner", "editor"].includes(cart.role);
  const canAdd = cart && cart.role !== "viewer";
  const activeOffers = (pid: string) =>
    data?.offers.filter(
      (o) =>
        o.canonical_product_id === pid &&
        !o.excluded &&
        !o.variant_conflict &&
        hasObservedPrice(o) &&
        (!onlyStock || o.stock_status === "in_stock") &&
        (!exact || o.match_confidence === 100) &&
        storeFilter.includes(o.store_id),
    ) || [];
  const priceFor = (pid: string, q = 1) => {
    return availabilityFor(pid,q).price;
  };
  const availabilityFor=(pid:string,q=1)=>offerAvailability(data?.offers.filter(o=>o.canonical_product_id===pid)||[],q,{stores:storeFilter,exact,refreshing,allowLastKnown:true});
  const cheapestStores=new Set(cart?.items.map(i=>availabilityFor(i.canonical_product_id,i.quantity).offer?.store_id).filter(Boolean)).size;
  const datedPrices=cart?.items.filter(i=>{const o=availabilityFor(i.canonical_product_id,i.quantity).offer;return o&&!isFresh(o);}).length||0;
  const estimate =
    cart?.items.reduce(
      (n, i) => n + (priceFor(i.canonical_product_id, i.quantity) || 0),
      0,
    ) || 0;
  const filteredProducts =
    data?.products.filter(
      (p) =>
        (view !== "favorites" || data.favorites.includes(p.id)) &&
        (category === "all" || category === p.category) &&
        (!query ||
          normalize(p.name + p.mpn + p.manufacturer).includes(
            normalize(query),
          )) &&
        (!onlyStock ||
          data.offers.some((o) => o.canonical_product_id===p.id && !o.excluded && storeFilter.includes(o.store_id) && (!exact||o.match_confidence===100) && o.stock_status === "in_stock")),
    ) || [];
  const countStores = new Set(
    cart?.items.flatMap((i) =>
      activeOffers(i.canonical_product_id).map((o) => o.store_id),
    ),
  ).size;
  function exportCsv() {
    if (!cart || !data) return;
    const rows: unknown[][] = [
      [
        "Store",
        "Product",
        "Quantity",
        "Packages",
        "PurchasedQuantity",
        "TotalTRY",
        "URL",
      ],
    ];
    if (scenario)
      for (const g of scenario.groups)
        for (const l of g.lines) {
          const o = data.offers.find((o) => o.id === l.offerId);
          rows.push([
            storeMap.get(g.storeId)?.name,
            productMap.get(l.productId)?.name,
            l.quantity,
            l.packages,
            l.purchasedQuantity,
            (l.total / 100).toFixed(2),
            o?.source === "live" ? o.product_url : "DEMO",
          ]);
        }
    else
      for (const i of cart.items)
        rows.push([
          "",
          productMap.get(i.canonical_product_id)?.name,
          i.quantity,
          "",
          "",
          ((priceFor(i.canonical_product_id, i.quantity) || 0) / 100).toFixed(
            2,
          ),
          "",
        ]);
    const blob = new Blob(
      ["\uFEFF" + rows.map((row) => row.map(csvCell).join(",")).join("\r\n")],
      { type: "text/csv;charset=utf-8" },
    );
    const url = URL.createObjectURL(blob),
      a = document.createElement("a");
    a.href = url;
    a.download = `${cart.name}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }
  async function importBom(file: File) {
    if (file.size > 1_000_000) {
      toast.error("BOM dosyası en fazla 1 MB olabilir.");
      return;
    }
    await work("import", async () => {
      const XLSX = await import("xlsx");
      const wb = XLSX.read(await file.arrayBuffer(), {
        type: "array",
        sheetRows: 202,
      });
      const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(
        wb.Sheets[wb.SheetNames[0]],
      );
      const r = await api<{ cart: CartView; imported: number }>(
        `carts/${cart!.id}/import`,
        "POST",
        { rows },
      );
      setCart(r.cart);
      changed();
      toast.success(`${r.imported} satır eklendi.`);
    });
  }
  async function saveNew(mode: string) {
    await work("create", async () => {
      const name =
        form.name.trim() ||
        (mode === "copy"
          ? `${cart?.name} — kopya`
          : mode === "merge"
            ? "Birleşik proje sepeti"
            : "Yeni proje");
      const c = await api<CartView>("carts", "POST", {
        name,
        ...(mode === "copy"
          ? { sourceIds: [cart!.id] }
          : mode === "merge"
            ? { sourceIds: selectedCarts }
            : mode === "demo"
              ? { demo: true }
              : {}),
      });
      setCart(c);
      await load();
      changed();
      setModal(null);
      setView("cart");
      toast.success("Sepet oluşturuldu.");
    });
  }
  function toggleTheme() {
    const value = !dark;
    setDark(value);
    document.documentElement.classList.toggle("dark", value);
    localStorage.setItem("eub-theme", value ? "dark" : "light");
  }
  const updateSettings = (fn: () => void) => {
    fn();
    changed();
  };
  return (
    <SidebarProvider>
      <Toaster richColors position="bottom-right" />
      <Sidebar className="app-sidebar">
        <SidebarHeader>
          <a className="brand" href="/">
            <span className="brand-symbol">
              <Zap size={23} fill="currentColor" />
            </span>
            <span>
              Komponent
              <span className="brand-bottom">
                Radarı<span className="brand-dot">.</span>
              </span>
            </span>
          </a>
          <div className="workspace-label">MÜHENDİSİN ÇALIŞMA ALANI</div>
        </SidebarHeader>
        <SidebarContent>
          <nav className="side-nav">
            {navs.map(([key, Icon, label]) => (
              <button
                key={key}
                className={view === key ? "nav-item active" : "nav-item"}
                onClick={() => {
                  setView(key);
                  setQuery("");
                }}
              >
                <Icon size={19} />
                <span>{label}</span>
                {key === "cart" && cart && (
                  <span className="nav-count">{cart.items.length}</span>
                )}
                {key === "stores" && (
                  <span className="muted-count">
                    {data?.stores.length || 10}
                  </span>
                )}
              </button>
            ))}
          </nav>
          <div className="side-projects">
            <div className="side-section-label">
              PROJELERİM
              <button
                aria-label="Yeni sepet"
                onClick={() => {
                  patch("name", "");
                  setModal("new");
                }}
              >
                <Plus size={16} />
              </button>
            </div>
            {data?.carts.slice(0, 4).map((c) => (
              <button
                key={c.id}
                onClick={() => openCart(c.id)}
                className="project-link"
              >
                <span className="project-square" />
                {c.name}
              </button>
            ))}
          </div>
          <div className="side-note">
            <div>
              <Layers size={19} />
              <strong>Birlikte daha hesaplı.</strong>
            </div>
            <p>Arkadaşlarınla tek sepet oluştur, kargo maliyetini paylaş.</p>
            <button
              onClick={() => {
                setShareLink("");
                setModal("share");
              }}
            >
              Ortak sepet oluştur <ArrowUpRight size={16} />
            </button>
          </div>
        </SidebarContent>
        <SidebarFooter>
          {data?.user.admin && (
            <button className="nav-item" onClick={() => setView("admin")}>
              <Settings2 size={19} />
              Yönetim
            </button>
          )}
          <div className="sidebar-footer">
            <span className="tiny-chip">
              <Cpu size={14} /> Canlı karşılaştırma
            </span>
            <span>Türkiye</span>
          </div>
        </SidebarFooter>
      </Sidebar>
      <div className="main-shell">
        <header className="topbar">
          <div className="breadcrumb">
            <SidebarTrigger className="mobile-trigger" />
            <span>Çalışma alanı</span>
            <ChevronRight size={14} />
            <strong>{labels[view]}</strong>
          </div>
          <div className="top-actions">
            <button className="mode-switch" onClick={()=>{setUrlResult(null);patch("url","");patch("quantity","1");setModal("url");}}><Link2 size={16}/> Linkten karşılaştır</button>
            <button
              className="icon-button"
              aria-label={dark ? "Açık tema" : "Koyu tema"}
              onClick={toggleTheme}
            >
              {dark ? <Sun size={19} /> : <Moon size={19} />}
            </button>
            <span className="top-divider" />
            <button className="account" onClick={() => setModal("login")}>
              <span className="avatar">
                {data?.user.name.slice(0, 1) || "M"}
              </span>
              <span>
                {data?.user.name || "Hesabım"}
                <small>
                  {data?.user.name === "Misafir mühendis"
                    ? "Misafir oturumu"
                    : "Hesap"}
                </small>
              </span>
              <ChevronsUpDown size={14} />
            </button>
          </div>
        </header>
        <main className="main-content">
          <PricePhase/>
          {!data || !cart ? (
            <div className="loading-state">
              {error ? (
                <>
                  <Info />
                  <h2>Çalışma alanı açılamadı</h2>
                  <p>{error}</p>
                  <Button
                    onClick={() => {
                      setError("");
                      void load(true);
                    }}
                  >
                    Yeniden dene
                  </Button>
                  <Button variant="outline" onClick={() => setModal("login")}>
                    Giriş yap
                  </Button>
                </>
              ) : (
                <>
                  <LoaderCircle className="animate-spin" />
                  <h2>Çalışma alanın hazırlanıyor</h2>
                  <p>Ürün kataloğu ve sepetlerin yükleniyor.</p>
                </>
              )}
            </div>
          ) : (
            <>
              <div className="page-title-row">
                <div>
                  <div className="eyebrow">
                    <span className="eyebrow-line" />
                    {view === "cart"
                      ? "HER PARÇADA DAHA İYİ BİR HESAP"
                      : "ELEKTRONİK PROJELERİN İÇİN"}
                  </div>
                  <h1>
                    {view === "cart" ? "Akıllı sepetin, hazır." : labels[view]}
                  </h1>
                  <p>
                    {view === "cart"
                      ? "Parçaları sen seç. Kargo dahil en iyi kombinasyonu birlikte bulalım."
                      : view === "catalog"
                        ? "Elektronik parçanı ara, mağazalardaki teklifleri tek yerde karşılaştır."
                        : view === "saved"
                          ? "Projelerini sakla, kopyala veya tek siparişte birleştir."
                          : view === "stores"
                            ? "Mağaza entegrasyonları, kargo kuralları ve veri durumu."
                            : view === "favorites"
                              ? "Tekrar ihtiyaç duyacağın parçalar burada."
                              : view === "alerts"
                                ? "Hedef fiyatlarını takip et. Bildirimler uygulama içinde gösterilir."
                                : "Mağaza ve ürün eşleştirme yönetimi."}
                  </p>
                </div>
                {view === "cart" ? (
                  <Button
                    className="button-outline"
                    variant="outline"
                    onClick={() => {
                      patch("name", "");
                      setModal("new");
                    }}
                  >
                    <Plus size={16} />
                    Yeni sepet
                  </Button>
                ) : view === "saved" ? (
                  <Button
                    onClick={() => {
                      patch("name", "");
                      setModal("new");
                    }}
                  >
                    <Plus size={17} />
                    Yeni sepet
                  </Button>
                ) : null}
              </div>
              <form
                className="searchbar"
                onSubmit={(e) => {
                  e.preventDefault();
                  setView("catalog");
                }}
              >
                <Search size={21} />
                <input
                  aria-label="Ürün ara"
                  placeholder="Parça adı, model veya MPN ara… Örn. ESP32, STM32F103C8T6"
                  value={query}
                  onChange={(e) => {
                    setQuery(e.target.value);
                    if (e.target.value) setView("catalog");
                  }}
                />
                <kbd>MPN</kbd>
                <Button type="submit" disabled={!!busy}>
                  {busy === "search" ? "Aranıyor…" : "Ürün ara"}{" "}
                  <ArrowRight size={16} />
                </Button>
              </form>
              {!data.demo && (
                <div className="live-notice">
                  <div>
                    <Activity size={18} />
                    <span>
                      <strong>Gerçek mağaza fiyatları</strong>
                      <small>
                        {syncMessage || "Fiyatlar son kontrol tarihine göre değerlendirilir."}
                        {refreshing ? ` (${refreshSeconds} sn)` : ""}
                      </small>
                    </span>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={refresh}
                    disabled={!!busy || refreshing}
                  >
                    <RefreshCw
                      size={14}
                      className={refreshing ? "animate-spin" : ""}
                    />
                    {refreshing ? "Kontrol ediliyor…" : "Yenile"}
                  </Button>
                </div>
              )}
              {data.demo && (
                <div className="demo-notice">
                  <Info size={15} />
                  <span>
                    <strong>Demo verilerle keşfediyorsun.</strong> Fiyatlar ve
                    kargo ücretleri örnektir; güncel mağaza fiyatlarını temsil
                    etmez.
                  </span>
                  <button
                    onClick={() => {
                      setUrlResult(null);
                      setModal("url");
                    }}
                  >
                    Gerçek URL analiz et <ArrowUpRight size={14} />
                  </button>
                </div>
              )}
              {view === "cart" && (
                <>
                  <div className="cart-layout">
                    <section className="cart-panel surface">
                      <div className="panel-heading">
                        <div className="heading-icon">
                          <ShoppingBag size={20} />
                        </div>
                        <div className="cart-heading">
                          <h2>{cart.name}</h2>
                          <div>
                            <span>{cart.items.length} ürün kalemi</span>
                            <span className="small-dot" />
                            <span>{cart.members.length} katılımcı</span>
                            <span className="role-badge">
                              {cart.role === "owner"
                                ? "Senin sepetin"
                                : cart.role === "viewer"
                                  ? "Görüntüleme"
                                  : cart.role === "editor"
                                    ? "Düzenleme"
                                    : "Ürün ekleme"}
                            </span>
                          </div>
                        </div>
                        <button
                          className="icon-button"
                          aria-label="Sepeti paylaş"
                          onClick={() => {
                            setShareLink("");
                            setModal("share");
                          }}
                        >
                          <Share2 size={18} />
                        </button>
                      </div>
                      <div className="cart-toolbar">
                        <div>
                          <button
                            disabled={!canAdd}
                            onClick={() => fileRef.current?.click()}
                          >
                            <Upload size={15} />
                            BOM yükle
                          </button>
                          <button
                            disabled={!canAdd}
                            onClick={() => {
                              setUrlResult(null);
                              setModal("url");
                            }}
                          >
                            <Link2 size={15} />
                            URL ile ekle
                          </button>
                          <button
                            disabled={!canAdd}
                            onClick={() => setModal("manual")}
                          >
                            <Plus size={15} />
                            Manuel ekle
                          </button>
                        </div>
                        <button onClick={exportCsv} title="CSV indir">
                          <ArrowDownToLine size={16} />
                          <span>CSV</span>
                        </button>
                        <input
                          type="file"
                          accept=".csv,.xlsx"
                          hidden
                          ref={fileRef}
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) void importBom(file);
                            e.target.value = "";
                          }}
                        />
                      </div>
                      <Table className="cart-table">
                        <TableHeader>
                          <TableRow>
                            <TableHead>ÜRÜN / PARÇA NO.</TableHead>
                            <TableHead className="quantity-head">
                              ADET
                            </TableHead>
                            <TableHead className="price-head">
                              EN DÜŞÜK TUTAR
                            </TableHead>
                            <TableHead>
                              <span className="sr-only">Sil</span>
                            </TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {cart.items.map((item) => {
                            const p = productMap.get(item.canonical_product_id);
                            if (!p) return null;
                            const offers = activeOffers(p.id);
                            const price = priceFor(p.id, item.quantity);
                            return (
                              <TableRow key={item.id}>
                                <TableCell>
                                  <button
                                    className="product-cell"
                                    onClick={() => setDetail(p)}
                                  >
                                    <ProductMark category={p.category} />
                                    <div>
                                      <strong>{p.name}</strong>
                                      <small>
                                        {p.mpn}{" "}
                                        <span>
                                          ·{" "}
                                          {
                                            new Set(
                                              offers.map((o) => o.store_id),
                                            ).size
                                          }{" "}
                                          mağaza
                                        </span>
                                      </small>
                                      {cart.members.length > 1 && (
                                        <small>
                                          {cart.members.find(
                                            (m) => m.user_id === item.added_by,
                                          )?.label || "Katılımcı"}
                                        </small>
                                      )}
                                    </div>
                                  </button>
                                </TableCell>
                                <TableCell>
                                  <div className="quantity">
                                    <button
                                      disabled={
                                        !editable ||
                                        !!busy ||
                                        item.quantity <= 1
                                      }
                                      aria-label={`${p.name} azalt`}
                                      onClick={() =>
                                        updateQty(item.id, item.quantity - 1)
                                      }
                                    >
                                      <Minus size={12} />
                                    </button>
                                    <input
                                      aria-label={`${p.name} adet`}
                                      type="number"
                                      min="1"
                                      max="100000"
                                      key={`${item.id}-${item.quantity}`}
                                      defaultValue={item.quantity}
                                      disabled={!editable || !!busy}
                                      onBlur={(e) => {
                                        const n = Number(e.target.value);
                                        if (
                                          Number.isInteger(n) &&
                                          n > 0 &&
                                          n !== item.quantity
                                        )
                                          void updateQty(item.id, n);
                                        else
                                          e.target.value = String(
                                            item.quantity,
                                          );
                                      }}
                                    />
                                    <button
                                      disabled={!editable || !!busy}
                                      aria-label={`${p.name} artır`}
                                      onClick={() =>
                                        updateQty(item.id, item.quantity + 1)
                                      }
                                    >
                                      <Plus size={12} />
                                    </button>
                                  </div>
                                </TableCell>
                                <TableCell className="price-cell">
                                  <strong>
                                    {price === null
                                      ? (availabilityFor(p.id,item.quantity).previousPrice!==undefined?money(availabilityFor(p.id,item.quantity).previousPrice!):availabilityFor(p.id,item.quantity).label)
                                      : money(price)}
                                  </strong>
                                  <small>
                                    {price===null || availabilityFor(p.id,item.quantity).label==='Son alınan fiyat' ? availabilityFor(p.id,item.quantity).note : p.package_quantity > 1
                                      ? "Paket adedi dahil"
                                      : p.unit_type === "set" ? `${item.quantity} set · KDV dahil` : "KDV dahil"}
                                  </small>
                                </TableCell>
                                <TableCell>
                                  <button
                                    className="delete-button"
                                    disabled={!editable || !!busy}
                                    aria-label={`${p.name} sil`}
                                    onClick={() =>
                                      work("delete", async () => {
                                        setCart(
                                          await api<CartView>(
                                            `carts/${cart.id}/items/${item.id}`,
                                            "DELETE",
                                          ),
                                        );
                                        changed();
                                      })
                                    }
                                  >
                                    <Trash2 size={15} />
                                  </button>
                                </TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                      {!cart.items.length && (
                        <div className="empty">
                          <ShoppingBag />
                          <h3>İlk parçanı ekle</h3>
                          <p>
                            Ürün ara veya bir mağaza bağlantısı yapıştırarak sepete ekle.
                          </p>
                          <Button onClick={() => {setUrlResult(null);setModal("url");}}>
                            Linkten ürün ekle
                          </Button>
                        </div>
                      )}
                      <button
                        className="add-row"
                        disabled={!canAdd}
                        onClick={() => setView("catalog")}
                      >
                        <Plus size={17} />
                        Sepete ürün ekle
                      </button>
                      <div className="cart-bottom">
                        <div>
                          <ShieldCheck size={16} />
                          <span>KDV ve paket adetleri hesaba katılır.</span>
                        </div>
                        <button onClick={refresh} disabled={!!busy || refreshing}>
                          <RefreshCw
                            size={14}
                            className={refreshing ? "animate-spin" : ""}
                          />
                          Fiyatları yenile
                        </button>
                      </div>
                    </section>
                    <aside className="optimization-column">
                      <section className="optimizer-panel surface">
                        <div className="section-title">
                          <SlidersHorizontal size={19} />
                          <h2>Sepet ayarları</h2>
                        </div>
                        <label className="control-label">
                          En fazla kaç mağaza?
                        </label>
                        <div
                          className="store-segments"
                          role="group"
                          aria-label="Maksimum mağaza"
                        >
                          {["1", "2", "3", "4", "0"].map((n) => (
                            <button
                              aria-pressed={maxStores === n}
                              className={maxStores === n ? "selected" : ""}
                              key={n}
                              onClick={() =>
                                updateSettings(() => setMaxStores(n))
                              }
                            >
                              {n === "0" ? "Sınırsız" : n}
                            </button>
                          ))}
                        </div>
                        <div className="settings-checks">
                          <Choice
                            checked={exact}
                            onChange={(v) => updateSettings(() => setExact(v))}
                          >
                            Sadece birebir eşleşmeler <ShieldCheck size={14} />
                          </Choice>
                          <div className="fixed-option">
                            <Check size={15} />
                            Yalnızca stokta olan teklifler
                          </div>
                        </div>
                        <details className="advanced">
                          <summary>
                            Gelişmiş tercihler <Settings2 size={14} />
                          </summary>
                          <Field label="Ek mağaza başına minimum tasarruf (₺)">
                            <input
                              type="number"
                              min="0"
                              value={minSaving}
                              onChange={(e) =>
                                updateSettings(() =>
                                  setMinSaving(
                                    Math.max(0, Number(e.target.value)),
                                  ),
                                )
                              }
                            />
                          </Field>
                          <p className="muted small">
                            İhtiyaç kalemi tek mağazadan karşılanır.
                            Alternatifler yalnızca ilgili kalemde izin verdiysen
                            kullanılır.
                          </p>
                          <div className="merchant-checkboxes">
                            {data.stores.map((s) => (
                              <Choice
                                key={s.id}
                                checked={storeFilter.includes(s.id)}
                                onChange={(v) =>
                                  updateSettings(() =>
                                    setStoreFilter(
                                      v
                                        ? [...new Set([...storeFilter, s.id])]
                                        : data.stores
                                            .map((s) => s.id)
                                            .filter(
                                              (sid) =>
                                                sid !== s.id &&
                                                storeFilter.includes(sid),
                                            ),
                                    ),
                                  )
                                }
                              >
                                {s.name}
                              </Choice>
                            ))}
                          </div>
                        </details>
                        <div className="estimate">
                          <div>
                            <span>Ürünler için alt sınır</span>
                            <strong>{money(estimate)}</strong>
                          </div>
                          <div>
                            <span>Kargo</span>
                            <span>Optimizasyonda hesaplanır</span>
                          </div>
                        </div>
                        <Button
                          className="optimize-button"
                          disabled={!!busy || !cart.items.length}
                          onClick={optimizeCart}
                        >
                          {busy === "optimize" ? (
                            <LoaderCircle size={18} className="animate-spin" />
                          ) : (
                            <Zap size={18} />
                          )}
                          En ucuz kombinasyonu bul
                          <ArrowRight size={17} />
                        </Button>
                        <div className="optimizer-caption">
                          {countStores} / {storeFilter.length} mağazada bu sepet
                          için fiyat var. Ürünleri tek tek en ucuzundan alırsan {cheapestStores} farklı mağaza kullanılır.
                          {!!datedPrices && <p>{datedPrices} üründe son alınan fiyat kullanılıyor; kontrol tarihi ürünün yanında gösterilir.</p>}
                        </div>
                      </section>
                      <div className="shipping-note">
                        <span className="shipping-icon">
                          <Truck size={21} />
                        </span>
                        <div>
                          <strong>Ucuz parça ≠ ucuz sepet</strong>
                          <p>
                            Bir parçaya daha az öderken fazladan kargo ücreti
                            ödeme. Sepetinin tamamına bakalım.
                          </p>
                        </div>
                      </div>
                    </aside>
                  </div>
                  <section className="results-section">
                    <div className="results-heading">
                      <div>
                        <div className="eyebrow">
                          BÜTÜN SEPETİ DÜŞÜNEN HESAP
                        </div>
                        <h2>Bir sepet, farklı ihtimaller.</h2>
                        <p>
                          Mağaza sayısını ve toplam maliyeti karşılaştır. Karar
                          senin.
                        </p>
                      </div>
                      {result && (
                        <span className="calculated">
                          <CheckCircle2 size={15} />
                          {result.optimal
                            ? data.demo
                              ? "Kesin sonuç"
                              : "Mağaza kargo ayarlarıyla en iyi sonuç"
                            : "Bulunan en iyi sonuç"}
                        </span>
                      )}
                    </div>
                    {!result ? (
                      <div className="result-placeholder">
                        <div className="result-placeholder-icon">
                          <BarChart3 size={27} />
                        </div>
                        <div>
                          <h3>Tasarrufun burada görünecek.</h3>
                          <p>
                            Sepetini optimize et; toplamı değiştiren mağaza dağılımlarını karşılaştır.
                          </p>
                        </div>
                        <ArrowRight size={22} />
                      </div>
                    ) : !result.scenarios.length ? (
                      <div className="error-box">
                        {result.missing.length
                          ? "Uygun teklif bulunamadı:"
                          : "Seçilen mağaza sınırı ve stoklarla sepet tamamlanamıyor."}{" "}
                        {result.missing
                          .map((id) => productMap.get(id)?.name || id)
                          .join(", ")}
                        . Stok, mağaza ve eşleşme tercihlerini kontrol edin.
                      </div>
                    ) : (
                      <>
                        <p className="comparison-coverage">
                          Seçtiğin {storeFilter.length} mağazanın {result.eligibleStoreIds?.length ?? countStores} tanesinde bu sepet için kullanılabilir fiyat var: {(result.eligibleStoreIds || []).map(id => storeMap.get(id)?.name).join(", ")}.
                          {(result.eligibleStoreIds?.length ?? 10) < 3 && " Diğer mağazalar karşılaştırma tablosunda gösterilir; fakat uygun ürün eşleşmesi ve doğrulanmış güncel fiyat olmadan alışveriş planına eklenemez."}
                        </p>
                        <div className="plan-mode" aria-label="Mağaza sayısı karşılaştırma türü">
                          <button type="button" aria-pressed={planMode==="upTo"} onClick={()=>{setPlanMode("upTo");setSelected(result.recommendedMax);}}>En ucuz dağılım</button>
                          <button type="button" aria-pressed={planMode==="exact"} onClick={()=>{setPlanMode("exact");setSelected(result.exactScenarios?.find(s=>s.storeCount===3)?.maxStores || result.exactScenarios?.[0]?.maxStores || 1);}}>Tam mağaza sayısı</button>
                        </div>
                        <p className="muted small">{planMode === "exact" ? "Her kart belirtilen sayıda mağazadan gerçekten sipariş verir." : "Mağaza sayısı üst sınırdır."} Aynı toplamı veren seçeneklerden en az mağaza kullanan gösterilir.</p>
                        <div className="scenario-grid">
            {displayedScenarios.map((displayed, idx) => {const n=displayed.maxStores;
                            const s =
                              n === 0
                                ? result.scenarios.at(-1)
                                : (planMode === "exact" ? result.exactScenarios || [] : result.scenarios).find(
                                    (s) => s.maxStores === n,
                                  );
                            if (!s)
                              return (
                                <div
                                  key={idx}
                                  className="scenario-card unavailable"
                                >
                                  <div className="scenario-label">
                                    {n === 1
                                      ? "TEK MAĞAZA"
                                      : n === 0
                                        ? "EN DÜŞÜK MALİYET"
                                        : `${planMode === "exact" ? "TAM" : "EN FAZLA"} ${n} MAĞAZA`}
                                  </div>
                                  <div className="scenario-price">
                                    {maxStores!=="0" && n>Number(maxStores)?"Seçilen sınırın dışında":!result.optimal?"Kontrol tamamlanmadı":"Çözüm yok"}
                                  </div>
                                  <p className="muted small">
                                    {n > (result.eligibleStoreIds?.length ?? 10) ? `Bu sepet için yalnızca ${result.eligibleStoreIds?.length} mağazada uygun teklif var.` : !result.optimal ? "Hesaplama sınırına ulaşıldı; bu seçenek için sonuç henüz bulunamadı." : "Bu sınırla sepetin tamamı karşılanamıyor."}
                                  </p>
                                </div>
                              );
                            const active = scenario?.maxStores === s.maxStores && (n!==0 || planMode==="upTo");
                            return (
                              <button
                                key={idx}
                                className={`scenario-card ${active ? "active" : ""}`}
                                onClick={() => {if(n===0)setPlanMode("upTo");setSelected(s.maxStores);}}
                              >
                                <div className="scenario-label">
                                  {n === 0
                                    ? "EN DÜŞÜK MALİYET"
                                    : n === 1
                                      ? "TEK MAĞAZA"
                                      : `${planMode === "exact" ? "TAM" : "EN FAZLA"} ${n} MAĞAZA`}
                                  {active ? (
                                    <CheckCircle2 size={17} />
                                  ) : (
                                    <span className="radio-circle" />
                                  )}
                                </div>
                                <div className="scenario-price">
                                  {money(s.total)}
                                </div>
                                <div className="scenario-breakdown">
                                  Ürün {money(s.productTotal)}{" "}
                                  <span>+ kargo {money(s.shippingTotal)}</span>
                                </div>
                                {planMode === "upTo" && n > 0 && s.storeCount < n && result.optimal && (
                                  <div className="scenario-breakdown">{n}. mağaza kargo dahil toplamı düşürmüyor; {s.storeCount} mağaza yeterli.</div>
                                )}
                                <div className="scenario-footer">
                                  <span>
                                    <StoreIcon size={13} />
                                    {s.storeCount} mağaza
                                  </span>
                                  <strong>
                                    {s.savings > 0
                                      ? `${money(s.savings)} tasarruf`
                                      : "Karşılaştırma noktası"}
                                  </strong>
                                </div>
                              </button>
                            );
                          })}
                        </div>
                        {result.exactScenarios?.find(s=>s.storeCount===3) && result.scenarios.find(s=>s.maxStores===3)?.storeCount !== 3 && (()=>{
                          const third=result.exactScenarios!.find(s=>s.storeCount===3)!;
                          const best=result.scenarios.find(s=>s.maxStores===3)!;
                          if(!best) return null;
                          const productDifference=third.productTotal-best.productTotal, shippingDifference=third.shippingTotal-best.shippingTotal;
                          return <div className="third-store-explanation"><strong>Üç mağazaya bölünce ne değişiyor?</strong><p>Gerçek 3 mağaza planı {money(third.total)}. Ürünler {productDifference<0?`${money(-productDifference)} daha ucuz`:`${money(productDifference)} daha pahalı`}; kargo {shippingDifference<0?`${money(-shippingDifference)} azalıyor`:`${money(shippingDifference)} artıyor`}. {third.total>best.total?`Toplam ${money(third.total-best.total)} daha fazla.`:"Toplam değişmiyor."}</p><button type="button" onClick={()=>{setPlanMode("exact");setSelected(3);}}>3 mağazadaki ürün dağılımını göster</button></div>;
                        })()}
                        {result.eligibleOffers?.some(o=>!isFresh(o)) ? <p className="muted small">Bu hesapta son alınan fiyatlar da kullanıldı. Fiyatların gerçek kontrol tarihleri ürün detayında gösterilir; yenileme başarılı olduğunda yeni fiyat kullanılır.</p> : null}
                        {result.reason && (
                          <p className="error-box">{result.reason}</p>
                        )}
                        {scenario && (
                          <>
                            <div className="savings-strip">
                              <div>
                                <span className="savings-symbol">
                                  <Zap size={19} />
                                </span>
                                <p>
                                  <strong>
                                    {result.scenarios.some(
                                      (s) => s.maxStores === 1,
                                    )
                                      ? `${money(scenario.savings)} cebinde kalsın.`
                                      : `Sepetin ${scenario.storeCount} mağazadan tamamlanıyor.`}
                                  </strong>
                                  <span>
                                    {" "}
                                    {result.scenarios.some(
                                      (s) => s.maxStores === 1,
                                    )
                                      ? "Tek mağazalı en iyi çözüme göre"
                                      : "Tek mağazada tüm ürünler stokta olmadığı için tasarruf oranı hesaplanmadı."}{" "}
                                    {result.scenarios.some(
                                      (s) => s.maxStores === 1,
                                    ) && result.scenarios[0]?.total
                                      ? `%${((scenario.savings / result.scenarios[0].total) * 100).toFixed(1).replace(".", ",")}`
                                      : ""}{" "}
                                    {result.scenarios.some(
                                      (s) => s.maxStores === 1,
                                    )
                                      ? "tasarruf."
                                      : ""}
                                  </span>
                                </p>
                              </div>
                              <Button
                                variant="outline"
                                disabled={!editable || !!busy}
                                onClick={() =>
                                  work("save", async () => {
                                    setCart(
                                      await api<CartView>(
                                        `carts/${cart.id}/snapshot`,
                                        "POST",
                                        {
                                          ...settings(),
                                          maxStores: scenario.maxStores,
                                          planMode,
                                          scenarioCount: planMode === "exact" ? scenario.storeCount : scenario.maxStores,
                                        },
                                      ),
                                    );
                                    toast.success(
                                      "Sepet ve fiyat anlık görüntüsü kaydedildi.",
                                    );
                                  })
                                }
                              >
                                <Save size={16} />
                                Sonucu kaydet
                              </Button>
                            </div>
                            <OptimizationDetails result={result} scenario={scenario} products={productMap} stores={storeMap} />
                            <div className="allocation-layout">
                              <section className="surface tradeoffs">
                                <h3>{planMode==="exact"?"Tam mağaza sayısına göre toplam maliyet":"Mağaza üst sınırına göre toplam maliyet"}</h3>
                                <div className="pareto-chart">
                                  {displayedScenarios
                                    .map((s, i) => {
                                      const prev = displayedScenarios[i - 1];
                                      return (
                                        <div
                                          key={s.maxStores}
                                          className="pareto-row"
                                        >
                                          <span>
                                            {planMode==="exact"?`Tam ${s.storeCount} mağaza`:`${s.maxStores} mağazaya kadar · ${s.storeCount} mağaza kullanılır`}
                                          </span>
                                          <div>
                                            <span
                                              className="pareto-bar"
                                              style={{
                                                width: `${(s.total / result.scenarios[0].total) * 100}%`,
                                              }}
                                            />
                                          </div>
                                          <strong>{money(s.total)}</strong>
                                          {prev && (
                                            <small>
                                              {prev.total - s.total > 0
                                                ? `${money(prev.total - s.total)} ek tasarruf`
                                                : s.total>prev.total?`${money(s.total-prev.total)} maliyet artışı`:"Aynı en ucuz dağılım"}
                                            </small>
                                          )}
                                        </div>
                                      );
                                    })}
                                </div>
                                <p className="muted small">
                                  Kargo ücretleri tahminidir. Satın almadan önce
                                  satıcıdaki toplamı doğrula.
                                </p>
                                <details className="cost-sharing">
                                  <summary>
                                    <Users size={16} />
                                    Kişi bazında maliyet
                                  </summary>
                                  <SelectBox
                                    value={costMode}
                                    onChange={(v) =>
                                      setCostMode(v as typeof costMode)
                                    }
                                    options={[
                                      {
                                        value: "proportional",
                                        label: "Kargoyu tutara orantılı böl",
                                      },
                                      {
                                        value: "equal",
                                        label: "Kargoyu eşit böl",
                                      },
                                    ]}
                                  />
                                  {Object.entries(
                                    allocateCosts(scenario, costMode),
                                  ).map(([id, cost], i) => (
                                    <div className="split-line" key={id}>
                                      <span>
                                        {cart.members.find(
                                          (m) => m.user_id === id,
                                        )?.label || `Katılımcı ${i + 1}`}
                                      </span>
                                      <strong>{money(cost.total)}</strong>
                                    </div>
                                  ))}
                                </details>
                              </section>
                            </div>
                            <p className="result-footnote">
                              <Clock3 size={13} />
                              Hesaplama: {timeAgo(result.generatedAt)} ·{" "}
                              {data.demo
                                ? "Sentetik demo fiyatları"
                                : "Son kontrol: " +
                                  timeAgo(
                                    data.offers
                                      .filter(o=>scenario.groups.some(g=>g.lines.some(line=>line.offerId===o.id)))
                                      .map((o) => o.last_checked_at)
                                      .sort()[0] || result.generatedAt,
                                  )}{" "}
                              · Paket yuvarlamaları ve KDV dahil.
                            </p>
                          </>
                        )}
                      </>
                    )}
                  </section>
                </>
              )}
              {(view === "catalog" || view === "favorites") && (
                <section className="catalog-section">
                  {view === "catalog" && !data.demo && <MerchantCatalog query={query} stores={data.stores} offers={data.offers} busy={!!busy} onAdd={addIndexedProduct} />}
                  {(view === "favorites" || data.demo) && <>
                  <h2 className="catalog-verified-title">{view === "favorites" ? "Favorilerim" : "Demo ürünleri"}</h2>
                  <div className="filter-row">
                    <div className="category-pills">
                      {[
                        "all",
                        ...new Set(data.products.map(p => p.category)),
                      ].map((c) => (
                        <button
                          className={category === c ? "active" : ""}
                          onClick={() => setCategory(c)}
                          key={c}
                        >
                          {c === "all" ? "Tüm parçalar" : c}
                        </button>
                      ))}
                    </div>
                    <Choice checked={onlyStock} onChange={setOnlyStock}>
                      Stoktakiler
                    </Choice>
                  </div>
                  <div className="catalog-meta">
                    <span>{filteredProducts.length} ürün bulundu</span>
                    <Choice checked={exact} onChange={setExact}>
                      Sadece birebir eşleşmeler
                    </Choice>
                  </div>
                  <div className="product-grid">
                    {filteredProducts.map((p) => {
                      const offers = activeOffers(p.id),
                        price = priceFor(
                          p.id,
                          data.demo ? p.package_quantity : 1,
                        );
                      return (
                        <article className="product-card surface" key={p.id}>
                          <div className="product-card-top">
                            <span className="category-tag">{p.category}</span>
                            <button
                              className={
                                data.favorites.includes(p.id)
                                  ? "favorite on"
                                  : "favorite"
                              }
                              aria-label="Favoriye ekle veya çıkar"
                              onClick={() =>
                                work("favorite", async () => {
                                  const r = await api<{ active: boolean }>(
                                    "favorites",
                                    "POST",
                                    { productId: p.id },
                                  );
                                  setData({
                                    ...data,
                                    favorites: r.active
                                      ? [...data.favorites, p.id]
                                      : data.favorites.filter(
                                          (f) => f !== p.id,
                                        ),
                                  });
                                })
                              }
                            >
                              <Heart
                                size={18}
                                fill={
                                  data.favorites.includes(p.id)
                                    ? "currentColor"
                                    : "none"
                                }
                              />
                            </button>
                          </div>
                          <button
                            className="product-card-main"
                            onClick={() => setDetail(p)}
                          >
                            <ProductMark category={p.category} />
                            <h3>{p.name}</h3>
                            <span>{p.mpn}</span>
                          </button>
                          <div className="catalog-price">
                            <div>
                              <small>
                                {!data.demo
                                  ? "Minimum sipariş için başlayan"
                                  : p.package_quantity > 1
                                    ? `${p.package_quantity} adet için başlayan`
                                    : "Başlayan fiyat"}
                              </small>
                              <strong>
                                {price === null ? (availabilityFor(p.id).previousPrice!==undefined?money(availabilityFor(p.id).previousPrice!):availabilityFor(p.id).label) : money(price)}
                              </strong>
                            </div>
                            <span>
                              {price===null?availabilityFor(p.id).label:`${offers.length} teklif`} <ChevronRight size={13} />
                            </span>
                          </div>
                          <Button
                            className="product-add"
                            variant="outline"
                            disabled={!canAdd || !!busy}
                            onClick={() => addProduct(p)}
                          >
                            <Plus size={15} />
                            Sepete ekle
                          </Button>
                        </article>
                      );
                    })}
                  </div>
                  {!filteredProducts.length && (
                    <div className="empty">
                      <Search />
                      <h3>Bu aramada ürün yok.</h3>
                      <p>
                        Farklı MPN kullan veya stok filtresini kaldır.
                        İhtiyacını manuel de ekleyebilirsin.
                      </p>
                      <Button onClick={() => setModal("manual")}>
                        Manuel ürün ekle
                      </Button>
                    </div>
                  )}
                  </>}
                </section>
              )}
              {view === "saved" && (
                <section>
                  <div className="saved-toolbar">
                    <Choice
                      checked={
                        data.carts.length > 0 &&
                        selectedCarts.length === data.carts.length
                      }
                      onChange={(v) =>
                        setSelectedCarts(v ? data.carts.map((c) => c.id) : [])
                      }
                    >
                      Tümünü seç
                    </Choice>
                    <div>
                      <Button
                        variant="outline"
                        disabled={selectedCarts.length !== 2 || !!busy}
                        onClick={() => setModal("compare")}
                      >
                        <Layers size={15} />
                        Karşılaştır
                      </Button>
                      <Button
                        disabled={selectedCarts.length < 2 || !!busy}
                        onClick={() => {
                          patch("name", "");
                          setModal("merge");
                        }}
                      >
                        <GitMerge size={15} />
                        Sepetleri birleştir ({selectedCarts.length})
                      </Button>
                    </div>
                  </div>
                  <div className="saved-grid">
                    {data.carts.map((c) => (
                      <article className="surface saved-card" key={c.id}>
                        <div>
                          <Checkbox
                            aria-label={`${c.name} seç`}
                            checked={selectedCarts.includes(c.id)}
                            onCheckedChange={(v) =>
                              setSelectedCarts(
                                v
                                  ? [...selectedCarts, c.id]
                                  : selectedCarts.filter((id) => id !== c.id),
                              )
                            }
                          />
                          <FolderOpen size={22} />
                        </div>
                        <h3>{c.name}</h3>
                        <p>Son düzenleme {timeAgo(c.updated_at)}</p>
                        <div>
                          <Button
                            variant="outline"
                            onClick={() => openCart(c.id)}
                          >
                            Sepeti aç <ArrowRight size={14} />
                          </Button>
                          <button
                            className="icon-button"
                            aria-label="Sepeti kopyala"
                            onClick={() =>
                              work("copy", async () => {
                                const copied = await api<CartView>(
                                  "carts",
                                  "POST",
                                  {
                                    name: `${c.name} — kopya`,
                                    sourceIds: [c.id],
                                  },
                                );
                                setCart(copied);
                                await load();
                                setView("cart");
                                changed();
                              })
                            }
                          >
                            <Copy size={17} />
                          </button>
                        </div>
                      </article>
                    ))}
                  </div>
                  {cart.snapshots.length > 0 && (
                    <div className="surface snapshot-panel">
                      <h3>{cart.name} · Fiyat anlık görüntüleri</h3>
                      {cart.snapshots.map((s, i) => (
                        <div className="split-line" key={s.id}>
                          <span>
                            {new Date(s.created_at).toLocaleString("tr-TR")}
                          </span>
                          <strong>{money(s.total)}</strong>
                          {i === 0 && scenario && (
                            <span>
                              Bugüne fark: {money(scenario.total - s.total)}
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </section>
              )}
              {view === "stores" && cart && <ShippingLogsPanel stores={data.stores} cart={cart} onChange={next=>{setCart(next);changed();void load(false,next.id);}}/>}
              {view === "admin" && <StorePanel stores={data.stores} admin={data.user.admin} onChange={()=>void load()}/>}
              {view === "admin" && data.user.admin && (
                <AdminTools
                  products={data.products}
                  onChange={() => void load()}
                />
              )}
              {view === "alerts" && <WatchPanel prices={data.alerts} stocks={data.stockAlerts} products={data.products} offers={data.offers} onChange={()=>void load()} onRefresh={ids=>void refreshPrices(ids,true,true)} refreshing={refreshing}/>}
              <footer className="page-footer">
                <span>
                  <Cpu size={14} /> Projene odaklan. Gerisini hesaplayalım.
                </span>
                <span>Fiyatlar KDV dahil · TRY / ₺</span>
              </footer>
            </>
          )}
        </main>
      </div>
      <Dialog
        open={!!modal}
        onOpenChange={(v) => {
          if (!v) setModal(null);
        }}
      >
        <DialogContent className="app-dialog">
          <DialogHeader>
            <DialogTitle>
              {modal === "new"
                ? "Yeni proje sepeti"
                : modal === "merge"
                  ? "Sepetleri birleştir"
                  : modal === "manual"
                    ? "Manuel ihtiyaç ekle"
                    : modal === "url"
                      ? "Linkten karşılaştır ve sepete ekle"
                      : modal === "share"
                        ? "Birlikte, tek sepette."
                        : modal === "login"
                          ? "Hesabına giriş yap"
                          : modal === "alert"
                            ? "Fiyat / stok takibi ekle"
                            : modal === "compare"
                              ? "İki sepeti karşılaştır"
                              : "Sepet"}
            </DialogTitle>
            <DialogDescription>
              {modal === "share"
                ? "Bağlantıyı bilen kişi seçtiğin yetkiyle sepete katılır. Bağlantı 30 gün geçerlidir."
                : modal === "url"
                  ? `${(data?.stores || []).filter(s=>s.enabled).map(s=>s.name).join(', ')} ürün bağlantısını yapıştır.`
                  : modal === "manual"
                    ? "Bu ihtiyaç için doğrulanmış teklif bulunmadan optimizasyon tamamlanamaz."
                    : modal === "login"
                      ? "Hesap, sepetlerini farklı cihazlardan açmanı sağlar."
                      : "Proje bilgilerini aşağıdan düzenleyebilirsin."}
            </DialogDescription>
          </DialogHeader>
          {(modal === "new" || modal === "merge") && (
            <>
              <Field label="Sepet adı">
                <input
                  value={form.name}
                  onChange={(e) => patch("name", e.target.value)}
                  placeholder="Örn. Bitirme projesi V1"
                />
              </Field>
              {modal === "merge" && (
                <p>
                  {selectedCarts.length} sepet yeni bir sepette birleştirilecek.
                  Ortak ürünlerin miktarları ve ekleyen kişi bilgisi korunur.
                </p>
              )}
              <Button disabled={!!busy} onClick={() => saveNew(modal)}>
                {" "}
                {modal === "merge" ? (
                  <GitMerge size={16} />
                ) : (
                  <Plus size={16} />
                )}{" "}
                {modal === "merge" ? "Birleştir" : "Sepeti oluştur"}
              </Button>
            </>
          )}
          {modal === "share" && (
            <>
              <Field label="Paylaşım yetkisi">
                <SelectBox
                  value={shareRole}
                  onChange={setShareRole}
                  options={[
                    { value: "viewer", label: "Yalnızca görüntüleyebilir" },
                    { value: "contributor", label: "Ürün ekleyebilir" },
                    { value: "editor", label: "Düzenleyebilir" },
                  ]}
                />
              </Field>
              <Button
                disabled={!!busy || cart?.role !== "owner"}
                onClick={() =>
                  work("share", async () => {
                    const r = await api<{ url: string }>(
                      `carts/${cart!.id}/share`,
                      "POST",
                      { role: shareRole },
                    );
                    setShareLink(location.origin + r.url);
                  })
                }
              >
                <Link2 size={16} />
                Paylaşım bağlantısı oluştur
              </Button>
              {cart?.role !== "owner" && (
                <p className="muted">
                  Yalnızca sepet sahibi davet oluşturabilir.
                </p>
              )}
              {shareLink && (
                <div className="share-copy">
                  <input
                    readOnly
                    value={shareLink}
                    aria-label="Paylaşım bağlantısı"
                  />
                  <Button
                    onClick={() =>
                      void navigator.clipboard
                        .writeText(shareLink)
                        .then(() => toast.success("Bağlantı kopyalandı."))
                        .catch(() =>
                          toast.info("Bağlantıyı seçip kopyalayabilirsin."),
                        )
                    }
                  >
                    <Copy size={16} />
                  </Button>
                </div>
              )}
              <p className="muted small" role="status">{sharedStatus} · Sepet değişiklikleri açık ekranlara otomatik yansır.</p>
              <div className="share-members"><h3>Katılımcılar</h3>{cart?.members.map(member=><div className="share-member" key={member.user_id}><span>{member.label}</span>{cart.role==="owner" && member.role!=="owner" ? <><SelectBox value={member.role} onChange={role=>void work("member",async()=>{setCart(await api<CartView>(`carts/${cart.id}/members/${member.user_id}`,"PATCH",{role}));await load();})} options={[{value:"viewer",label:"Görüntüleyici"},{value:"contributor",label:"Ürün ekleyebilir"},{value:"editor",label:"Düzenleyici"}]}/><Button variant="ghost" disabled={!!busy} onClick={()=>void work("member",async()=>{setCart(await api<CartView>(`carts/${cart.id}/members/${member.user_id}`,"DELETE"));await load();})}>Sepetten çıkar</Button></> : <span className="role-badge">{({owner:"Sepet sahibi",viewer:"Görüntüleyici",contributor:"Ürün ekleyebilir",editor:"Düzenleyici"} as Record<string,string>)[member.role]}</span>}</div>)}</div>
              {cart?.role === "owner" && (
                <Button
                  variant="outline"
                  onClick={() =>
                    work("revoke", async () => {
                      await api(`carts/${cart.id}/shares`, "DELETE");
                      setShareLink("");
                      toast.success(
                        "Davet bağlantıları iptal edildi. Mevcut üyelikler korunur.",
                      );
                    })
                  }
                >
                  Davet bağlantılarını iptal et
                </Button>
              )}
            </>
          )}
          {modal === "manual" && (
            <>
              <Field label="Ürün adı">
                <input
                  value={form.name}
                  onChange={(e) => patch("name", e.target.value)}
                />
              </Field>
              <div className="two-fields">
                <Field label="Üretici / tercih edilen marka">
                  <input
                    value={form.manufacturer}
                    onChange={(e) => patch("manufacturer", e.target.value)}
                  />
                </Field>
                <Field label="Model / MPN">
                  <input
                    value={form.mpn}
                    onChange={(e) => patch("mpn", e.target.value)}
                  />
                </Field>
              </div>
              <div className="two-fields">
                <Field label="Adet">
                  <input
                    type="number"
                    min="1"
                    value={form.quantity}
                    onChange={(e) => patch("quantity", e.target.value)}
                  />
                </Field>
                <Field label="Maksimum birim fiyat (₺, isteğe bağlı)">
                  <input
                    type="number"
                    min="0"
                    value={form.maxPrice}
                    onChange={(e) => patch("maxPrice", e.target.value)}
                  />
                </Field>
              </div>
              <Field label="Not">
                <input
                  value={form.notes}
                  onChange={(e) => patch("notes", e.target.value)}
                />
              </Field>
              <Choice checked={manualAlt} onChange={setManualAlt}>
                Uyumlu alternatif kabul ediyorum
              </Choice>
              <Button
                disabled={!!busy || !form.name || !canAdd}
                onClick={() =>
                  work("manual", async () => {
                    const p = await api<Product>("manual", "POST", {
                      name: form.name,
                      manufacturer: form.manufacturer,
                      mpn: form.mpn,
                    });
                    setCart(
                      await api<CartView>(`carts/${cart!.id}/items`, "POST", {
                        productId: p.id,
                        quantity: Number(form.quantity),
                        notes: form.notes,
                        allowAlternative: manualAlt,
                        manufacturer: form.manufacturer,
                        maximumUnitPrice: form.maxPrice
                          ? Math.round(Number(form.maxPrice) * 100)
                          : null,
                      }),
                    );
                    await load();
                    changed();
                    setModal(null);
                    toast.success("İhtiyaç sepete eklendi.");
                  })
                }
              >
                İhtiyacı ekle
              </Button>
            </>
          )}
          {modal === "url" && <>
            <Field label="Mağaza ürün bağlantısı"><input type="url" placeholder="https://www.robotistan.com/…" value={form.url} onChange={event=>patch("url",event.target.value)}/></Field>
            <Field label="İhtiyaç adedi"><input type="number" min="1" max="100000" value={form.quantity} onChange={event=>patch("quantity",event.target.value)}/></Field>
            <Button disabled={!!busy || !form.url || !canAdd} onClick={()=>void work("url",async()=>{
              setUrlResult(null);
              const found=await api<LinkResult>("url","POST",{url:form.url.trim(),cartId:cart!.id,quantity:Number(form.quantity)});
              setUrlResult(found);setCart(found.cart);await load(false,found.cart.id);changed();toast.success("Ürün sepete eklendi ve mağazalar karşılaştırıldı.");
            })}>{busy==="url"?<LoaderCircle className="animate-spin" size={16}/>:<Link2 size={16}/>} En ucuzu bul ve sepete ekle</Button>
            {busy==="url" && <p role="status">Ürün modeli ve varyantı okunuyor; diğer mağazaların fiyatları karşılaştırılıyor…</p>}
            {urlResult && <LinkComparison result={urlResult} busy={!!busy} editable={!!editable} onExclude={(offerId,excluded)=>void excludeOffer(urlResult.product.id,offerId,excluded)}/>}
          </>}
          {modal === "login" && <div className="account-panel">
            {data?.user.authenticated ? <><h3>{data.user.name}</h3><p>{data.user.email}</p><p>Sepetlerin, favorilerin ve takiplerin hesabında saklanır. Aynı hesapla başka cihazda giriş yapabilirsin.</p><a className="account-login" href="/signout-with-chatgpt?return_to=%2F" target="_top">Çıkış yap</a></> : <><p>Üye ol veya giriş yap; mevcut misafir sepetin hesabına aktarılır.</p><a className="account-login" href={`/signin-with-chatgpt?return_to=${encodeURIComponent(typeof location!=="undefined"?location.pathname:"/")}`} target="_top">ChatGPT ile üye ol / giriş yap</a><p className="muted small">Güvenli girişten sonra aynı hesapla bütün cihazlarında sepetlerine ulaşabilirsin.</p></>}
            {config?.googleConfigured && !data?.user.authenticated && <Button variant="outline" onClick={()=>void work("login",async()=>{const {error}=await authClient()!.auth.signInWithOAuth({provider:"google",options:{redirectTo:location.origin+"/auth/complete"}});if(error)throw error;})}>Google ile devam et</Button>}
          </div>}
          {modal === "alert" && detail && (
            <>
              <p>{detail.name}</p>
              <Field label="Takip türü"><SelectBox value={alertKind} onChange={setAlertKind} options={[{value:"price",label:"Fiyat hedefi"},{value:"stock",label:"Stokta olduğunda göster"}]}/></Field>
              {alertKind==="price" && <Field label="1 adet için minimum satın alma tutarı hedefi (₺)"><input type="number" min="0.01" step="0.01" value={form.alertPrice} onChange={event=>patch("alertPrice",event.target.value)}/></Field>}
              <Button
                onClick={() =>
                  work("alert", async () => {
                    await api("alerts", "POST", {
                      productId: detail.id,
                      kind: alertKind,
                      targetPrice: Math.round(Number(form.alertPrice) * 100),
                    });
                    await load();
                    setModal(null);
                    toast.success("Takip kaydedildi.");
                  })
                }
              >
                Takibi kaydet
              </Button>
            </>
          )}
          {modal === "compare" && (
            <CartComparison ids={selectedCarts} products={productMap} />
          )}
        </DialogContent>
      </Dialog>
      <Dialog
        open={!!detail && modal !== "alert"}
        onOpenChange={(v) => {
          if (!v) setDetail(null);
        }}
      >
        <DialogContent className="product-dialog">
          <DialogHeader>
            <div className="detail-heading">
              {detail && <ProductMark category={detail.category} />}
              <div>
                <DialogTitle>{detail?.name}</DialogTitle>
                <DialogDescription>
                  {detail?.manufacturer} · {detail?.mpn}
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>
          {detail && (
            <>
              <div className="spec-pills">
                {Object.entries(JSON.parse(detail.specifications || "{}")).map(
                  ([k, v]) => (
                    <span key={k}>
                      {k}: {String(v)}
                    </span>
                  ),
                )}
              </div>
              <Tabs defaultValue="offers">
                <TabsList>
                  <TabsTrigger value="offers">Mağaza teklifleri</TabsTrigger>
                  <TabsTrigger value="history">Fiyat geçmişi</TabsTrigger>
                </TabsList>
                <TabsContent value="offers">
                  <div className="offer-table-wrap">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Mağaza / paket</TableHead>
                          <TableHead>Fiyat / birim</TableHead>
                          <TableHead>Stok / eşleşme</TableHead>
                          <TableHead>Güncellik</TableHead>
                          <TableHead />
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {data?.offers
                          .filter((o) => o.canonical_product_id === detail.id && !o.variant_conflict)
                          .sort((a, b) => a.unit_price - b.unit_price)
                          .map((o) => (
                            <TableRow key={o.id}>
                              <TableCell>
                                {o.image_url && <a href={o.product_url} target="_blank" rel="noreferrer"><img className="quote-photo" src={o.image_url} alt={o.title} loading="lazy" referrerPolicy="no-referrer"/></a>}
                                <strong>
                                  {storeMap.get(o.store_id)?.name}
                                </strong>
                                <small>
                                  {o.title}
                                </small>
                                <small>
                                  {o.package_quantity} adet / fiyat
                                  <small>
                                    Min.{" "}
                                    {o.minimum_order_quantity ||
                                      o.package_quantity}{" "}
                                    · {o.order_step || o.package_quantity}{" "}
                                    adetlik artış
                                  </small>
                                </small>
                              </TableCell>
                              <TableCell>
                                <strong>{money(o.price_gross)}</strong>
                                <small>{money(o.unit_price)} / adet</small>
                              </TableCell>
                              <TableCell>
                                <span
                                  className={
                                    o.stock_status === "in_stock"
                                      ? "stock-label"
                                      : "muted"
                                  }
                                >
                                  {o.stock_status === "in_stock"
                                    ? "Stokta"
                                    : o.stock_status === "out_of_stock"
                                      ? "Tükendi"
                                      : "Bilinmiyor"}
                                </span>
                                <small>
                                  %{o.match_confidence} ·{" "}
                                  {o.excluded ? 'Karşılaştırmadan çıkarıldı' : o.variant_conflict ? `${o.variant_conflict} · Sepet hesabına dahil değil` : o.name_match ? 'isim/model benzerliği' : o.match_type === "exact"
                                    ? "birebir"
                                    : o.match_type === "verified"
                                      ? "model doğrulandı"
                                      : o.match_type === "alternative"
                                        ? "alternatif"
                                        : "inceleme gerekli"}
                                </small>
                                {o.match_confidence < 70 && (
                                  <small className="warn">
                                    Ürün eşleşmesini kontrol edin.
                                  </small>
                                )}
                              </TableCell>
                              <TableCell>
                                <small>
                                  {o.source === "demo"
                                    ? "Demo veri"
                                    : timeAgo(o.last_checked_at)}
                                </small>
                                {o.source === "live" && (
                                  <small
                                    className={
                                      !isFresh(o) ? "warn" : "stock-label"
                                    }
                                  >
                                    {o.last_error
                                      ? "Son kontrol başarısız"
                                      : isFresh(o)
                                        ? o.snapshot_max_age_ms?"Kayıtlı fiyat · "+new Date(o.last_checked_at).toLocaleString('tr-TR'):"Güncel teklif"
                                        : `Son alınan fiyat · ${new Date(o.last_checked_at).toLocaleString('tr-TR')}`}
                                  </small>
                                )}
                                <small>
                                  Mağaza kargo ücreti: {money(storeMap.get(o.store_id)?.shipping_base_price || 0)}
                                  {storeMap.get(o.store_id)?.free_shipping_threshold != null && ` · ${money(storeMap.get(o.store_id)!.free_shipping_threshold!)} üzeri ücretsiz`}
                                </small>
                              </TableCell>
                              <TableCell>
                                {o.source === "live" && (
                                  <a
                                    href={o.product_url}
                                    target="_blank"
                                    rel="noreferrer"
                                    aria-label="Ürüne git"
                                  >
                                    <ExternalLink size={16} />
                                  </a>
                                )}
                                <Button variant="ghost" disabled={!editable || !!busy} aria-label={`${storeMap.get(o.store_id)?.name}: ${o.title} ${o.excluded?'teklifini geri al':'teklifini çıkar'}`} onClick={()=>void excludeOffer(detail.id,o.original_offer_id || o.id,!o.excluded)}>{o.excluded?'Geri al':'×'}</Button>
                              </TableCell>
                            </TableRow>
                          ))}
                      </TableBody>
                    </Table>
                  </div>
                  <p className="muted small">
                    Paket fiyatı en düşük teklif, tüm sepetin en ucuz çözümü
                    olmayabilir. Kargo için sepet optimizasyonunu kullan.
                  </p>
                </TabsContent>
                <TabsContent value="history">
                  <div className="history-controls">
                    <SelectBox
                      value={historyDays}
                      onChange={setHistoryDays}
                      options={["7", "30", "90"].map((v) => ({
                        value: v,
                        label: `Son ${v} gün`,
                      }))}
                    />
                  </div>
                  <PriceHistory
                    values={history.filter(
                      (h) =>
                        Date.now() - new Date(h.checked_at).getTime() <
                        Number(historyDays) * 86400000,
                    )}
                  />
                </TabsContent>
              </Tabs>
              <div className="detail-actions">
                <Button variant="outline" disabled={refreshing||!!busy} onClick={()=>void refreshPrices([detail.id],true,true)}><RefreshCw size={16}/> Fiyatları yenile</Button>
                <Button variant="outline" onClick={() => setModal("alert")}>
                  <Bell size={16} />
                  Takip ekle
                </Button>
                <Button
                  disabled={!canAdd || !!busy}
                  onClick={() => addProduct(detail)}
                >
                  <Plus size={16} />
                  Sepete ekle
                </Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </SidebarProvider>
  );
}
function UrlResult({ value }: { value: unknown }) {
  const r = value as {
    store?: string;
    status: string;
    message: string;
    product?: {
      name: string;
      mpn: string;
      price: number | null;
      warnings: string[];
    };
  };
  return (
    <div className="info-box">
      <strong>
        {r.store} ·{" "}
        {r.status === "needs_review" ? "İnceleme gerekiyor" : "Veri alınamadı"}
      </strong>
      <p>{r.message}</p>
      {r.product && (
        <>
          <p>
            {r.product.name} · {r.product.mpn}
          </p>
          <p>
            Okunan fiyat:{" "}
            {r.product.price === null ? "Bilinmiyor" : money(r.product.price)}
          </p>
          {r.product.warnings.map((w) => (
            <p key={w}>{w}</p>
          ))}
        </>
      )}
    </div>
  );
}
function PriceHistory({
  values,
}: {
  values: { price_gross: number; checked_at: string }[];
}) {
  if (!values.length)
    return (
      <div className="empty">
        <Clock3 />
        <p>Bu dönemde fiyat kaydı yok.</p>
      </div>
    );
  const vals = values.map((v) => v.price_gross),
    min = Math.min(...vals),
    max = Math.max(...vals);
  return (
    <div className="history-view">
      <div className="history-stats">
        {[
          ["En düşük", min],
          ["En yüksek", max],
          [
            "Ortalama",
            Math.round(vals.reduce((a, b) => a + b, 0) / vals.length),
          ],
        ].map(([l, v]) => (
          <div key={l}>
            <span>{l}</span>
            <strong>{money(Number(v))}</strong>
          </div>
        ))}
      </div>
      <p className="muted">
        {new Set(values.map((v) => v.checked_at)).size < 2
          ? "Henüz zaman serisi oluşmadı. Yeni gerçek fiyat kontrolleri geldikçe grafik burada oluşacak."
          : "Kayıtlar mağazaların paket fiyatlarını gösterir."}
      </p>
      <div className="history-records">
        {values.slice(-15).map((v, i) => (
          <div className="split-line" key={i}>
            <small>{new Date(v.checked_at).toLocaleString("tr-TR")}</small>
            <strong>{money(v.price_gross)}</strong>
          </div>
        ))}
      </div>
    </div>
  );
}
function CartComparison({
  ids,
  products,
}: {
  ids: string[];
  products: Map<string, Product>;
}) {
  const [carts, setCarts] = useState<CartView[]>([]),
    [results, setResults] = useState<Optimization[]>([]),
    [error, setError] = useState("");
  useEffect(() => {
    Promise.all(ids.map((id) => api<CartView>(`carts/${id}`)))
      .then(setCarts)
      .catch((e) => setError(e.message));
    Promise.all(
      ids.map((id) => api<Optimization>(`carts/${id}/optimize`, "POST", {})),
    )
      .then(setResults)
      .catch((e) => setError(e.message));
  }, [ids.join(",")]);
  return (
    <div>
      {error && <p className="error-box">{error}</p>}
      <div className="two-fields">
        {carts.map((c, i) => (
          <div className="compare-card" key={c.id}>
            <h3>{c.name}</h3>
            <strong>
              {results[i]?.scenarios.at(-1)
                ? money(results[i].scenarios.at(-1)!.total)
                : "Hesaplanıyor…"}
            </strong>
            <p>
              {c.items.length} kalem ·{" "}
              {results[i]?.scenarios.at(-1)?.storeCount || "–"} mağaza
            </p>
            {c.items.map((item) => (
              <div key={item.id}>
                {products.get(item.canonical_product_id)?.name} ×{item.quantity}
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
function StorePanel({
  stores,
  admin,
  onChange,
}: {
  stores: Store[];
  admin: boolean;
  onChange: () => void;
}) {
  const [health, setHealth] = useState<{
    health: {
      store_id: string;
      success: number;
      message: string;
      checked_at: string;
    }[];
  }>({ health: [] });
  useEffect(() => {
    void api<typeof health>("health").then(setHealth);
  }, []);
  return (
    <div className="surface stores-panel">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Mağaza</TableHead>
            <TableHead>Entegrasyon durumu</TableHead>
            <TableHead>Tahmini kargo</TableHead>
            <TableHead>Ücretsiz kargo</TableHead>
            <TableHead>Son başarılı kontrol</TableHead>
            {admin && <TableHead>Düzenle</TableHead>}
          </TableRow>
        </TableHeader>
        <TableBody>
          {stores.map((s) => (
            <TableRow key={s.id}>
              <TableCell>
                <div className="store-cell">
                  <span
                    className="store-avatar"
                    style={{ color: s.color, background: s.color + "18" }}
                  >
                    {s.name[0]}
                  </span>
                  <div>
                    <strong>{s.name}</strong>
                    <small>{s.domain}</small>
                  </div>
                </div>
              </TableCell>
              <TableCell>
                <span className="pending-label">
                  {s.status === "manual_review"
                    ? "URL okunabilir · inceleme gerekli"
                    : "Entegrasyon bekliyor"}
                </span>
                <small>Manuel URL kullanılabilir</small>
              </TableCell>
              <TableCell>
                {s.shipping_known === false
                  ? "Ödeme ekranında"
                  : money(s.shipping_base_price)}
              </TableCell>
              <TableCell>
                {s.free_shipping_threshold === null
                  ? "Tanımlanmadı"
                  : money(s.free_shipping_threshold)}
              </TableCell>
              <TableCell>
                {s.last_successful_sync
                  ? timeAgo(s.last_successful_sync)
                  : "Henüz yok"}
                <small>
                  {
                    health.health.filter(
                      (h) => h.store_id === s.id && h.success === 0,
                    ).length
                  }{" "}
                  başarısız kontrol
                </small>
              </TableCell>
              {admin && (
                <TableCell>
                  <StoreEdit store={s} onChange={onChange} />
                </TableCell>
              )}
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <div className="info-box">
        Otomatik fiyat güncelleme henüz doğrulanmayan mağazalar listede kalır.
        Kamuya açık ürün URL’leri analiz edilebilir; başarısız erişimler eski
        fiyatların üzerine yazılmaz.
      </div>
    </div>
  );
}
function StoreEdit({
  store,
  onChange,
}: {
  store: Store;
  onChange: () => void;
}) {
  const [open, setOpen] = useState(false),
    [shipping, setShipping] = useState(String(store.shipping_base_price / 100)),
    [threshold, setThreshold] = useState(
      store.free_shipping_threshold === null
        ? ""
        : String(store.free_shipping_threshold / 100),
    ),
    [enabled, setEnabled] = useState(Boolean(store.enabled));
  return (
    <>
      <Button variant="outline" onClick={() => setOpen(true)}>
        Düzenle
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{store.name}</DialogTitle>
            <DialogDescription>
              Kargo fiyatları karşılaştırmaya doğrudan yansır.
            </DialogDescription>
          </DialogHeader>
          <Field label="Kargo (₺)">
            <input
              type="number"
              value={shipping}
              onChange={(e) => setShipping(e.target.value)}
            />
          </Field>
          <Field label="Ücretsiz kargo sınırı (₺)">
            <input
              type="number"
              value={threshold}
              onChange={(e) => setThreshold(e.target.value)}
            />
          </Field>
          <Choice checked={enabled} onChange={setEnabled}>
            Mağaza etkin
          </Choice>
          <Button
            onClick={() =>
              void api("admin/store", "PATCH", {
                id: store.id,
                shipping_base_price: Math.round(Number(shipping) * 100),
                free_shipping_threshold: threshold
                  ? Math.round(Number(threshold) * 100)
                  : null,
                enabled: Number(enabled),
              })
                .then(() => {
                  onChange();
                  setOpen(false);
                  toast.success("Mağaza güncellendi.");
                })
                .catch((e) => toast.error(e.message))
            }
          >
            Kaydet
          </Button>
        </DialogContent>
      </Dialog>
    </>
  );
}
