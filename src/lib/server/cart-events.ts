import {access} from "./carts";
import {HttpError} from "./db";
export async function cartEvents(request:Request,cartId:string,userId:string){
  await access(cartId,userId);
  let stopped=false;
  const encoder=new TextEncoder();
  const stream=new ReadableStream<Uint8Array>({
    start(controller){
      const send=(event:string,data:unknown)=>{if(!stopped)controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));};
      const pump=async()=>{
        let revision="";
        const until=Date.now()+25000;
        try{
          send("connected",{});
          while(!stopped && !request.signal.aborted && Date.now()<until){
            const {cart}=await access(cartId,userId);
            if(cart.updated_at!==revision){revision=cart.updated_at;send("revision",{revision});}
            await new Promise(resolve=>setTimeout(resolve,1000));
          }
        }catch(error){send(error instanceof HttpError && [403,404].includes(error.status)?"access-error":"connection-error",{});}
        finally{if(!stopped){stopped=true;controller.close();}}
      };
      void pump();
    },
    cancel(){stopped=true;},
  });
  return new Response(stream,{headers:{"Content-Type":"text/event-stream","Cache-Control":"private, no-store","X-Accel-Buffering":"no"}});
}
