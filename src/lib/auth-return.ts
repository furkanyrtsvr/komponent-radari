export function safeAuthReturn(value:string|null){
 if(!value?.startsWith('/')||value.startsWith('//'))return '/';
 try{const u=new URL(value,'https://site.local');return u.origin==='https://site.local'&&!/^\/(?:auth\/complete|signin-with-chatgpt|signout-with-chatgpt|callback)(?:\/|$)/.test(u.pathname)?u.pathname+u.search+u.hash:'/';}catch{return '/';}
}
export function chatgptLoginHref(returnTo='/'){
 const complete='/auth/complete?provider=chatgpt&return_to='+encodeURIComponent(safeAuthReturn(returnTo));
 return '/signin-with-chatgpt?return_to='+encodeURIComponent(complete);
}
