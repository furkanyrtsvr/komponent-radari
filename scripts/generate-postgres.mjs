import fs from 'node:fs';
const source=fs.readFileSync('drizzle/0000_remarkable_redwing.sql','utf8');
const statements=source.replaceAll('`','"').replaceAll('--> statement-breakpoint','').split(';').map(s=>s.trim()).filter(Boolean);
const tables=[],constraints=[],indexes=[];
for(const sql of statements){if(!sql.startsWith('CREATE TABLE')){indexes.push(sql+';');continue;}const table=sql.match(/CREATE TABLE "([^"]+)"/)[1];const lines=sql.split('\n'),kept=[];for(const line of lines){if(line.trim().startsWith('FOREIGN KEY'))constraints.push(`ALTER TABLE "${table}" ADD ${line.trim().replace(/,$/,'')};`);else kept.push(line);}tables.push(kept.join('\n').replace(/,\s*\)$/,'\n)')+';');}
fs.mkdirSync('supabase/migrations',{recursive:true});
fs.writeFileSync('supabase/migrations/202609280001_initial.sql','-- PostgreSQL/Supabase schema; money values are integer kuruş.\nBEGIN;\n'+tables.join('\n\n')+'\n\n'+constraints.join('\n')+'\n\n'+indexes.join('\n')+'\nCOMMIT;\n');
console.log('PostgreSQL relational migration generated, foreign keys applied after all tables.');
