import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';
import {feedbackService,FeedbackError,type FeedbackRepository} from '../src/lib/feedback-service';
import {createFeedbackSchema,emptyFeedbackContext,feedbackUrl,type FeedbackReport,type FeedbackMessage} from '../src/lib/feedback';
import {comparisonFeedback} from '../src/lib/feedback-comparison';
import type {LinkResult} from '../src/components/shopping-panels';
import {adminIdentity} from '../src/lib/admin-identity';

function fixture(){
 const db=new DatabaseSync(':memory:');db.exec('PRAGMA foreign_keys=ON; CREATE TABLE users(id TEXT PRIMARY KEY); INSERT INTO users VALUES (\'alice\'),(\'bob\'),(\'admin\');'+readFileSync(new URL('../drizzle/0007_feedback.sql',import.meta.url),'utf8'));
 const repo:FeedbackRepository={
  get:async id=>db.prepare('SELECT * FROM feedback_reports WHERE id=?').get(id) as FeedbackReport|undefined,
  list:async owner=>db.prepare('SELECT * FROM feedback_reports'+(owner?' WHERE user_id=?':'')).all(...(owner?[owner]:[])) as FeedbackReport[],
  messages:async id=>db.prepare('SELECT * FROM feedback_messages WHERE report_id=? ORDER BY created_at').all(id) as FeedbackMessage[],
  message:async id=>db.prepare('SELECT * FROM feedback_messages WHERE id=?').get(id) as FeedbackMessage|undefined,
  create:async(report,message)=>{db.exec('BEGIN');try{db.prepare('INSERT INTO feedback_reports VALUES (?,?,?,?,?,?,?,?)').run(...Object.values(report));db.prepare('INSERT INTO feedback_messages VALUES (?,?,?,?,?,?)').run(...Object.values(message));db.exec('COMMIT');}catch(e){db.exec('ROLLBACK');throw e;}},
  append:async m=>{db.prepare('INSERT OR IGNORE INTO feedback_messages VALUES (?,?,?,?,?,?)').run(...Object.values(m));},
  touch:async(id,v)=>{for(const [key,value] of Object.entries(v))db.prepare(`UPDATE feedback_reports SET ${key}=? WHERE id=?`).run(value,id);},
 };
 return {db,alice:feedbackService(repo,{id:'alice',admin:false}),bob:feedbackService(repo,{id:'bob',admin:false}),admin:feedbackService(repo,{id:'admin',admin:true})};
}
const input=()=>({id:crypto.randomUUID(),title:'Yanlış voltaj',kind:'matching',message:'12 V yerine 24 V eşleşmiş.',context:emptyFeedbackContext()});
test('feedback persists context and initial message atomically; retry creates one record',async()=>{
 const {alice,db}=fixture(),payload=input();await alice.create(payload);await alice.create(payload);
 const detail=await alice.detail(payload.id);assert.equal(detail.messages.length,1);assert.equal(detail.report.status,'open');assert.deepEqual(JSON.parse(detail.report.context),payload.context);assert.equal(detail.messages[0].body,payload.message);
 assert.equal((db.prepare('SELECT COUNT(*) AS n FROM feedback_reports').get() as {n:number}).n,1);db.close();
});
test('report IDs cannot expose or mutate another user conversation',async()=>{
 const {alice,bob,db}=fixture(),r=await alice.create(input());assert.deepEqual(await bob.list(),[]);
 for(const action of [()=>bob.detail(r.id),()=>bob.reply(r.id,{id:crypto.randomUUID(),message:'x'}),()=>bob.create({...input(),id:r.id})])await assert.rejects(action,FeedbackError);
 assert.throws(()=>bob.list(true),FeedbackError);await assert.rejects(()=>alice.status(r.id,'resolved'),FeedbackError);db.close();
});
test('authorized admin can review, reply, and resolve; reporter can follow up',async()=>{
 const {alice,admin,db}=fixture(),r=await alice.create(input());assert.equal((await admin.list(true)).length,1);
 await admin.status(r.id,'reviewing');const id=crypto.randomUUID();await admin.reply(r.id,{id,message:'İnceliyoruz.'});await admin.reply(r.id,{id,message:'Tekrar gönderim'});
 await alice.reply(r.id,{id:crypto.randomUUID(),message:'Doğru ürün bağlantısını ekliyorum.'});await admin.status(r.id,'resolved');
 const detail=await alice.detail(r.id);assert.equal(detail.messages.length,3);assert.equal(detail.messages[1].author_role,'admin');assert.equal(detail.report.status,'resolved');db.close();
});
test('message id reuse across reports is rejected',async()=>{
 const {alice,db}=fixture(),a=await alice.create(input()),b=await alice.create(input()),id=crypto.randomUUID();await alice.reply(a.id,{id,message:'A'});await assert.rejects(()=>alice.reply(b.id,{id,message:'B'}),FeedbackError);db.close();
});
test('feedback accepts bounded text, strips extra fields and rejects unsafe merchant links',()=>{
 assert.equal(feedbackUrl('https://www.robotistan.com/item?token=secret#x'),'https://www.robotistan.com/item');
 for(const url of ['http://www.robotistan.com/x','https://evil.test/x','https://x:y@www.robotistan.com/x','javascript:alert(1)','https://www.robotistan.com:444/x'])assert.equal(feedbackUrl(url),'');
 for(const patch of [{message:' '},{title:'x'.repeat(141)},{message:'x'.repeat(4001)},{context:{...emptyFeedbackContext(),referenceUrl:'https://www.robotistan.com/x?token=secret'}}])assert.equal(createFeedbackSchema.safeParse({...input(),...patch}).success,false);
 assert.equal('user_id' in createFeedbackSchema.parse({...input(),user_id:'bob'}),false);
});
test('comparison evidence retains original dates and selected/excluded/conflict provenance',()=>{
 const quote={offerId:'one',store:'Robotistan',title:'24 V motor',url:'https://www.robotistan.com/motor',productTotal:12345,checkedAt:'2026-10-23T10:00:00.000Z',fromCollector:true,variantConflict:'Voltaj farklı'};
 const result={product:{name:'12 V motor'},quantity:2,quotes:[quote],excludedQuotes:[{...quote,offerId:'two',variantConflict:''}],availability:[{store:'Robotzade',url:'https://www.robotzade.com/urun/motor',status:'unknown',price:0}]} as unknown as LinkResult;
 const ctx=comparisonFeedback(result,'https://www.robotistan.com/motor?auth=secret');
 assert.equal(ctx.offers[0].checkedAt,quote.checkedAt);assert.equal(ctx.offers[0].source,'collector');assert.equal(ctx.offers[0].state,'conflict');assert.equal(ctx.offers[1].state,'excluded');assert.equal(ctx.offers[2].productTotal,null);assert.equal(ctx.offers[2].checkedAt,null);assert.equal(ctx.referenceUrl,'https://www.robotistan.com/motor');
 assert.equal(createFeedbackSchema.safeParse({...input(),context:ctx}).success,true);
});
test('empty comparison can still be reported without invented product or price',()=>{
 const ctx=comparisonFeedback(null,'https://www.robotistan.com/urun');assert.equal(ctx.productName,'');assert.deepEqual(ctx.offers,[]);assert.equal(ctx.source,'comparison');
});
test('email admin requires provider verification, not a guest/profile email',()=>{
 assert.equal(adminIdentity({id:'guest',email:'owner@example.com'} as {id:string},'','owner@example.com'),false);
 assert.equal(adminIdentity({id:'account',verified_email:'Owner@Example.com'},'',' owner@example.com '),true);
 assert.equal(adminIdentity({id:'account',verified_email:'other@example.com'},'','owner@example.com'),false);
 assert.equal(adminIdentity({id:'existing'},'existing',''),true);assert.equal(adminIdentity({id:'guest'},'',''),false);
});
