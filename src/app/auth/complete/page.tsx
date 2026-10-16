'use client';
import {useEffect,useState} from 'react';
import {configureAuth,authClient} from '@/lib/client';
export default function Complete(){const[error,setError]=useState('');useEffect(()=>{void configureAuth().then(async()=>{const client=authClient();if(!client)throw new Error('Supabase bağlantısı yapılandırılmadı.');const {data,error}=await client.auth.getSession();if(error)throw error;if(!data.session)throw new Error('Giriş tamamlanamadı. Bağlantıyı yeniden açın.');location.replace('/');}).catch(e=>setError(e.message));},[]);return <main className="loading-state"><h1>{error?'Giriş tamamlanamadı':'Hesabın açılıyor…'}</h1><p>{error}</p>{error&&<a href="/">Çalışma alanına dön</a>}</main>;}
