import test from 'node:test';
import assert from 'node:assert/strict';
import { drawPerformance, createPerformanceRecorder } from '../src/performance-recorder.js';

test('recorded dissolve respects stage stacking, opacity and contain sizing', () => {
  const draws = [];
  const drawing = { globalAlpha: 1, fillRect() {}, drawImage(video, ...rect) { draws.push({ id: video.id, alpha: this.globalAlpha, rect }); } };
  const videos = [
    { id:'incoming', style:{ zIndex:'2', opacity:'.4' }, readyState:2, videoWidth:640, videoHeight:480 },
    { id:'outgoing', style:{ zIndex:'1', opacity:'1' }, readyState:2, videoWidth:1280, videoHeight:720 },
    { id:'loading', style:{ zIndex:'3', opacity:'1' }, readyState:1, videoWidth:0, videoHeight:0 },
  ];
  drawPerformance(drawing, { width:1280, height:720 }, videos);
  assert.deepEqual(draws, [{ id:'outgoing', alpha:1, rect:[0,0,1280,720] }, { id:'incoming', alpha:.4, rect:[160,0,960,720] }]);
  assert.equal(drawing.globalAlpha,1);
});

test('stop keeps the final chunk and releases only recording taps; a second take works', async t => {
  let released=0, stoppedVideo=0, recorders=[];
  const states=[];
  const videoTrack={stop(){stoppedVideo++;}};
  t.mock.method(globalThis,'setInterval',()=>123);
  t.mock.method(globalThis,'clearInterval',()=>{});
  const originalDocument=globalThis.document, originalRecorder=globalThis.MediaRecorder;
  t.after(()=>{globalThis.document=originalDocument;globalThis.MediaRecorder=originalRecorder;});
  globalThis.document={createElement:()=>({ width:0,height:0,getContext:()=>({fillRect(){}}), captureStream:()=>({addTrack(){},getVideoTracks:()=>[videoTrack]}) })};
  globalThis.MediaRecorder=class {
    static isTypeSupported(){return true;}
    constructor(stream,options){this.mimeType=options.mimeType;this.state='inactive';recorders.push(this);}
    start(){this.state='recording';}
    stop(){this.state='inactive';queueMicrotask(()=>{this.ondataavailable?.({data:new Blob(['final frame'])});this.onstop?.();});}
  };
  const player={hasMedia:true,videos:[],async captureAudio(){return {stream:{getAudioTracks:()=>[{}]},release(){released++;}};}};
  const capture=createPerformanceRecorder(player,s=>states.push(s),()=>{});
  await capture.start();capture.stop();
  await new Promise(resolve=>setImmediate(resolve));
  assert.equal(capture.state,'ready');assert.equal(await capture.take.blob.text(),'final frame');
  assert.equal(released,1);assert.equal(stoppedVideo,1);
  await capture.start();capture.stop();await new Promise(resolve=>setImmediate(resolve));
  assert.equal(capture.state,'ready');assert.equal(recorders.length,2);assert.equal(released,2);
});

test('a failed replacement preserves the previous downloadable take', async t => {
  let broken=false, releases=0;
  const originalDocument=globalThis.document, originalRecorder=globalThis.MediaRecorder;
  t.after(()=>{globalThis.document=originalDocument;globalThis.MediaRecorder=originalRecorder;});
  t.mock.method(globalThis,'setInterval',()=>123);t.mock.method(globalThis,'clearInterval',()=>{});
  globalThis.document={createElement:()=>({getContext:()=>({fillRect(){}}),captureStream:()=>({addTrack(){},getVideoTracks:()=>[{stop(){}}]})})};
  globalThis.MediaRecorder=class {
    static isTypeSupported(){return true;}
    constructor(s,options){if(broken)throw new Error('Encoder unavailable');this.mimeType=options.mimeType;this.state='inactive';}
    start(){this.state='recording';}
    stop(){this.state='inactive';queueMicrotask(()=>{this.ondataavailable?.({data:new Blob(['saved performance'])});this.onstop?.();});}
  };
  const player={hasMedia:true,videos:[],async captureAudio(){return {stream:{getAudioTracks:()=>[{}]},release(){releases++;}};}};
  const capture=createPerformanceRecorder(player,()=>{},()=>{});
  await capture.start();capture.stop();await new Promise(resolve=>setImmediate(resolve));
  const take=capture.take;broken=true;await capture.start();
  assert.equal(capture.state,'error');assert.equal(capture.take,take);assert.equal(releases,2);
});
