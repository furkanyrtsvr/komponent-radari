/** Public display preference advertised by Ozdisan's anonymous Set-Cookie response.
 * No account, authentication, tracking or visitor cookies are forwarded. */
export function merchantDisplayPreferences(domain:string):Record<string,string>{
 if(domain.toLowerCase().replace(/^www\./,'')!=='ozdisan.com')return {};
 return {Cookie:'user-settings='+encodeURIComponent(JSON.stringify({languageCode:'tr',currencyCode:'TRY',countryCode:'TR',timestamp:Date.now(),isAuthenticated:false}))};
}
