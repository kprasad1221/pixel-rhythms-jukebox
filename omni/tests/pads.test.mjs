import test from 'node:test';
import assert from 'node:assert/strict';
import { defaultPads, presetText, importPresetText, validatePad } from '../src/pads.js';
test('prompt settings round-trip without replacing locally selected media', () => {
  const pads = defaultPads(); const image = new Blob(['image'],{type:'image/png'}); pads[0].image = image;
  const data = presetText(pads); data.pads[0].name='Pillars'; data.pads[0].prompt='An authored call and response.';
  const result = importPresetText(data,pads);
  assert.equal(result.length,10); assert.equal(result[0].name,'Pillars'); assert.equal(result[0].image,image);
  assert.equal(result[9].key,'t');
});
test('bad imports do not partially overwrite the instrument', () => {
  const pads = defaultPads(), data = presetText(pads); data.pads[9].id=0;
  assert.throws(()=>importPresetText(data,pads),/invalid pad/); assert.equal(pads[0].name,'Mountain');
});
test('incomplete reference presets are refused before generation', () => {
  const pad = defaultPads()[0]; assert.throws(()=>validatePad(pad),/prompt/);
  pad.prompt='A phrase'; assert.throws(()=>validatePad(pad),/Krea image/);
  pad.image=new Blob(['image'],{type:'image/png'}); assert.throws(()=>validatePad(pad),/Daydream/);
});
