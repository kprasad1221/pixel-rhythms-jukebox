// Real canvas pixel checks of the exact composition function shipped in the app.
// These verify blend arithmetic, not HTMLVideoElement playback or browser layout.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { createRequire } from 'node:module';
const require=createRequire(import.meta.url);
const {createCanvas}=require(process.env.TEST_CANVAS_MODULE_PATH||'@napi-rs/canvas');
const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
const script=html.match(/<script>([\s\S]*?)<\/script>/)[1];
const clear=script.slice(script.indexOf('function clear('),script.indexOf('function drawFit('));
const compose=script.slice(script.indexOf('function compose('),script.indexOf('function paint('));
const mix=vm.runInNewContext(clear+'\n'+compose+'\ncompose;');
function source(rgb,weight){const c=createCanvas(8,8),ctx=c.getContext('2d');ctx.fillStyle='black';ctx.fillRect(0,0,8,8);ctx.globalAlpha=weight;ctx.fillStyle=`rgb(${rgb.join(',')})`;ctx.fillRect(0,0,8,8);return c;}
function result(x,mode){const weights=mode==='dissolve'?[1,1]:[Math.min(1,2*(1-x)),Math.min(1,2*x)];const a=source([100,20,30],weights[0]),b=source([10,50,120],weights[1]),out=createCanvas(8,8);mix(out.getContext('2d'),a,b,x,mode);return [...out.getContext('2d').getImageData(4,4,1,1).data].slice(0,3);}
function close(actual,expected){for(let i=0;i<3;i++)assert.ok(Math.abs(actual[i]-expected[i])<=1,`${actual} != ${expected}`);}
test('all blend modes reach exact A and B endpoints',()=>{for(const mode of ['dissolve','lighten','lighter']){close(result(0,mode),[100,20,30]);close(result(1,mode),[10,50,120]);}});
test('Dissolve uses a true half blend at the midpoint',()=>close(result(.5,'dissolve'),[55,35,75]));
test('Brightest retains both decks maximum channel values at the midpoint',()=>close(result(.5,'lighten'),[100,50,120]));
test('Add light adds channel values at the midpoint',()=>close(result(.5,'lighter'),[110,70,150]));
