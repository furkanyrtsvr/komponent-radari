import { env } from "cloudflare:workers";
import { createClient } from "@supabase/supabase-js";
import * as schema from "../../db/schema";
import { getTableName } from "drizzle-orm";
type Row = Record<string, string | number | null>;
const tables = new Set<string>(
  Object.values(schema).map((t) => getTableName(t)),
);
export const config = (key: string): string =>
  String(
    (env as unknown as Record<string, unknown>)[key] ?? process.env[key] ?? "",
  );
export const isSupabase = () =>
  Boolean(config("SUPABASE_URL") && config("SUPABASE_SERVICE_ROLE_KEY"));
export const guestAllowed = () => config("REQUIRE_LOGIN") !== "true";
export function supabase() {
  return createClient(
    config("SUPABASE_URL"),
    config("SUPABASE_SERVICE_ROLE_KEY"),
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}
export function binding(): D1Database {
  const db = (env as unknown as { DB?: D1Database }).DB;
  if (!db) throw new Error("Veritabanı bağlantısı kullanılamıyor.");
  return db;
}
function check(table: string, fields: string[] = []) {
  if (!tables.has(table) || fields.some((x) => !/^\w+$/.test(x)))
    throw new Error("Geçersiz sorgu");
}
export async function list<T>(
  table: string,
  where: Record<string, string | number> = {},
  limit = 1000,
): Promise<T[]> {
  check(table, Object.keys(where));
  if (isSupabase()) {
    let q = supabase().from(table).select("*").limit(limit);
    for (const [k, v] of Object.entries(where)) q = q.eq(k, v);
    const r = await q;
    if (r.error) throw r.error;
    return r.data as T[];
  }
  const entries = Object.entries(where);
  return (
    await binding()
      .prepare(
        `SELECT * FROM ${table}${entries.length ? " WHERE " + entries.map(([k]) => `${k}=?`).join(" AND ") : ""} LIMIT ?`,
      )
      .bind(...entries.map(([, v]) => v), limit)
      .all<T>()
  ).results;
}
export async function one<T>(
  table: string,
  where: Record<string, string | number>,
): Promise<T | undefined> {
  return (await list<T>(table, where, 1))[0];
}
export async function recent<T>(table:string,timeField:string,where:Record<string,string|number>={},limit=100){
  check(table,[timeField,...Object.keys(where)]);
  if(isSupabase()){
    let query=supabase().from(table).select("*").order(timeField,{ascending:false}).limit(limit);
    for(const [key,value] of Object.entries(where))query=query.eq(key,value);
    const {data,error}=await query;if(error)throw error;
    return data as T[];
  }
  const entries=Object.entries(where);
  return (await binding().prepare(`SELECT * FROM ${table}${entries.length?" WHERE "+entries.map(([key])=>`${key}=?`).join(" AND "):""} ORDER BY ${timeField} DESC LIMIT ?`).bind(...entries.map(([,value])=>value),limit).all<T>()).results;
}
/** Keyset pagination keeps imported catalogs and scoped offers independent of
 * the default list limit. Each page has a deterministic, unique cursor. */
export async function* pages<T>(
  table: string,
  where: Record<string, string | number> = {},
  field?: string,
  values?: (string | number)[],
): AsyncGenerator<T[]> {
  check(table, [...Object.keys(where), ...(field ? [field] : [])]);
  if (field && !values?.length) return;
  let cursor = "";
  const size = 500;
  while (true) {
    let rows: (T & {id:string})[];
    if (isSupabase()) {
      let query = supabase().from(table).select("*").order("id").limit(size);
      for (const [key,value] of Object.entries(where)) query = query.eq(key,value);
      if (field) query = query.in(field,values!);
      if (cursor) query = query.gt("id",cursor);
      const result = await query;
      if (result.error) throw result.error;
      rows = result.data as (T & {id:string})[];
    } else {
      const entries = Object.entries(where);
      const filters = entries.map(([key]) => `${key}=?`);
      const params: (string | number)[] = entries.map(([,value]) => value);
      if (field) {
        filters.push(`${field} IN (${values!.map(() => "?").join(",")})`);
        params.push(...values!);
      }
      if (cursor) { filters.push("id>?"); params.push(cursor); }
      rows = (await binding().prepare(`SELECT * FROM ${table}${filters.length ? " WHERE " + filters.join(" AND ") : ""} ORDER BY id LIMIT ?`).bind(...params,size).all<T & {id:string}>()).results;
    }
    if (!rows.length) return;
    yield rows;
    cursor = rows.at(-1)!.id;
    if (rows.length < size) return;
  }
}
export async function listIn<T>(table:string, field:string, values:(string|number)[], where:Record<string,string|number>={}) {
  const rows:T[]=[];
  const unique=[...new Set(values)];
  // D1 limits bound parameters; preserve room for filters and pagination.
  for(let offset=0;offset<unique.length;offset+=60)
    for await(const page of pages<T>(table,where,field,unique.slice(offset,offset+60))) rows.push(...page);
  return rows;
}
export async function insert(table: string, row: object, ignore = false) {
  check(table, Object.keys(row));
  if (isSupabase()) {
    const r = ignore
      ? await supabase()
          .from(table)
          .upsert(row, { onConflict: "id", ignoreDuplicates: true })
      : await supabase().from(table).insert(row);
    if (r.error) throw r.error;
    return;
  }
  const vals = Object.entries(row);
  await binding()
    .prepare(
      `INSERT ${ignore ? "OR IGNORE " : ""}INTO ${table} (${vals.map(([k]) => k).join(",")}) VALUES (${vals.map(() => "?").join(",")})`,
    )
    .bind(...vals.map(([, v]) => v))
    .run();
}
export async function insertBatch(entries: { table: string; row: object }[]) {
  if (!entries.length) return;
  if (isSupabase()) {
    const { error } = await supabase().rpc("eub_insert_batch", { entries });
    if (error) throw error;
    return;
  }
  const stmts = entries.map(({ table, row }) => {
    check(table, Object.keys(row));
    const vals = Object.entries(row);
    return binding()
      .prepare(
        `INSERT INTO ${table} (${vals.map(([k]) => k).join(",")}) VALUES (${vals.map(() => "?").join(",")})`,
      )
      .bind(...vals.map(([, v]) => v));
  });
  for (let i = 0; i < stmts.length; i += 80)
    await binding().batch(stmts.slice(i, i + 80));
}
/** Idempotent initialization, in parent-before-child order. Existing rows,
 * including merchant prices and user settings, are never overwritten. */
export async function insertIgnoreBatch(entries: { table: string; row: object }[]) {
  for (const {table,row} of entries) check(table,Object.keys(row));
  if (isSupabase()) {
    const client=supabase();
    for(let i=0;i<entries.length;){
      const table=entries[i].table,rows:object[]=[];
      while(i<entries.length && entries[i].table===table && rows.length<80)
        rows.push(entries[i++].row);
      const {error}=await client.from(table).upsert(rows,{onConflict:"id",ignoreDuplicates:true});
      if(error)throw error;
    }
    return;
  }
  const db=binding();
  for(let i=0;i<entries.length;i+=80){
    const statements=entries.slice(i,i+80).map(({table,row})=>{
      const values=Object.entries(row);
      return db.prepare(`INSERT OR IGNORE INTO ${table} (${values.map(([key])=>key).join(",")}) VALUES (${values.map(()=>"?").join(",")})`).bind(...values.map(([,value])=>value));
    });
    await db.batch(statements);
  }
}
export async function update(
  table: string,
  values: Row,
  where: Record<string, string | number>,
) {
  check(table, [...Object.keys(values), ...Object.keys(where)]);
  if (!Object.keys(where).length) throw new Error("Filtre gerekli");
  if (isSupabase()) {
    let q = supabase().from(table).update(values);
    for (const [k, v] of Object.entries(where)) q = q.eq(k, v);
    const r = await q;
    if (r.error) throw r.error;
    return;
  }
  await binding()
    .prepare(
      `UPDATE ${table} SET ${Object.keys(values)
        .map((k) => `${k}=?`)
        .join(",")} WHERE ${Object.keys(where)
        .map((k) => `${k}=?`)
        .join(" AND ")}`,
    )
    .bind(...Object.values(values), ...Object.values(where))
    .run();
}
export async function remove(
  table: string,
  where: Record<string, string | number>,
) {
  check(table, Object.keys(where));
  if (!Object.keys(where).length) throw new Error("Filtre gerekli");
  if (isSupabase()) {
    let q = supabase().from(table).delete();
    for (const [k, v] of Object.entries(where)) q = q.eq(k, v);
    const r = await q;
    if (r.error) throw r.error;
    return;
  }
  await binding()
    .prepare(
      `DELETE FROM ${table} WHERE ${Object.keys(where)
        .map((k) => `${k}=?`)
        .join(" AND ")}`,
    )
    .bind(...Object.values(where))
    .run();
}
export async function rateLimit(key: string, limit = 60, window = 60) {
  const bucket = Math.floor(Date.now() / 1000 / window),
    id = `${key}:${bucket}`;
  let count: number;
  if (isSupabase()) {
    const r = await supabase().rpc("eub_rate_limit", {
      bucket_id: id,
      expires: Date.now() + window * 2000,
    });
    if (r.error) throw r.error;
    count = r.data;
  } else {
    const r = await binding()
      .prepare(
        "INSERT INTO rate_limits (id,count,expires_at) VALUES (?,1,?) ON CONFLICT(id) DO UPDATE SET count=count+1 RETURNING count",
      )
      .bind(id, Date.now() + window * 2000)
      .first<{ count: number }>();
    count = r!.count;
  }
  if (count > limit)
    throw new HttpError(
      429,
      "Çok sık istek gönderildi. Biraz sonra yeniden deneyin.",
    );
}
export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
