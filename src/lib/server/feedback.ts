import {binding,isSupabase,one,recent,insert,insertBatch,update} from './db';
import {startupGate} from '../startup';
import {feedbackService,type FeedbackRepository} from '../feedback-service';
import type {FeedbackReport,FeedbackMessage} from '../feedback';
import {isAdmin,type User} from './auth';

// The production D1 binding can safely initialize this additive migration on
// first use; existing records and other startup routes are untouched.
export const ensureFeedback=startupGate(async()=>{
  if(isSupabase())return;
  await binding().batch([
    binding().prepare('CREATE TABLE IF NOT EXISTS feedback_reports (id TEXT PRIMARY KEY NOT NULL,user_id TEXT NOT NULL REFERENCES users(id),title TEXT NOT NULL,kind TEXT NOT NULL,status TEXT NOT NULL,context TEXT NOT NULL,created_at TEXT NOT NULL,updated_at TEXT NOT NULL)'),
    binding().prepare('CREATE INDEX IF NOT EXISTS feedback_owner_updated ON feedback_reports(user_id,updated_at)'),
    binding().prepare('CREATE INDEX IF NOT EXISTS feedback_updated ON feedback_reports(updated_at)'),
    binding().prepare('CREATE TABLE IF NOT EXISTS feedback_messages (id TEXT PRIMARY KEY NOT NULL,report_id TEXT NOT NULL REFERENCES feedback_reports(id),author_id TEXT NOT NULL REFERENCES users(id),author_role TEXT NOT NULL,body TEXT NOT NULL,created_at TEXT NOT NULL)'),
    binding().prepare('CREATE INDEX IF NOT EXISTS feedback_conversation ON feedback_messages(report_id,created_at)'),
  ]);
});
const repo:FeedbackRepository={
  get:id=>one<FeedbackReport>('feedback_reports',{id}),
  list:owner=>recent<FeedbackReport>('feedback_reports','updated_at',owner?{user_id:owner}:{},200),
  messages:async id=>(await recent<FeedbackMessage>('feedback_messages','created_at',{report_id:id},200)).reverse(),
  message:id=>one<FeedbackMessage>('feedback_messages',{id}),
  create:(report,message)=>insertBatch([{table:'feedback_reports',row:report},{table:'feedback_messages',row:message}]),
  append:message=>insert('feedback_messages',message,true),
  touch:(id,values)=>update('feedback_reports',values,{id}),
};
export const feedbackFor=(u:User)=>feedbackService(repo,{id:u.id,admin:isAdmin(u)});
