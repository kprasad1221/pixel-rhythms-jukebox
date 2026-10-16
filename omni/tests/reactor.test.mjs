import test from 'node:test';
import assert from 'node:assert/strict';
import { Reactor } from '@reactor-team/js-sdk';
import { OmniSession } from '../src/reactor.js';
import { defaultPads } from '../src/pads.js';
import { safeLogText } from '../src/activity.js';

function fixture(t, mode = 'upload-fails') {
  const saved = new Map();
  function mock(name, value) { saved.set(name, Object.getOwnPropertyDescriptor(globalThis, name)); Object.defineProperty(globalThis, name, { value, configurable:true, writable:true }); }
  t.after(() => { for (const [name, descriptor] of saved) descriptor ? Object.defineProperty(globalThis, name, descriptor) : delete globalThis[name]; });
  const log = [], commands = [], uploads = []; let tokenCalls = 0, disconnects = 0;
  mock('fetch', async () => { tokenCalls++; return {ok:true,json:async()=>({jwt:'private-test-token'})}; });
  mock('createImageBitmap', async () => ({width:1344,height:768,close(){}}));
  mock('Audio', class { set src(value) { queueMicrotask(()=>this.onloadedmetadata?.()); } duration=3; removeAttribute(){} load(){} });
  mock('MediaRecorder', class {
    static isTypeSupported(){return true;}
    constructor(_, options){this.mimeType=options.mimeType;this.state='inactive';}
    start(){this.state='recording';}
    stop(){this.state='inactive';this.ondataavailable?.({data:new Blob(['simulated media'])});this.onstop?.();}
  });
  mock('MediaStream', class { constructor(tracks){this.tracks=tracks;} getTracks(){return this.tracks;} });
  class FakeReactor {
    handlers = {}; #status = 'disconnected';
    getStatus(){return this.#status;}
    on(name, handler){this.handlers[name]=handler;}
    async connect(){this.#status='ready';this.handlers.statusChanged('ready');}
    async disconnect(){disconnects++;this.#status='disconnected';this.handlers.statusChanged('disconnected');}
    async uploadFile(file){uploads.push(file);if(mode==='upload-fails')throw new Error('Simulated upload unavailable');return {privateUpload:'never log this'};}
    async sendCommand(name){
      commands.push(name);
      if(name==='set_autoplay')return {type:'autoplay_accepted'};
      if(name==='enqueue'){
        if(mode==='refused') {this.handlers.error({operation:'sendCommand',code:'invalid_audio',message:'Simulated audio refusal'});return undefined;}
        if(mode==='undefined')return undefined;
        const clip={clip_id:'test-clip'};
        if(mode==='generation-fails')this.handlers.message({type:'clip_failed',data:{clip,reason:'Simulated generation failure'}});
        else {
          this.handlers.message({type:'clip_generated',data:{clip}});
          this.handlers.trackReceived('main_video',{kind:'video'});this.handlers.trackReceived('main_audio',{kind:'audio'});
        }
        return {type:'clip_queued',data:{clip}};
      }
      if(name==='play'){
        this.handlers.message({type:'clip_started',data:{clip:{clip_id:'test-clip'}}});
        this.handlers.message({type:'clip_finished',data:{clip:{clip_id:'test-clip'}}});
      }
    }
  }
  const session=new OmniSession(()=>{},(...args)=>log.push(args),FakeReactor);
  t.after(()=>session.end());
  const pad={...defaultPads()[0],prompt:'Authored prompt not for logs',image:new Blob(['image'],{type:'image/png'}),audio:new Blob(['audio'],{type:'audio/wav'})};
  return {session,pad,log,commands,uploads,get tokenCalls(){return tokenCalls;},get disconnects(){return disconnects;}};
}

test('missing audio blocks before token, SDK connection, upload or request', async t=>{
 const f=fixture(t);f.pad.audio=null;
 await assert.rejects(f.session.generate(f.pad,()=>{}),/Daydream/);
 assert.equal(f.tokenCalls,0);assert.equal(f.uploads.length,0);assert.deepEqual(f.commands,[]);
 assert.ok(f.log.some(([stage,text,level])=>stage==='Local validation'&&level==='error'&&text.includes('Daydream')));
});
test('free media validation never connects, even with complete inputs', async t=>{
 const f=fixture(t);await f.session.checkInputs(f.pad);
 assert.equal(f.tokenCalls,0);assert.equal(f.uploads.length,0);
});
test('upload failure is named and never reported accepted or generated', async t=>{
 const f=fixture(t);await assert.rejects(f.session.generate(f.pad,()=>{}),/Simulated upload/);
 assert.equal(f.disconnects,1);assert.ok(!f.commands.includes('enqueue'));
 assert.ok(f.log.some(([stage,text,level])=>stage==='Upload'&&level==='error'&&text.includes('Stopped')));
 assert.ok(!f.log.some(([stage])=>stage==='Request acceptance'||stage==='Generation'));
});
for (const mode of ['refused','undefined']) test(`${mode} enqueue is not reported as acceptance`, async t=>{
 const f=fixture(t,mode);await assert.rejects(f.session.generate(f.pad,()=>{}),/invalid_audio|not accepted/);
 assert.equal(f.uploads.length,2);assert.ok(!f.log.some(([stage])=>stage==='Request acceptance'));
 assert.ok(!f.commands.includes('play'));assert.equal(f.disconnects,1);
});
test('accepted request can fail generation without reception or playback', async t=>{
 const f=fixture(t,'generation-fails');await assert.rejects(f.session.generate(f.pad,()=>{}),/Simulated generation failure/);
 assert.ok(f.log.some(([stage])=>stage==='Request acceptance'));
 assert.ok(!f.commands.includes('play'));assert.equal(f.disconnects,1);
});
test('simulated completion distinguishes acceptance, generation, reception and capture', async t=>{
 const f=fixture(t,'success');
 // Shorten only the offstage transport-drain wait for this simulation.
 const realSetTimeout=globalThis.setTimeout;
 t.mock.method(globalThis,'setTimeout',(fn,ms,...args)=>realSetTimeout(fn,ms>=1000&&ms<10000?0:ms,...args));
 const take=await f.session.generate(f.pad,()=>{});
 assert.ok(take.blob.size>0);assert.equal(take.clipId,'test-clip');
 for(const stage of ['Local validation','Connection','Upload','Request acceptance','Generation','Reception','Capture'])assert.ok(f.log.some(([s])=>s===stage),stage);
 assert.ok(!f.log.some(([stage])=>stage==='Playback'));
 const text=JSON.stringify(f.log);assert.ok(!text.includes('private-test-token'));assert.ok(!text.includes('Authored prompt'));assert.ok(!text.includes('privateUpload'));
});
test('log redacts token-like strings and URLs from error descriptions',()=>{
 const text=safeLogText('jwt=secret https://example.com/upload?token=secret eyJabc.abcdef.abcdef');
 assert.ok(!text.includes('secret'));assert.ok(!text.includes('eyJabc'));assert.ok(!text.includes('example.com'));
});

// Assert against the real installed class as well as the fake's private state.
test('installed SDK exposes getStatus(), not a public status property', () => {
 const reactor = new Reactor({ modelName: 'reactor/fast-h3-omni' });
 assert.equal(typeof reactor.getStatus, 'function');
 assert.equal(reactor.getStatus(), 'disconnected');
 assert.equal(reactor.status, undefined);
});
test('ready session is reused through the SDK getStatus interface', async t => {
 const f = fixture(t);
 await f.session.connect();
 assert.equal(f.tokenCalls, 1);
 assert.equal(f.session.reactor.getStatus(), 'ready');
 assert.equal(f.session.reactor.status, undefined);
 await f.session.connect();
 assert.equal(f.tokenCalls, 1);
 assert.deepEqual(f.commands, ['set_autoplay']);
 assert.ok(f.log.some(([stage, text]) => stage === 'Connection' && text.includes('connect call completed')));
});
test('incoming diagnostics select numeric inbound media counts without logging raw peer data', async t => {
 const f=fixture(t);
 f.session.reactor={getPeerConnection:()=>({getStats:async()=>new Map([
  ['video',{type:'inbound-rtp',kind:'video',bytesReceived:12345,framesReceived:24,framesDecoded:24,privateURL:'never log'}],
  ['audio',{type:'inbound-rtp',kind:'audio',bytesReceived:4000,totalSamplesReceived:48000}],
  ['outbound',{type:'outbound-rtp',bytesSent:999999}],
 ])})};
 // No SDK connection was created; avoid invoking disconnect on the stats stub.
 t.after(()=>{f.session.reactor=null;});
 await f.session.logIncomingMedia('After transport drain');
 const text=JSON.stringify(f.log);
 assert.ok(text.includes('framesDecoded=24'));assert.ok(text.includes('totalSamplesReceived=48000'));
 assert.ok(!text.includes('never log'));assert.ok(!text.includes('999999'));
 f.session.reactor=null;
});
