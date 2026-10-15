// npm may silently omit a failed optional binary download. Restore exactly the
// integrity-pinned Linux package before starting the Cloudflare build.
import {readFile, mkdir, mkdtemp, writeFile, rm, access} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {tmpdir} from 'node:os';
import path from 'node:path';

if(process.platform !== 'linux' || process.arch !== 'x64') {
  console.log('Linux x64 workerd repair is not needed on this platform.');
} else {
  const name='@cloudflare/workerd-linux-64';
  const destination=path.resolve('node_modules',name);
  const binary=path.join(destination,'bin/workerd');
  let installed=true;
  try { await access(binary); } catch { installed=false; }
  if(!installed) {
    const lock=JSON.parse(await readFile('package-lock.json','utf8'));
    const entry=lock.packages['node_modules/'+name];
    if(!entry?.resolved || !entry.integrity) throw Error('Missing integrity-pinned workerd package in lockfile.');
    const url=new URL(entry.resolved);
    if(url.protocol!=='https:' || url.hostname!=='registry.npmjs.org') throw Error('Unexpected workerd registry.');
    let bytes;
    for(let attempt=0;attempt<3;attempt++) {
      try {
        const response=await fetch(url,{signal:AbortSignal.timeout(60000)});
        if(!response.ok) throw Error('Workerd download HTTP '+response.status);
        bytes=Buffer.from(await response.arrayBuffer());
        break;
      } catch(error) { if(attempt===2) throw error; }
    }
    const [algorithm,expected]=entry.integrity.split('-',2);
    if(algorithm!=='sha512' || createHash('sha512').update(bytes).digest('base64')!==expected) throw Error('Workerd integrity mismatch.');
    const temporary=await mkdtemp(path.join(tmpdir(),'workerd-'));
    try {
      const archive=path.join(temporary,'workerd.tgz');
      await writeFile(archive,bytes);
      await mkdir(destination,{recursive:true});
      const extracted=spawnSync('tar',['-xzf',archive,'-C',destination,'--strip-components=1'],{stdio:'inherit'});
      if(extracted.status!==0) throw Error('Workerd extraction failed.');
    } finally { await rm(temporary,{recursive:true,force:true}); }
    console.log('Restored workerd '+entry.version+' with verified SHA-512.');
  }
  const result=spawnSync(binary,['--version'],{stdio:'inherit'});
  if(result.status!==0) throw Error('The installed workerd binary cannot execute.');
}
