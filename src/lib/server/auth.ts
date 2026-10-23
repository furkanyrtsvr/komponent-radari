import { cookies } from "next/headers";
import {getChatGPTUser} from "../../app/chatgpt-auth";
import {accountId} from "../account";
import {adminIdentity} from '../admin-identity';
import {
  config,
  one,
  insert,
  supabase,
  isSupabase,
  guestAllowed,
  HttpError,
  binding,
  remove,
  update,
} from "./db";
import { id, now } from "../domain";
export type User = {
  id: string;
  display_name: string;
  email: string;
  created_at: string;
  verified_email?: string;
};
export async function user(request: Request): Promise<User> {
  const platform=await getChatGPTUser();
  if(platform){
    const uid=await accountId(platform.userId);
    let account=await one<User>("users",{id:uid});
    if(!account){
      account={id:uid,display_name:(platform.fullName || platform.email.split("@")[0]).slice(0,80),email:platform.email,created_at:now()};
      await insert("users",account,true);
    }
    const token=(await cookies()).get("eub_session")?.value;
    if(token){
      const session=await one<{user_id:string;expires_at:string}>("sessions",{id:token});
      const guest=session && session.expires_at>now() ? await one<User>("users",{id:session.user_id}) : undefined;
      if(guest && !guest.email && guest.id!==uid)await claimGuest(guest.id,uid);
      await remove("sessions",{id:token});
      (await cookies()).delete("eub_session");
    }
    return {...account,verified_email:platform.email};
  }
  const bearer = request.headers.get("authorization")?.replace(/^Bearer /, "");
  if (bearer && isSupabase()) {
    const { data, error } = await supabase().auth.getUser(bearer);
    if (error || !data.user) throw new HttpError(401, "Oturum geçersiz.");
    const u = {
      id: data.user.id,
      display_name: String(
        data.user.user_metadata.full_name ||
          data.user.email?.split("@")[0] ||
          "Kullanıcı",
      ).slice(0, 80),
      email: data.user.email || "",
      created_at: now(),
    };
    await insert("users", u, true);
    return {...u,verified_email:data.user.email_confirmed_at?data.user.email:undefined};
  }
  const jar = await cookies();
  const token = jar.get("eub_session")?.value;
  if (token) {
    const s = await one<{ user_id: string; expires_at: string }>("sessions", {
      id: token,
    });
    if (s && s.expires_at > now()) {
      const u = await one<User>("users", { id: s.user_id });
      if (u && (guestAllowed() || u.email)) return u;
    }
  }
  if (!guestAllowed())
    throw new HttpError(401, "Devam etmek için giriş yapın.");
  const u = {
    id: id(),
    display_name: "Misafir mühendis",
    email: "",
    created_at: now(),
  };
  await insert("users", u);
  const session = id() + id();
  await insert("sessions", {
    id: session,
    user_id: u.id,
    expires_at: new Date(Date.now() + 30 * 86400000).toISOString(),
  });
  jar.set("eub_session", session, {
    httpOnly: true,
    secure: new URL(request.url).protocol === "https:",
    sameSite: "lax",
    path: "/",
    maxAge: 30 * 86400,
  });
  return u;
}
async function claimGuest(guestId:string,userId:string){
  if(isSupabase()){
    const {error}=await supabase().rpc("eub_claim_guest",{p_guest:guestId,p_user:userId});
    if(error)throw error;
    await update('feedback_reports',{user_id:userId},{user_id:guestId});
    await update('feedback_messages',{author_id:userId},{author_id:guestId});
    return;
  }
  const db=binding();
  const feedbackTables=await db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name IN ('feedback_reports','feedback_messages')").all<{name:string}>();
  const feedbackStatements=feedbackTables.results.length===2?[
    db.prepare('UPDATE feedback_reports SET user_id=? WHERE user_id=?').bind(userId,guestId),
    db.prepare('UPDATE feedback_messages SET author_id=? WHERE author_id=?').bind(userId,guestId),
  ]:[];
  await db.batch([
    ...feedbackStatements,
    db.prepare("UPDATE cart_members SET role=CASE WHEN role='owner' THEN role WHEN EXISTS(SELECT 1 FROM cart_members g WHERE g.cart_id=cart_members.cart_id AND g.user_id=? AND g.role='owner') THEN 'owner' WHEN role='editor' THEN role WHEN EXISTS(SELECT 1 FROM cart_members g WHERE g.cart_id=cart_members.cart_id AND g.user_id=? AND g.role='editor') THEN 'editor' WHEN role='contributor' THEN role WHEN EXISTS(SELECT 1 FROM cart_members g WHERE g.cart_id=cart_members.cart_id AND g.user_id=? AND g.role='contributor') THEN 'contributor' ELSE role END WHERE user_id=?").bind(guestId,guestId,guestId,userId),
    db.prepare("DELETE FROM cart_members WHERE user_id=? AND cart_id IN(SELECT cart_id FROM cart_members WHERE user_id=?)").bind(guestId,userId),
    db.prepare("UPDATE cart_members SET user_id=? WHERE user_id=?").bind(userId,guestId),
    db.prepare("UPDATE carts SET owner_id=?,updated_at=? WHERE owner_id=?").bind(userId,now(),guestId),
    db.prepare("UPDATE cart_items SET added_by=? WHERE added_by=?").bind(userId,guestId),
    db.prepare("DELETE FROM favorites WHERE user_id=? AND canonical_product_id IN(SELECT canonical_product_id FROM favorites WHERE user_id=?)").bind(guestId,userId),
    db.prepare("UPDATE favorites SET user_id=? WHERE user_id=?").bind(userId,guestId),
    db.prepare("DELETE FROM price_alerts WHERE user_id=? AND canonical_product_id IN(SELECT canonical_product_id FROM price_alerts WHERE user_id=?)").bind(guestId,userId),
    db.prepare("DELETE FROM stock_alerts WHERE user_id=? AND canonical_product_id IN(SELECT canonical_product_id FROM stock_alerts WHERE user_id=?)").bind(guestId,userId),
    db.prepare("UPDATE price_alerts SET user_id=? WHERE user_id=?").bind(userId,guestId),
    db.prepare("UPDATE stock_alerts SET user_id=? WHERE user_id=?").bind(userId,guestId),
    db.prepare("DELETE FROM sessions WHERE user_id=?").bind(guestId),
  ]);
}
export function requireAdmin(u: User) {
  if (!isAdmin(u))
    throw new HttpError(403, "Bu işlem yönetici hesabı gerektirir.");
}
export function isAdmin(u: User) {
  return adminIdentity(u,config('ADMIN_USER_IDS'),config('ADMIN_USER_EMAILS'));
}
export function checkOrigin(request: Request) {
  if (request.method === "GET") return;
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin)
    throw new HttpError(403, "İstek kaynağı doğrulanamadı.");
}
