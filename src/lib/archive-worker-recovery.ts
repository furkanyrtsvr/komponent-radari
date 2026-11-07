import type {BootstrapJob} from './archive-bootstrap';
export function completedWorkerRecovery(job:BootstrapJob,workerUrl:string,status:string,at=new Date().toISOString()):BootstrapJob|null{
 if(job.state!=='running'||job.workerUrl!==workerUrl||status!=='completed'||!job.checkpointKey||!job.checkpointAt)return null;
 return {...job,revision:job.revision+1,state:job.stopRequested?'paused':'queued',stage:job.stopRequested?'paused':'queued',updatedAt:at,leaseId:undefined,leaseUntil:undefined,lastError:'',stopRequested:false};
}
