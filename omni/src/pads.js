export const DURATIONS = [5.875, 8, 10.125, 12.25, 14.375];
export const KEYS = ['1','2','3','4','5','q','w','e','r','t'];
export function defaultPads() {
  const worlds = ['Mountain', 'Car', 'Glacier', 'Tree', 'Ocean'];
  return KEYS.map((key, i) => ({ id: i, key, name: worlds[i % 5], group: i < 5 ? 'Scene' : 'Party', prompt: '', seconds: 8, image: null, audio: null, clip: null }));
}
export function validatePad(pad) {
  if (!pad.prompt?.trim()) throw new Error('Add a prompt for this pad.');
  if (!pad.image) throw new Error('Choose this pad’s Krea image.');
  if (!pad.audio) throw new Error('Choose this pad’s Daydream audio reference.');
  if (!DURATIONS.includes(pad.seconds)) throw new Error('Choose a supported clip length.');
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(pad.image.type)) throw new Error('Use a JPEG, PNG, or WebP image.');
  for (const file of [pad.image, pad.audio]) if (file.size > 25 * 1024 * 1024) throw new Error('Each reference must be 25 MiB or smaller.');
  return true;
}
export function promptFor(pad) {
  return `${pad.prompt.trim()}\n\n<Picture 1> is the visual reference for this passage. <Audio 1> is the music reference; use it to guide the generated soundtrack.`;
}
export function presetText(pads) {
  return { version: 1, pads: pads.map(({ id, name, group, prompt, seconds, image, audio, clip }) => ({ id, name, group, prompt, seconds, files: { image: image?.name ?? null, audio: audio?.name ?? null, clip: clip?.name ?? null } })) };
}
export function importPresetText(data, pads) {
  if (data?.version !== 1 || !Array.isArray(data.pads) || data.pads.length !== 10) throw new Error('Choose a ten-pad preset exported by this app.');
  const ids = new Set();
  for (const item of data.pads) {
    if (!Number.isInteger(item.id) || item.id < 0 || item.id > 9 || ids.has(item.id) || typeof item.name !== 'string' || typeof item.prompt !== 'string' || !DURATIONS.includes(item.seconds)) throw new Error('This preset has an invalid pad.');
    ids.add(item.id);
  }
  return pads.map(pad => { const item = data.pads.find(item => item.id === pad.id); return { ...pad, name: item.name.slice(0,60), group: String(item.group ?? '').slice(0,40), prompt: item.prompt, seconds: item.seconds }; });
}
