import {chatgptLoginHref} from './auth-return';
type Store=Pick<Storage,'getItem'|'setItem'|'removeItem'>;
const remembered='kr-returning-chatgpt-account',attempt='kr-account-restore-at';
export function hasRememberedAccount(local:Store){try{return local.getItem(remembered)==='1';}catch{return false;}}
/** This marker is a preference, never proof of identity or an authorization. */
export function rememberVerifiedAccount(local?:Store){try{(local||window.localStorage).setItem(remembered,'1');}catch{}}
export function forgetRememberedAccount(local?:Store,session?:Store){try{(local||window.localStorage).removeItem(remembered);}catch{}try{(session||window.sessionStorage).removeItem(attempt);}catch{}}
export function returningAccountRedirect(local:Store,session:Store,authenticated:boolean,returnTo:string,at=Date.now()){
 if(authenticated||!hasRememberedAccount(local))return null;
 try{const previous=Number(session.getItem(attempt));if(previous>0&&at-previous<120000)return null;session.setItem(attempt,String(at));return chatgptLoginHref(returnTo);}catch{return null;}
}
