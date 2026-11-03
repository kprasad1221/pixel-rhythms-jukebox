// Exercise the shipped HTML's real interaction code with simulated browser media.
// This checks state, audio routing, drawing calls and cleanup, not codec/browser quality.
import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { parseHTML } = require(process.env.TEST_DOM_MODULE_PATH || 'linkedom');
const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const script = html.match(/<script>([\s\S]*?)<\/script>/)[1];
const flush = () => new Promise(resolve => setImmediate(resolve));
const file = (name, relative='') => ({ name, type: 'video/mp4', webkitRelativePath: relative });

async function setup() {
  const { document, window } = parseHTML(html);
  const urls = new Map(), frames = new Set(), timers = new Map(), intervals = new Map(), drawCalls = [], audioSources = [], recordings = [];
  let time=0, urlNumber=0, timerNumber=0;
  const noOp=()=>{};
  const $=id=>document.getElementById(id);
  const draw = { globalAlpha:1, globalCompositeOperation:'source-over', drawImage(video) {drawCalls.push({name:urls.get(video.src)?.name, alpha:this.globalAlpha, operation:this.globalCompositeOperation});} };
  const drawing = new Proxy(draw,{get:(target,key)=>key in target?target[key]:noOp});
  const track=kind=>({kind,stop(){this.stopped=true;}});
  const stream=()=>({tracks:[track('video')],addTrack(track){this.tracks.push(track);},getTracks(){return this.tracks;},getVideoTracks(){return this.tracks.filter(t=>t.kind==='video');}});
  for(const canvas of document.querySelectorAll('canvas')) {
    canvas.getContext=()=>drawing;
    canvas.getBoundingClientRect=()=>({width:300,height:100});
    canvas.captureStream=()=>{const s=stream();recordings.push({canvas,stream:s});return s;};
  }
  const prepareVideo=video=>{
    Object.assign(video,{paused:true,readyState:0,videoWidth:1344,videoHeight:768});
    video.pause=()=>{video.paused=true;};
    video.load=()=>{if(!video.getAttribute('src')){video.readyState=0;return;}queueMicrotask(()=>{video.readyState=2;video.dispatchEvent(new window.Event('loadeddata'));});};
    video.play=async()=>{if(urls.get(video.src)?.name.startsWith('bad'))throw Error('Unsupported media');video.paused=false;};
    Object.defineProperty(video,'src',{get:()=>video.getAttribute('src'),set:value=>video.setAttribute('src',value)});
    return video;
  };
  for(const video of document.querySelectorAll('video'))prepareVideo(video);
  const createElement=document.createElement.bind(document);
  document.createElement=tag=>{const el=createElement(tag);if(tag==='video')prepareVideo(el);return el;};
  for(const select of document.querySelectorAll('select')) {
    let value=select.id==='fade-seconds'?'0.5':'0';
    Object.defineProperty(select,'value',{get:()=>value,set:v=>value=String(v)});
  }
  for(const input of document.querySelectorAll('input[type=file]')) {
    let files=[];
    Object.defineProperty(input,'files',{get:()=>files,set:v=>files=v});
    Object.defineProperty(input,'value',{get:()=>files[0]?.name||'',set:v=>{if(!v)files=[];}});
  }
  const param=()=>({value:0,setValueAtTime(v){this.value=v;},cancelScheduledValues:noOp,linearRampToValueAtTime(v){this.value=v;},setTargetAtTime(v){this.value=v;}});
  class AudioContext {
    get currentTime(){return time/1000;}get state(){return 'running';}async resume(){}async close(){}
    createGain(){return {gain:param(),connect:noOp,disconnect:noOp};}
    createMediaElementSource(video){audioSources.push(video);return {connect:noOp};}
    createAnalyser(){return {fftSize:1024,connect:noOp,getFloatTimeDomainData:a=>a.fill(.1)};}
    createChannelSplitter(){return {connect:noOp};}
    createMediaStreamDestination(){const audio=track('audio');return {stream:{getAudioTracks:()=>[audio]}};}
  }
  class MediaRecorder {
    static isTypeSupported(){return true;}
    constructor(stream,options){this.stream=stream;this.mimeType=options.mimeType;this.state='inactive';}
    start(){this.state='recording';}
    stop(){this.state='inactive';queueMicrotask(()=>{this.ondataavailable?.({data:new Blob(['test recording'],{type:this.mimeType})});this.onstop?.();});}
  }
  window.AudioContext=AudioContext;window.MediaRecorder=MediaRecorder;
  const globals={document,window,Blob,MediaRecorder,console,devicePixelRatio:1,performance:{now:()=>time},
    URL:{createObjectURL:blob=>{const url=`blob:test/${++urlNumber}`;urls.set(url,blob);return url;},revokeObjectURL:url=>urls.delete(url)},
    ResizeObserver:class{constructor(cb){this.cb=cb;}observe(){this.cb();}},matchMedia:()=>({matches:false}),
    requestAnimationFrame:cb=>frames.add(cb),
    setTimeout:(cb,delay)=>{const id=++timerNumber;timers.set(id,{cb,at:time+delay});return id;},clearTimeout:id=>timers.delete(id),
    setInterval:(cb)=>{const id=++timerNumber;intervals.set(id,cb);return id;},clearInterval:id=>intervals.delete(id)};
  const context=vm.createContext(globals);vm.runInContext(script,context);
  async function tick(seconds=1){time+=seconds*1000;for(const cb of [...frames]){frames.delete(cb);cb(time);}for(const [id,t]of [...timers])if(t.at<=time){timers.delete(id);t.cb();}for(const cb of intervals.values())cb();await flush();}
  async function click(id){const el=typeof id==='number'?$('pads').children[id]:$(id);if(!el.disabled)el.dispatchEvent(new window.Event('click'));await flush();}
  async function select(files,id='files-input'){$(id).files=files;$(id).dispatchEvent(new window.Event('change'));await flush();}
  async function input(id,value){$(id).value=value;$(id).dispatchEvent(new window.Event('input'));await flush();}
  async function play(index){await click(index);await tick();}
  return {$,window,document,click,select,input,play,tick,urls,drawCalls,audioSources,recordings,read:expression=>vm.runInContext(expression,context)};
}

