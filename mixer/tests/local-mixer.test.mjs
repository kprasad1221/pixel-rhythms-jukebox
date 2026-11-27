// Runs the shipped app in a DOM with simulated media. No claim of browser playback.
import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
const require=createRequire(import.meta.url);
const {parseHTML}=require(process.env.TEST_DOM_MODULE_PATH||'linkedom');
const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
const script=html.match(/<script>([\s\S]*?)<\/script>/)[1];
const flush=()=>new Promise(resolve=>setImmediate(resolve));
const file=(name,path='')=>({name,type:'video/mp4',webkitRelativePath:path});
async function setup(){
  const {document,window}=parseHTML(html),urls=new Map(),frames=new Set(),timers=new Map(),intervals=new Map(),calls=[],sources=[],recordings=[];
  let time=0,urlNumber=0,timerNumber=0;const noOp=()=>{},$=id=>document.getElementById(id);
  const track=kind=>({kind,stop(){this.stopped=true;}});
  function prepareCanvas(canvas){
    canvas.width=Number(canvas.getAttribute('width')||1280);canvas.height=Number(canvas.getAttribute('height')||720);
    const target={canvas,filter:'none',globalAlpha:1,globalCompositeOperation:'source-over',drawImage(source){calls.push({canvas:canvas.id,source:source.id||urls.get(source.src)?.name,alpha:this.globalAlpha,operation:this.globalCompositeOperation,filter:this.filter});},getImageData(){return {data:new Uint8Array(24*14*4)}}};
    const drawing=new Proxy(target,{get:(t,k)=>k in t?t[k]:noOp});canvas.getContext=()=>drawing;canvas.getBoundingClientRect=()=>({width:300,height:100});
    canvas.captureStream=()=>{const stream={tracks:[track('video')],addTrack(t){this.tracks.push(t)},getTracks(){return this.tracks}};recordings.push({canvas,stream});return stream};
  }
  function prepareVideo(video){
    Object.assign(video,{paused:true,readyState:0,videoWidth:896,videoHeight:512,currentTime:0});video.pause=()=>video.paused=true;
    video.load=()=>{if(!video.src){video.readyState=0;return;}if(urls.get(video.src)?.name.startsWith('stall'))return;queueMicrotask(()=>{video.readyState=2;video.dispatchEvent(new window.Event('loadeddata'))});};
    video.play=async()=>{if(urls.get(video.src)?.name.startsWith('bad'))throw Error('Unsupported media');video.paused=false;};
    Object.defineProperty(video,'src',{get:()=>video.getAttribute('src'),set:v=>video.setAttribute('src',v)});
  }
  document.querySelectorAll('canvas').forEach(prepareCanvas);
  const createElement=document.createElement.bind(document);document.createElement=tag=>{const el=createElement(tag);if(tag==='canvas')prepareCanvas(el);if(tag==='video')prepareVideo(el);return el};
  for(const s of document.querySelectorAll('select')){let v=s.querySelector('option[selected]')?.getAttribute('value')||s.querySelector('option')?.getAttribute('value')||'all';Object.defineProperty(s,'value',{get:()=>v,set:x=>v=String(x)});}
  for(const input of document.querySelectorAll('input[type=file]')){let files=[];Object.defineProperty(input,'files',{get:()=>files,set:v=>files=v});Object.defineProperty(input,'value',{get:()=>files[0]?.name||'',set:v=>{if(!v)files=[]}});}
  for(const input of document.querySelectorAll('input[type=checkbox]'))input.checked=input.hasAttribute('checked');
  const param=()=>({value:0,setValueAtTime(v){this.value=v},cancelScheduledValues:noOp,setTargetAtTime(v){this.value=v}});
  class AudioContext{get currentTime(){return time/1000}get state(){return 'running'}async resume(){}async close(){}createGain(){return {gain:param(),connect:noOp,disconnect:noOp}}createMediaElementSource(video){sources.push(video);return {connect:noOp,disconnect:noOp}}createAnalyser(){return {fftSize:1024,connect:noOp,getFloatTimeDomainData:a=>a.fill(.1)}}createChannelSplitter(){return {connect:noOp}}createMediaStreamDestination(){const audio=track('audio');return {stream:{getAudioTracks:()=>[audio]}}}}
  class MediaRecorder{static isTypeSupported(){return true}constructor(stream,options){this.stream=stream;this.mimeType=options.mimeType;this.state='inactive'}start(){this.state='recording'}stop(){this.state='inactive';queueMicrotask(()=>{this.ondataavailable?.({data:new Blob(['test recording'],{type:this.mimeType})});this.onstop?.()})}}
  window.AudioContext=AudioContext;window.MediaRecorder=MediaRecorder;window.scrollTo=noOp;
  const globals={document,window,Blob,File,MediaRecorder,AbortController,atob,console,devicePixelRatio:1,performance:{now:()=>time},URL:{createObjectURL:blob=>{const url=`blob:test/${++urlNumber}`;urls.set(url,blob);return url},revokeObjectURL:url=>urls.delete(url)},ResizeObserver:class{constructor(cb){this.cb=cb}observe(){this.cb()}},matchMedia:()=>({matches:false}),requestAnimationFrame:cb=>frames.add(cb),setTimeout:(cb,delay)=>{const id=++timerNumber;timers.set(id,{cb,at:time+delay});return id},clearTimeout:id=>timers.delete(id),setInterval:cb=>{const id=++timerNumber;intervals.set(id,cb);return id},clearInterval:id=>intervals.delete(id)};
  const context=vm.createContext(globals);vm.runInContext(script,context);
  async function tick(seconds=1){time+=seconds*1000;for(const cb of [...frames]){frames.delete(cb);cb(time)}for(const [id,t]of [...timers])if(t.at<=time){timers.delete(id);t.cb()}for(const cb of intervals.values())cb();await flush()}
  async function click(id){const el=typeof id==='number'?$('pads').children[id]:$(id);if(!el.disabled)el.dispatchEvent(new window.Event('click'));await flush()}
  async function select(files,id='files-input'){$(id).files=files;$(id).dispatchEvent(new window.Event('change'));await flush()}
  async function input(id,value,event='input'){$(id).value=value;$(id).dispatchEvent(new window.Event(event));await flush()}
  return {$,window,document,click,select,input,tick,urls,calls,sources,recordings,read:code=>vm.runInContext(code,context)};
}

