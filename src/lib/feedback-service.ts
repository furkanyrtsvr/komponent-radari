import {createFeedbackSchema,feedbackMessageSchema,type FeedbackReport,type FeedbackMessage} from './feedback';

export class FeedbackError extends Error{constructor(public status:number,message:string){super(message);}}
export interface FeedbackRepository{
  get(id:string):Promise<FeedbackReport|undefined>;
  list(owner:string|undefined):Promise<FeedbackReport[]>;
  messages(id:string):Promise<FeedbackMessage[]>;
  message(id:string):Promise<FeedbackMessage|undefined>;
  create(report:FeedbackReport,message:FeedbackMessage):Promise<void>;
  append(message:FeedbackMessage):Promise<void>;
  touch(id:string,values:Partial<Pick<FeedbackReport,'status'|'updated_at'>>):Promise<void>;
}
export function feedbackService(repo:FeedbackRepository,actor:{id:string;admin:boolean}){
  const access=async(id:string)=>{const r=await repo.get(id);if(!r||r.user_id!==actor.id&&!actor.admin)throw new FeedbackError(404,'Bildirim bulunamadı.');return r;};
  return {
    list:(all=false)=>{if(all&&!actor.admin)throw new FeedbackError(403,'Yönetici yetkisi gerekli.');return repo.list(all?undefined:actor.id);},
    detail:async(id:string)=>({report:await access(id),messages:await repo.messages(id)}),
    create:async(input:unknown)=>{
      const v=createFeedbackSchema.parse(input),existing=await repo.get(v.id);
      if(existing){if(existing.user_id!==actor.id)throw new FeedbackError(409,'Bildirim kimliği kullanılamıyor.');return existing;}
      const at=new Date().toISOString();
      const report:FeedbackReport={id:v.id,user_id:actor.id,title:v.title,kind:v.kind,status:'open',context:JSON.stringify(v.context),created_at:at,updated_at:at};
      await repo.create(report,{id:v.id,report_id:v.id,author_id:actor.id,author_role:'reporter',body:v.message,created_at:at});return report;
    },
    reply:async(id:string,input:unknown)=>{
      const report=await access(id),v=feedbackMessageSchema.parse(input),old=await repo.message(v.id);
      if(old){if(old.report_id!==id||old.author_id!==actor.id)throw new FeedbackError(409,'Mesaj kimliği kullanılamıyor.');return old;}
      const message:FeedbackMessage={id:v.id,report_id:id,author_id:actor.id,author_role:actor.admin&&report.user_id!==actor.id?'admin':'reporter',body:v.message,created_at:new Date().toISOString()};
      await repo.append(message);await repo.touch(id,{updated_at:message.created_at});return message;
    },
    status:async(id:string,status:FeedbackReport['status'])=>{
      if(!actor.admin)throw new FeedbackError(403,'Yönetici yetkisi gerekli.');await access(id);
      await repo.touch(id,{status,updated_at:new Date().toISOString()});return {ok:true};
    },
  };
}
