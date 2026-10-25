import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import {requestError,startupReader} from "./startup";
let auth: SupabaseClient | null = null;
export class ApiError extends Error{constructor(message:string,public status:number){super(message);this.name='ApiError';}}
type PublicConfig={
    supabaseUrl: string;
    supabaseAnonKey: string;
    googleConfigured: boolean;
    demo: boolean;
  };
const readConfig=startupReader(async signal=>{
  const r=await fetch('/api/config',{signal,cache:'no-store'});
  if(!r.ok)throw new ApiError('Uygulama ayarları alınamadı.',r.status);
  return await r.json() as PublicConfig;
});
export async function configureAuth(onRetry?:()=>void) {
  const c=await readConfig(onRetry);
  if (c.supabaseUrl && c.supabaseAnonKey && !auth)
    auth = createClient(c.supabaseUrl, c.supabaseAnonKey, {
      auth: { flowType: "pkce", detectSessionInUrl: true },
    });
  return c;
}
export const authClient = () => auth;
export async function downloadApiFile(path:string){
  const token=auth?(await auth.auth.getSession()).data.session?.access_token:undefined;
  const response=await fetch(`/api/${path}`,{signal:AbortSignal.timeout(120000),cache:'no-store',headers:token?{Authorization:`Bearer ${token}`}:{}}).catch(error=>{throw requestError(error);});
  if(!response.ok){const data=await response.json().catch(()=>({error:'Dosya indirilemedi.'})) as {error?:string};throw new ApiError(data.error||'Dosya indirilemedi.',response.status);}
  return response.blob();
}
export async function api<T>(
  path: string,
  method = "GET",
  body?: unknown,
  signal?:AbortSignal,
): Promise<T> {
  const token = auth
    ? (await auth.auth.getSession()).data.session?.access_token
    : undefined;
  const timeout=path.endsWith("/optimize") || path==="url" || path==="catalog/import" ? 60000 : 30000;
  const r = await fetch(`/api/${path}`, {
    method,
    cache:'no-store',
    credentials:'same-origin',
    signal:signal ? AbortSignal.any([signal,AbortSignal.timeout(timeout)]) : AbortSignal.timeout(timeout),
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  }).catch(error=>{throw requestError(error);});
  const data = (await r.json()) as {
    error?: string;
    unmatched?: { mpn: string }[];
  };
  if (!r.ok) {
    const e = new ApiError(
      data.error ||
        (data.unmatched
          ? `Eşleşmeyen MPN: ${data.unmatched.map((x) => x.mpn).join(", ")}. Hiçbir satır eklenmedi.`
          : "İşlem tamamlanamadı."),r.status,
    );
    throw e;
  }
  return data as T;
}
