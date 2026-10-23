// Email authorization only consumes a current identity-provider verification,
// never a profile field, browser request body, or guest-entered email.
export function adminIdentity(user:{id:string;verified_email?:string},ids:string,emails:string){
  return ids.split(',').map(s=>s.trim()).filter(Boolean).includes(user.id)||Boolean(user.verified_email&&emails.split(',').map(s=>s.trim().toLowerCase()).filter(Boolean).includes(user.verified_email.trim().toLowerCase()));
}
