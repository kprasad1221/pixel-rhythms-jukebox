const dbPromise = new Promise((resolve, reject) => {
  const request = indexedDB.open('pixel-rhythms-omni-v1', 1);
  request.onupgradeneeded = () => request.result.createObjectStore('pads', { keyPath: 'id' });
  request.onsuccess = () => resolve(request.result);
  request.onerror = () => reject(request.error);
});
export async function loadPads(defaults) {
  const db = await dbPromise;
  return new Promise((resolve, reject) => {
    const request = db.transaction('pads').objectStore('pads').getAll();
    request.onsuccess = () => resolve(defaults.map(pad => ({ ...pad, ...request.result.find(saved => saved.id === pad.id) })));
    request.onerror = () => reject(request.error);
  });
}
export async function savePads(pads) {
  const db = await dbPromise;
  return new Promise((resolve, reject) => {
    const transaction = db.transaction('pads', 'readwrite');
    pads.forEach(pad => transaction.objectStore('pads').put(pad));
    transaction.oncomplete = resolve;
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(transaction.error || new Error('Saving was interrupted.'));
  });
}
