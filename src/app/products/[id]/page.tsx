import Workspace from '@/components/workspace';
export default async function Product({params}:{params:Promise<{id:string}>}){const{id}=await params;return <Workspace productId={id}/>;}
