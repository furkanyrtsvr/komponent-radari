import test from "node:test";
import assert from "node:assert/strict";
import {waitForSignal,fairRefreshQueue} from "../lib/async-deadline";
import {JsonLdAdapter} from "../stores/base";

test("a cancelled caller stops waiting for shared robots without cancelling another caller",async()=>{
  const controller=new AbortController();
  let finish!:(value:string)=>void;
  const shared=new Promise<string>(resolve=>{finish=resolve;});
  const waiting=waitForSignal(shared,controller.signal);
  controller.abort(new Error("refresh deadline"));
  await assert.rejects(waiting,/refresh deadline/);
  finish("User-agent: *\nAllow: /");
  assert.equal(await shared,"User-agent: *\nAllow: /");
});
test("a rejected shared request is handled even after caller cancellation",async()=>{
  const controller=new AbortController();
  let fail!:(error:Error)=>void;
  const shared=new Promise<string>((_,reject)=>{fail=reject;});
  const waiting=waitForSignal(shared,controller.signal);
  controller.abort(new Error("deadline"));
  await assert.rejects(waiting,/deadline/);
  fail(new Error("merchant failure"));
  await new Promise(resolve=>setImmediate(resolve));
});
test("merchant queue gives each basket product a turn and prioritizes verified URLs",()=>{
  const sources=[{productId:"a",url:"unknown-a1"},{productId:"a",url:"verified-a"},{productId:"a",url:"unknown-a2"},{productId:"b",url:"verified-b"},{productId:"c",url:"unknown-c"}];
  const ordered=fairRefreshQueue(sources,source=>source.url.startsWith("verified")?0:1);
  assert.deepEqual(ordered.map(source=>source.url),["verified-a","verified-b","unknown-c","unknown-a1","unknown-a2"]);
  assert.equal(new Set(ordered).size,sources.length);
});
test("aborted merchant deadline prevents product and robots requests",async()=>{
  const controller=new AbortController();
  controller.abort(new Error("merchant deadline"));
  const original=globalThis.fetch;
  let requests=0;
  globalThis.fetch=async()=>{requests++;throw new Error("request should not start");};
  try{
    const adapter=new JsonLdAdapter({id:"test",domain:"deadline.example",requestSignal:controller.signal});
    await assert.rejects(adapter.getProduct("https://deadline.example/product"),/merchant deadline/);
    assert.equal(requests,0);
  }finally{globalThis.fetch=original;}
});
test("deadline stops a redirect chain instead of granting each redirect a new full timeout",async()=>{
  const controller=new AbortController(),original=globalThis.fetch;
  let productRequests=0;
  globalThis.fetch=async(input,init)=>{
    assert.ok(init?.signal);
    if(String(input).endsWith("/robots.txt"))return new Response("User-agent: *\nAllow: /");
    productRequests++;
    controller.abort(new Error("redirect deadline"));
    return new Response(null,{status:302,headers:{location:"/second-product"}});
  };
  try{
    const adapter=new JsonLdAdapter({id:"test",domain:"redirect-deadline.example",requestSignal:controller.signal});
    await assert.rejects(adapter.getProduct("https://redirect-deadline.example/product"),/redirect deadline/);
    assert.equal(productRequests,1);
  }finally{globalThis.fetch=original;}
});
test("merchant deadline also cancels a product body that never finishes streaming",async()=>{
  const controller=new AbortController(),original=globalThis.fetch;
  globalThis.fetch=async(input,init)=>{
    if(String(input).endsWith("/robots.txt"))return new Response("User-agent: *\nAllow: /");
    const stream=new ReadableStream<Uint8Array>({start(body){
      body.enqueue(new TextEncoder().encode("<h1>Partial merchant response</h1>"));
      init!.signal!.addEventListener("abort",()=>body.error(init!.signal!.reason),{once:true});
      queueMicrotask(()=>controller.abort(new Error("body deadline")));
    }});
    return new Response(stream,{headers:{"content-type":"text/html; charset=utf-8"}});
  };
  try{
    const adapter=new JsonLdAdapter({id:"test",domain:"body-deadline.example",requestSignal:controller.signal});
    await assert.rejects(adapter.getProduct("https://body-deadline.example/product"),/body deadline/);
  }finally{globalThis.fetch=original;}
});
