import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { mkdtempSync } from 'node:fs';
import { join } from 'node:path';
import { createApp } from '../server.mjs';
const require=createRequire(import.meta.url);
const fs=require('fs');
const artifacts=mkdtempSync(join(tmpdir(),'jukebox-pad-'));
const assert=require('node:assert/strict');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE_PATH || 'playwright');

(async()=>{
 const server=createApp({apiKey:''});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const base=`http://127.0.0.1:${server.address().port}`;
 let browser;
 try {
 browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_PATH || undefined,args:['--no-sandbox','--disable-dev-shm-usage']});
 const page=await browser.newPage({viewport:{width:1366,height:1000},acceptDownloads:true});
 const errors=[],tokens=[],external=[],downloads=[];
 page.on('pageerror',e=>errors.push(e.message));
 page.on('request',r=>{if(r.url().includes('/api/token'))tokens.push(r.url());if(r.url().startsWith('https://'))external.push(r.url());});
 await page.route('https://**/*',r=>r.abort());
 page.on('download',d=>downloads.push(d));
 await page.goto(base);
 await page.waitForFunction(()=>document.querySelector('#activity-log').textContent.includes('App ready'));
 assert.equal(await page.locator('.edition').innerText(),'OMNI PLAYGROUND · 0.1.5');
 assert.equal(await page.locator('.pad').count(),10);
 await page.locator('#pad-prompt').fill('Original authored prompt');
 await page.locator('#test-capture').click();
 await page.waitForFunction(()=>document.querySelector('#take-status').textContent.includes('temporary LOCAL TEST') && !document.querySelector('#test-capture').disabled,null,{timeout:12000});
 const original=await page.locator('#capture-test-preview').evaluate(async v=>Array.from(new Uint8Array(await (await fetch(v.src)).arrayBuffer())));
 await page.locator('#pad-clip').setInputFiles({name:'original.webm',mimeType:'video/webm',buffer:Buffer.from(original)});
 await page.locator('#save-pad').click();
 await page.waitForFunction(()=>document.querySelector('#editor-status').textContent.startsWith('Saved'));
 // Ensure the free test itself resets both the mode and paid checkbox.
 await page.locator('#play-mode').selectOption('generate');
 await page.locator('#allow-generation').check();
 await page.locator('#test-capture').click();
 await page.waitForFunction(()=>document.querySelector('#take-status').textContent.includes('temporary LOCAL TEST') && !document.querySelector('#test-capture').disabled,null,{timeout:12000});
 assert.equal(await page.locator('#allow-generation').isChecked(),false);
 assert.equal(await page.locator('#play-mode').inputValue(),'loops');
 assert.match(await page.locator('.pad').first().innerText(),/LOCAL TEST/);
 await page.locator('.pad').first().click();
 await page.waitForFunction(()=>document.querySelector('#activity-log').textContent.includes('Pad 1 LOCAL TEST playing locally'));
 await page.waitForTimeout(250);
 const playing=await page.locator('#output').evaluate(v=>({time:v.currentTime,width:v.videoWidth,paused:v.paused,source:v.src}));
 assert.equal(playing.width,320);assert.equal(playing.paused,false);assert.ok(playing.time>0);
 // Play a second pad, then return: exercise the normal two-deck fade path.
 await page.locator('#edit-pad').selectOption('1');
 await page.locator('#pad-clip').setInputFiles({name:'original.webm',mimeType:'video/webm',buffer:Buffer.from(original)});
 await page.locator('.pad').nth(1).click();
 await page.waitForFunction(()=>document.querySelectorAll('.pad')[1].getAttribute('aria-pressed')==='true');
 await page.locator('.pad').first().click();
 await page.waitForFunction(()=>document.querySelector('.pad').getAttribute('aria-pressed')==='true');
 // Pad selection for editing and pad playback are separate: select Pad 1 for download.
 await page.locator('#edit-pad').selectOption('0');
 assert.match(await page.locator('#download-take').innerText(),/Pad 1 test clip/);
 await page.locator('#download-take').click();
 await page.waitForTimeout(500);
 assert.equal(downloads.length,2);
 const video=downloads.find(d=>d.suggestedFilename().endsWith('.webm'));
 const record=downloads.find(d=>d.suggestedFilename().endsWith('.json'));
 await video.saveAs(join(artifacts,'downloaded.webm'));
 await record.saveAs(join(artifacts,'downloaded.json'));
 const bytes=fs.readFileSync(join(artifacts,'downloaded.webm'));
 const metadata=JSON.parse(fs.readFileSync(join(artifacts,'downloaded.json'),'utf8'));
 assert.ok(bytes.length>1000);assert.equal(metadata.source,'local-capture-test');assert.equal(metadata.files.image,null);
 // Replay downloaded bytes as a fresh Blob, not the original in-memory source.
 await page.evaluate(async data=>{
  const v=document.createElement('video');v.id='download-verification';v.muted=true;v.playsInline=true;
  v.src=URL.createObjectURL(new Blob([new Uint8Array(data)],{type:'video/webm'}));document.body.append(v);await v.play();
 },Array.from(bytes));
 await page.waitForTimeout(350);
 const downloaded=await page.locator('#download-verification').evaluate(v=>({time:v.currentTime,width:v.videoWidth,paused:v.paused}));
 assert.equal(downloaded.width,320);assert.ok(downloaded.time>0);assert.equal(downloaded.paused,false);
 await page.locator('#test-capture').scrollIntoViewIfNeeded();await page.screenshot({path:join(artifacts,'pad-flow.png')});
 await page.reload();
 await page.waitForFunction(()=>document.querySelector('#activity-log').textContent.includes('App ready'));
 await page.locator('#arrange').click();
 assert.equal(await page.locator('#pad-prompt').inputValue(),'Original authored prompt');
 assert.equal(await page.locator('#clip-name').innerText(),'original.webm');
 assert.equal(await page.locator('#download-take').isDisabled(),true);
 assert.ok(!(await page.locator('.pad').first().innerText()).includes('LOCAL TEST'));
 await page.locator('.pad').first().click();
 await page.waitForFunction(()=>document.querySelector('#status').textContent.includes('original loop — playing'));
 assert.deepEqual(errors,[]);assert.equal(tokens.length,0);assert.equal(external.length,0);
 console.log(JSON.stringify({version:'0.1.5',patternPadPlayback:playing,downloadedPlayback:downloaded,downloadBytes:bytes.length,downloads:downloads.length,crossfade:true,originalAssignmentSurvivedReload:true,tokens:tokens.length,externalRequests:external.length,errors}));
 } finally {await browser?.close();server.close();server.closeAllConnections();fs.rmSync(artifacts,{recursive:true,force:true});}
})().catch(e=>{console.error(e);process.exit(1)});