test('standalone startup: no scene manifest, external scripts or network dependency',async()=>{
  const h=await setup();assert.equal(h.$('pads').children.length,10);
  assert.ok([...h.$('pads').children].every(p=>p.disabled));
  assert.equal(h.$('record').disabled,true);assert.equal(h.$('pause').disabled,true);
  assert.doesNotMatch(script,/\bfetch\(|decodeAudioData|data\.json|config\.js/);
  assert.doesNotMatch(html,/<script[^>]+src=/);assert.match(html,/connect-src 'none'/);
});
test('folder selection uses full paths, natural order and every clip across banks',async()=>{
  const h=await setup();const files=Array.from({length:14},(_,i)=>file(`clip${14-i}.mp4`,`World/clip${14-i}.mp4`));
  await h.select([...files,{name:'readme.txt'}],'folder-input');
  assert.match(h.$('pads').children[0].title,/clip1.mp4/);assert.equal(h.$('bank-label').textContent,'1 / 2');
  await h.click('next-bank');assert.match(h.$('pads').children[0].title,/clip11.mp4/);assert.equal(h.$('pads').children[3].disabled,false);assert.equal(h.$('pads').children[4].disabled,true);
  await h.play(3);assert.match(h.$('status').textContent,/clip14.mp4 — playing/);
});
test('ordinary video uses embedded media-element audio, plays, pauses and resumes',async()=>{
  const h=await setup();await h.select([file('a.mp4')]);await h.play(0);
  assert.equal(h.$('empty').hidden,true);assert.equal(h.audioSources.length,2);
  assert.equal(h.read('activeClip.file.name'),'a.mp4');assert.equal(h.urls.size,1);
  assert.ok(h.drawCalls.some(d=>d.name==='a.mp4'));
  await h.click('pause');assert.equal(h.read('paused'),true);await h.click('pause');assert.equal(h.read('paused'),false);
});
test('crossfade draws both pictures, routes both gains and releases the old file',async()=>{
  const h=await setup();await h.select([file('a.mp4'),file('b.mp4')]);await h.play(0);await h.click(1);await h.tick(.25);
  const last=h.drawCalls.slice(-2);assert.deepEqual(last.map(d=>d.name),['a.mp4','b.mp4']);assert.equal(last[1].alpha,.5);
  await h.tick(.3);assert.equal(h.read('activeClip.file.name'),'b.mp4');assert.equal(h.urls.size,1);
});
test('light layering is muted, adjustable and keeps base audio; a pad returns to playback',async()=>{
  const h=await setup();await h.select([file('a.mp4'),file('b.mp4'),file('c.mp4')]);await h.play(0);
  await h.click('arm-layer');await h.play(1);await h.input('layer-amount','0.75');
  assert.equal(h.read('layer.video.muted'),true);assert.equal(h.read('activeClip.file.name'),'a.mp4');assert.equal(h.audioSources.length,2);
  assert.ok(h.drawCalls.some(d=>d.name==='b.mp4'&&d.operation==='lighten'&&d.alpha===.75));
  assert.match(h.$('layer-state').textContent,/Music continues from a.mp4/);
  await h.play(2);assert.equal(h.read('layer'),null);assert.equal(h.urls.size,1);assert.equal(h.document.querySelectorAll('#media-pool video').length,2);
});
test('bad replacement base/layer retains the working scene and releases failed URLs',async()=>{
  const h=await setup();await h.select([file('a.mp4'),file('b.mp4'),file('bad.mp4')]);await h.play(0);await h.click('arm-layer');await h.play(1);
  await h.click('arm-layer');await h.play(2);
  assert.equal(h.read('layer.clip.file.name'),'b.mp4');assert.equal(h.read('activeClip.file.name'),'a.mp4');assert.equal(h.urls.size,2);
  assert.match(h.$('status').textContent,/bad.mp4/);
  await h.click('arm-layer');await h.play(2);assert.equal(h.read('activeClip.file.name'),'a.mp4');assert.equal(h.read('layer.clip.file.name'),'b.mp4');assert.equal(h.urls.size,2);
});
test('replacing one pad keeps the playing file until that new pad is tapped',async()=>{
  const h=await setup();await h.select([file('a.mp4')]);await h.play(0);await h.select([file('replacement.mp4')],'replacement');
  assert.equal(h.read('activeClip.file.name'),'a.mp4');assert.equal(h.read('clips[0].file.name'),'replacement.mp4');
  await h.play(0);assert.equal(h.read('activeClip.file.name'),'replacement.mp4');assert.equal(h.urls.size,1);
});
test('reselecting folder replaces the set; empty selection preserves existing set',async()=>{
  const h=await setup();await h.select([file('a.mp4'),file('b.mp4')]);await h.play(0);await h.click('arm-layer');await h.play(1);
  await h.select([]);assert.equal(h.read('clips.length'),2);assert.equal(h.urls.size,2);
  await h.select([file('new.mp4')]);assert.equal(h.read('current'),-1);assert.equal(h.urls.size,0);assert.equal(h.read('clips.length'),1);
});
test('recording captures the displayed canvas and master audio; stop cleans only recording tracks',async()=>{
  const h=await setup();await h.select([file('a.mp4')]);await h.play(0);await h.click('record');
  assert.equal(h.recordings[0].canvas,h.$('picture'));assert.deepEqual(h.recordings[0].stream.getTracks().map(t=>t.kind),['video','audio']);
  assert.equal(h.$('choose-folder').disabled,true);assert.equal(h.$('replacement').disabled,true);
  await h.select([file('ignore.mp4')]);assert.equal(h.read('clips[0].file.name'),'a.mp4');
  await h.tick();await h.click('record');assert.equal(h.$('save-performance').disabled,false);assert.equal(h.$('choose-folder').disabled,false);
  assert.ok(h.recordings[0].stream.getTracks().every(t=>t.stopped));assert.equal(h.read('videos[current].paused'),false);assert.ok(h.read('take.size')>0);
});
test('keyboard shortcuts still work after a pad has focus',async()=>{
  const h=await setup();await h.select([file('a.mp4'),file('b.mp4')]);await h.play(0);
  const event=new h.window.Event('keydown',{bubbles:true,cancelable:true});event.key='2';h.$('pads').children[0].dispatchEvent(event);await new Promise(resolve=>setImmediate(resolve));await h.tick();
  assert.equal(h.read('activeClip.file.name'),'b.mp4');
});
