'use client';
import {useEffect,useState} from 'react';
export function PricePhase(){
 const [phase,setPhase]=useState('A'),[busy,setBusy]=useState(false),[status,setStatus]=useState('');
 useEffect(()=>{fetch('/api/price-phase').then(r=>r.json()).then(value=>{const s=value as {phase:string;fresh:number;lastCheckedAt:string|null};setPhase(s.phase);setStatus(`${s.fresh} güncel kayıt · Son kontrol: ${s.lastCheckedAt?new Date(s.lastCheckedAt).toLocaleString('tr-TR'):'henüz yok'}`);}).catch(()=>setStatus('Fiyat arşivi durumu alınamadı.'));},[]);
 return <div style={{display:'flex',flexWrap:'wrap',alignItems:'center',gap:12,marginBottom:16}}><label className="mode-switch" style={{gap:8}}><span>Fiyat kaynağı</span><select aria-label="Fiyat kaynağı" value={phase} disabled={busy} onChange={async e=>{setBusy(true);try{const r=await fetch('/api/price-phase',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({phase:e.target.value})});if(!r.ok)throw new Error();location.reload();}catch{setStatus('Aşama değiştirilemedi. Yeniden deneyin.');setBusy(false);}}}><option value="A">A · Canlı okuma</option><option value="B">B · Hızlı fiyat arşivi (12 saat)</option></select></label><small role="status">Arşiv: {status}{phase==='B'?' · Fiyatlar kayıtlı kontrol zamanına aittir.':''}</small></div>;
}
