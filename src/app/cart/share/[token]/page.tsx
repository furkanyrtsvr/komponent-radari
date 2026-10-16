import Workspace from '@/components/workspace';
export default async function Share({params}:{params:Promise<{token:string}>}){const{token}=await params;return <Workspace shareToken={token}/>;}
