'use client';
import {useEffect,useState} from 'react';
import {rememberVerifiedAccount} from '@/lib/returning-account';
import {configureAuth,authClient,api} from '@/lib/client';
import {chatgptLoginHref,safeAuthReturn} from '@/lib/auth-return';
export default function Complete(){
 const[error,setError]=useState(''),[returnTo,setReturnTo]=useState('/');
 useEffect(()=>{
  let active=true;const params=new URLSearchParams(location.search),target=safeAuthReturn(params.get('return_to'));setReturnTo(target);
  void(async()=>{
   if(params.get('provider')==='chatgpt'){
    const identity=await api<{authenticated:boolean}>('auth/session');
    if(!identity.authenticated)throw new Error('ChatGPT girişinden dönüldü ancak siteye doğrulanmış oturum ulaşmadı. Siteyi Chrome veya Edge’de açıp aynı ChatGPT hesabıyla yeniden giriş yap. Misafir sepetin korunuyor.');
    const account=await api<{authenticated:boolean}>('auth/session','POST',{});
    if(!account.authenticated)throw new Error('Hesap doğrulanamadı. Misafir sepetin korunuyor; yeniden giriş yap.');
    rememberVerifiedAccount();
   }else{
    await configureAuth();const client=authClient();if(!client)throw new Error('Bu bağlantıyla giriş doğrulanamadı. ChatGPT ile yeniden giriş yap.');
    const {data,error}=await client.auth.getSession();if(error)throw error;if(!data.session)throw new Error('Giriş tamamlanamadı. Yeniden giriş yap.');
   }
   if(active)location.replace(target);
  })().catch(e=>{if(active)setError(e instanceof Error?e.message:'Giriş tamamlanamadı. Yeniden dene.');});
  return()=>{active=false;};
 },[]);
 return <main className="loading-state"><h1>{error?'Giriş tamamlanamadı':'Hesabın doğrulanıyor…'}</h1><p role={error?'alert':undefined}>{error||'Oturumun ve misafir sepetinin aktarımı kontrol ediliyor.'}</p>{error&&<><a className="account-login" href={chatgptLoginHref(returnTo)} target="_top">ChatGPT ile yeniden giriş yap</a><a href={returnTo}>Çalışma alanına dön</a></>}</main>;
}
