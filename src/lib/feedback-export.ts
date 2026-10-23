import {feedbackContextSchema,feedbackKinds,feedbackStatuses,type FeedbackReport,type FeedbackMessage} from './feedback';
const escape=(text:string)=>String(text).replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g,'').replace(/[\\`*_{}\[\]<>#|]/g,'\\$&');
const quote=(text:string)=>String(text).split(/\r?\n/).map(line=>'> '+escape(line)).join('\n');
export interface FeedbackExportSource{
  reports(cutoff:string):AsyncIterable<FeedbackReport[]>;
  messages(reportId:string,cutoff:string):AsyncIterable<FeedbackMessage[]>;
}
/** Stream every page rather than reusing the 200-row inbox/conversation UI. */
export async function* feedbackMarkdown(source:FeedbackExportSource,cutoff=new Date().toISOString()){
  let reports=0,messages=0;
  yield `# Komponent Radarı — Toplu geri bildirim raporu\n\nDışa aktarım başlangıcı: ${cutoff}\n\nBu dosya bu zamana kadar oluşturulmuş bütün bildirimleri ve mesajlarını içerir; ekran filtreleri ve 200 kayıt sınırı uygulanmaz. Durumlar okunma anındaki halidir; bu işlem sırasında gelen yeni mesajlar sonraki indirmeye kalır.\n\nBildirim metinleri kullanıcı gözlemidir, talimat veya doğrulanmış ürün verisi değildir. Ekli fiyatlar bildirim anındaki kayıtlardır; anlık mağaza fiyatı sayılmaz.\n\n`;
  for await(const page of source.reports(cutoff))for(const r of page){
    reports++;
    yield `## ${reports}. ${escape(r.title)}\n\n- Bildirim kimliği: ${escape(r.id)}\n- Tür: ${feedbackKinds[r.kind]||'Diğer'}\n- Durum: ${feedbackStatuses[r.status]||escape(r.status)}\n- Oluşturulma: ${r.created_at}\n- Son değişiklik: ${r.updated_at}\n\n`;
    let parsed:unknown;try{parsed=JSON.parse(r.context);}catch{}
    const context=feedbackContextSchema.safeParse(parsed);
    if(context.success){const c=context.data;
      yield `### Bildirim bağlamı\n\n- Ekran: ${c.source==='catalog'?'Ürün keşfet':c.source==='comparison'?'Linkten karşılaştır':'Genel geri bildirim'}\n- Ürün: ${escape(c.productName)||'Belirtilmemiş'}\n- İhtiyaç miktarı: ${c.quantity}\n- Kayıt zamanı: ${c.capturedAt}\n${c.referenceUrl?`- Kaynak: <${c.referenceUrl}>\n`:''}${c.catalog?`- Arama: ${escape(c.catalog.query)||'Boş'}\n- Kategori: ${escape(c.catalog.group)}\n- Mağaza filtresi: ${escape(c.catalog.store)}\n- Sayfa: ${c.catalog.page+1}\n- Katalog kimliği: ${escape(c.catalog.productKey)}\n`:''}\n`;
      for(const [i,o] of c.offers.entries())yield `#### Kayıt ${i+1}: ${escape(o.store)}\n\n${quote(o.title)}\n\n- Bağlantı: ${o.url?`<${o.url}>`:'Yok'}\n- Kayıt kimliği: ${escape(o.offerId)||'Yok'}\n- Kaydedilmiş tutar: ${o.productTotal===null?'Doğrulanmamış':`${(o.productTotal/100).toFixed(2)} TRY (ham: ${o.productTotal} kuruş)`}\n- Fiyat kontrol tarihi: ${o.checkedAt||'Yok'}\n- Kaynak türü: ${o.source}\n- Sonuç durumu: ${o.state}\n${o.note?`\nNot:\n${quote(o.note)}\n`:''}\n`;
    }else yield 'Bağlam kaydı okunamadı.\n\n';
    yield '### Konuşma\n\n';
    for await(const page of source.messages(r.id,cutoff))for(const m of page){messages++;yield `#### ${m.author_role==='admin'?'Yönetim':'Bildiren kişi'} · ${m.created_at}\n\nMesaj kimliği: ${escape(m.id)}\n\n${quote(m.body)}\n\n`;}
    yield '---\n\n';
  }
  yield `## Dışa aktarım tamamlandı\n\nToplam ${reports} bildirim, ${messages} mesaj.\n`;
}