test('fresh clone has two playable embedded samples and a visible demo start',async()=>{
 const h=await setup();assert.equal(h.read('starter.length'),2);assert.ok(h.read('starter.every(c=>c.file.size>500000)'));assert.equal(h.$('pads').children[0].disabled,false);assert.equal(h.$('pads').children[2].hidden,true);
 assert.equal(h.$('empty').hidden,false);assert.equal(h.$('demo-start').disabled,false);assert.match(h.$('status').textContent,/included/);assert.doesNotMatch(script,/\bfetch\(|decodeAudioData|config\.js|data\.json/);assert.match(html,/connect-src 'none'/);
});
test('one demo click starts both decks, A audible and B cueing',async()=>{
 const h=await setup();await h.click('demo-start');await h.tick();assert.equal(h.read('decks.filter(Boolean).length'),2);assert.equal(h.$('empty').hidden,true);assert.equal(h.read('decks[0].gain.gain.value'),1);assert.equal(h.read('decks[1].gain.gain.value'),0);assert.equal(h.read('selectedDeck'),1);assert.equal(h.urls.size,2);
});
test('crossfader controls both audio gains; soundtrack can stay on one deck',async()=>{
 const h=await setup();await h.click('demo-start');await h.input('xfader','350');assert.equal(h.read('decks[0].gain.gain.value'),.65);assert.equal(h.read('decks[1].gain.gain.value'),.35);
 await h.input('soundtrack','a','change');assert.equal(h.read('decks[0].gain.gain.value'),1);assert.equal(h.read('decks[1].gain.gain.value'),0);await h.input('xfader','1000');assert.equal(h.read('mix'),1);assert.equal(h.read('decks[0].gain.gain.value'),1);
});
test('manual crossfader cancels an automatic fade; deck endpoints remain selectable',async()=>{
 const h=await setup();await h.click('demo-start');await h.click('fade-b');await h.tick(.75);assert.equal(h.read('mix'),.5);await h.input('xfader','200');assert.equal(h.read('automation'),null);await h.tick();assert.equal(h.read('mix'),.2);await h.click('fade-b');await h.tick(2);assert.equal(h.read('mix'),1);
});
test('folder import keeps current performance and exposes every file and subfolder',async()=>{
 const h=await setup();await h.click('demo-start');const old=h.read('decks[0].clip');const list=Array.from({length:14},(_,i)=>file(`clip${14-i}.mp4`,`World/Grove/clip${14-i}.mp4`));await h.select(list,'folder-input');assert.equal(h.read('decks[0].clip'),old);assert.equal(h.read('library.length'),14);assert.match(h.$('pads').children[0].title,/clip1.mp4/);await h.click('next-bank');await h.click(3);assert.equal(h.read('decks[1].clip.file.name'),'clip14.mp4');assert.equal(h.urls.size,2);assert.ok(h.$('scene-filter').textContent.includes('Grove'));
});
test('bad file retains both working decks and releases candidate media',async()=>{
 const h=await setup();await h.click('demo-start');await h.select([file('bad.mp4')]);const before=h.read('decks[1]');await h.click(0);assert.equal(h.read('decks[1]'),before);assert.equal(h.urls.size,2);assert.match(h.$('status').textContent,/bad/);assert.equal(h.$('status').dataset.error,'true');
});
test('cancel or timeout of a stalled file preserves working playback',async()=>{
 const h=await setup();await h.click('demo-start');await h.select([file('stall.mp4')]);await h.click(0);assert.equal(h.$('cancel-load').hidden,false);await h.click('cancel-load');assert.equal(h.urls.size,2);assert.equal(h.read('pending'),null);await h.click(0);await h.tick(16);assert.equal(h.read('pending'),null);assert.equal(h.urls.size,2);
});
test('next-bar scheduling uses the manual clock, then swaps one deck',async()=>{
 const h=await setup();await h.click('demo-start');await h.tick(.3);await h.input('timing','bar','change');await h.select([file('next.mp4')]);const before=h.read('decks[1]');await h.click(0);assert.equal(h.read('decks[1]'),before);await h.tick(1);assert.equal(h.read('decks[1]'),before);await h.tick(.8);assert.equal(h.read('decks[1].clip.file.name'),'next.mp4');
});
test('pause freezes both decks and resumes them together',async()=>{
 const h=await setup();await h.click('demo-start');await h.click('pause');assert.equal(h.read('paused'),true);assert.ok(h.read('decks.every(s=>s.video.paused)'));const time=h.read('transportTime()');await h.tick(4);assert.equal(h.read('transportTime()'),time);await h.click('pause');assert.ok(h.read('decks.every(s=>!s.video.paused)'));assert.equal(h.read('transportTime()'),time);
});
test('record uses displayed canvas/master audio and preserves playback on stop',async()=>{
 const h=await setup();await h.click('demo-start');await h.click('record');assert.equal(h.recordings[0].canvas,h.$('picture'));assert.deepEqual(h.recordings[0].stream.getTracks().map(t=>t.kind),['video','audio']);assert.equal(h.$('choose-folder').disabled,true);await h.select([file('ignored.mp4')]);assert.equal(h.read('library.length'),2);await h.input('xfader','500');await h.tick();await h.click('record');assert.equal(h.$('save-performance').disabled,false);assert.ok(h.recordings[0].stream.getTracks().every(t=>t.stopped));assert.ok(h.read('decks.every(s=>!s.video.paused)'));
});
test('audio-driven brightness is applied to the recorded canvas drawing',async()=>{
 const h=await setup();await h.click('demo-start');await h.input('pulse','1');await h.tick();assert.ok(h.calls.some(c=>c.canvas==='picture'&&/^brightness\(1\./.test(c.filter)));
});
test('replacing a deck directly releases its previous video and audio nodes',async()=>{
 const h=await setup();await h.click('demo-start');await h.select([file('replacement.mp4')],'replacement');assert.equal(h.read('decks[1].clip.file.name'),'replacement.mp4');assert.equal(h.urls.size,2);assert.equal(h.read('playingVideos.length'),2);assert.equal(h.document.querySelectorAll('#media-pool video').length,2);
});
