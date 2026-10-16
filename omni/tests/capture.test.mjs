import test from 'node:test';
import assert from 'node:assert/strict';
import { startCapture } from '../src/capture.js';

function fixture(t, mode) {
 const original = Object.getOwnPropertyDescriptor(globalThis, 'MediaRecorder');
 t.after(() => original ? Object.defineProperty(globalThis, 'MediaRecorder', original) : delete globalThis.MediaRecorder);
 globalThis.MediaRecorder = class {
   static isTypeSupported(){return true;}
   constructor(_,options){this.mimeType=options.mimeType;this.state='inactive';}
   start(){this.state='recording';}
   stop(){
     if(mode==='error')this.onerror({error:new Error('Simulated encoder failure')});
     this.ondataavailable({data:new Blob(mode==='empty'?[]:['media'])});
     this.state='inactive';this.onstop();
   }
 };
 const log=[];
 const capture=startCapture({getTracks:()=>[{kind:'video',readyState:'live',enabled:true,muted:true}]},(...args)=>log.push(args));
 return {capture,log};
}
test('zero-byte capture is an explicit failure with track-state and chunk diagnostics',async t=>{
 const {capture,log}=fixture(t,'empty');
 await assert.rejects(capture.finish(),/No media bytes/);
 assert.ok(log.some(([,text])=>text.includes('muted=true')));
 assert.ok(log.some(([,text])=>text.includes('0 nonempty chunks, 1 empty events, 0 bytes')));
});
test('final dataavailable chunk is retained before the stop event resolves capture',async t=>{
 const {capture,log}=fixture(t,'data');
 const blob=await capture.finish();
 assert.equal(await blob.text(),'media');
 assert.ok(log.some(([,text])=>text.includes('1 nonempty chunks')));
});
test('recorder error is reported even when a final chunk exists',async t=>{
 const {capture,log}=fixture(t,'error');
 await assert.rejects(capture.finish(),/Simulated encoder failure/);
 assert.ok(log.some(([stage,,level])=>stage==='Capture'&&level==='error'));
});
