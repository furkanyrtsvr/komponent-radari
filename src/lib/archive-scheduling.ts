export function initialArchiveHasPriority(job:{state:string}|null|undefined){return job?.state==='queued'||job?.state==='running';}
export function archiveWaitMessage(job:{state:string;stage:string;updatedAt:string},at=Date.now()){
 if(job.state==='queued'){const minutes=Math.max(0,Math.floor((at-Date.parse(job.updatedAt))/60000))||0;return `İlk tarama şu anda çalışmıyor. ${minutes} dakikadır sırada; denenen bağlantı sayısı yeni tur başlayınca artar.`;}
 if(job.state==='running'&&job.stage==='images')return 'Bu aşamada görseller hazırlanıyor; denenen bağlantı sayısı sabit kalabilir.';
 return '';
}
