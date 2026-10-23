import {binding,isSupabase,supabase} from './db';
import {requireAdmin,type User} from './auth';
import {ensureFeedback} from './feedback';
import {feedbackMarkdown} from '../feedback-export';
import type {FeedbackReport,FeedbackMessage} from '../feedback';

export async function* exportFeedbackPages<T extends {id:string;created_at:string}>(table:'feedback_reports'|'feedback_messages',cutoff:string,reportId?:string){
  let cursor:T|undefined;
  while(true){
    let rows:T[];
    if(isSupabase()){
      let q=supabase().from(table).select('*').lte('created_at',cutoff).order('created_at').order('id').limit(50);
      if(reportId)q=q.eq('report_id',reportId);
      if(cursor)q=q.or(`created_at.gt.${cursor.created_at},and(created_at.eq.${cursor.created_at},id.gt.${cursor.id})`);
      const r=await q;if(r.error)throw r.error;rows=r.data as T[];
    }else{
      const filters=['created_at<=?'],params:(string|number)[]=[cutoff];
      if(reportId){filters.push('report_id=?');params.push(reportId);}
      if(cursor){filters.push('(created_at>? OR (created_at=? AND id>?))');params.push(cursor.created_at,cursor.created_at,cursor.id);}
      rows=(await binding().prepare(`SELECT * FROM ${table} WHERE ${filters.join(' AND ')} ORDER BY created_at,id LIMIT 50`).bind(...params).all<T>()).results;
    }
    if(!rows.length)return;yield rows;cursor=rows.at(-1)!;if(rows.length<50)return;
  }
}
export async function feedbackExport(u:User){
  requireAdmin(u);await ensureFeedback();
  const at=new Date().toISOString(),encoder=new TextEncoder();
  const iterator=feedbackMarkdown({reports:cutoff=>exportFeedbackPages<FeedbackReport>('feedback_reports',cutoff),messages:(id,cutoff)=>exportFeedbackPages<FeedbackMessage>('feedback_messages',cutoff,id)},at);
  const stream=new ReadableStream<Uint8Array>({async pull(controller){try{const r=await iterator.next();if(r.done)controller.close();else controller.enqueue(encoder.encode(r.value));}catch(error){controller.error(error);}},async cancel(){await iterator.return();}});
  return new Response(stream,{headers:{'Content-Type':'text/markdown; charset=utf-8','Content-Disposition':`attachment; filename="komponent-radari-geri-bildirimler-${at.replace(/[:.]/g,'-')}.md"`,'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'}});
}
