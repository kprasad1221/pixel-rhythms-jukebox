import test from 'node:test';
import assert from 'node:assert/strict';
import { createLivePreview } from '../src/live-preview.js';
function fixture(play = () => Promise.resolve()) {
 const callbacks=new Map(),log=[],failures=[];let next=0;
 const video=new EventTarget();Object.assign(video,{dataset:{},pause(){},play,videoWidth:640,videoHeight:360,
 requestVideoFrameCallback(fn){callbacks.set(++next,fn);return next;},cancelVideoFrameCallback(id){callbacks.delete(id);}});
 const preview=createLivePreview(video,(...args)=>log.push(args),message=>failures.push(message));
 return {video,preview,log,failures,frame(){const [id,fn]=callbacks.entries().next().value;callbacks.delete(id);fn();}};
}
test('a rejected browser play is visible and requests cleanup', async()=>{
 const f=fixture(()=>Promise.reject(new Error('Playback refused')));
 f.preview.attach({},'Test');await Promise.resolve();
 assert.match(f.failures[0],/Playback refused/);
 assert.ok(f.log.some(([stage,,level])=>stage==='Live preview'&&level==='error'));
 f.preview.finish('Cleanup');
});
test('attachment and playing alone do not claim a displayed video frame',()=>{
 const f=fixture();const stream={};f.preview.attach(stream,'Test');
 assert.equal(f.video.srcObject,stream);assert.equal(f.preview.frames,0);
 assert.ok(!JSON.stringify(f.log).includes('FIRST VIDEO FRAME DISPLAYED'));
 f.frame();assert.equal(f.preview.frames,1);
 assert.ok(JSON.stringify(f.log).includes('FIRST VIDEO FRAME DISPLAYED'));
 f.preview.finish('Complete');assert.equal(f.failures.length,0);
});
test('stale playback rejection cannot stop a replacement preview',async()=>{
 let reject;const f=fixture(()=>new Promise((_,r)=>{reject=r;}));
 f.preview.attach({},'Old');const rejectOld=reject;
 f.preview.attach({},'New');rejectOld(new Error('Stale'));await Promise.resolve();
 assert.equal(f.failures.length,0);f.frame();assert.equal(f.preview.frames,1);
 f.preview.finish('Complete');
});

test('a stalled video frame check requests cleanup without claiming playback',async t=>{
 const realSetTimeout=globalThis.setTimeout;
 t.mock.method(globalThis,'setTimeout',(fn,ms,...args)=>realSetTimeout(fn,ms===8000?0:ms,...args));
 const f=fixture();f.preview.attach({},'Stalled');
 await new Promise(resolve=>realSetTimeout(resolve,10));
 assert.equal(f.preview.frames,0);assert.match(f.failures[0],/no displayed video frame/);
 f.preview.finish('Cleanup');
});
test('video element error is reported and requests cleanup',()=>{
 const f=fixture();f.preview.attach({},'Bad stream');f.video.error={message:'Decoder failed'};
 f.video.dispatchEvent(new Event('error'));
 assert.match(f.failures[0],/Decoder failed/);f.preview.finish('Cleanup');
});
