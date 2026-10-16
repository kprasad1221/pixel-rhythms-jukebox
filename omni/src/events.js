// Match asynchronous completions to the actual clip, including a fast result
// that arrives before the caller has registered its waiter.
export class ClipEvents {
  constructor() { this.messages = new Map(); this.waiters = new Set(); this.closed = null; }
  push(message) {
    const id = message?.data?.clip?.clip_id;
    if (!id) return;
    this.messages.set(`${message.type}:${id}`, message.data);
    if (this.messages.size > 80) this.messages.delete(this.messages.keys().next().value);
    for (const waiter of [...this.waiters]) waiter.check();
  }
  wait(type, id, timeout = 180000) {
    if (this.closed) return Promise.reject(this.closed);
    return new Promise((resolve, reject) => {
      let timer;
      const finish = (error, data) => { clearTimeout(timer); this.waiters.delete(waiter); error ? reject(error) : resolve(data); };
      const waiter = { reject: error => finish(error), check: () => {
        const failed = this.messages.get(`clip_failed:${id}`);
        if (failed) return finish(new Error(failed.reason || 'Generation failed.'));
        const data = this.messages.get(`${type}:${id}`);
        if (data) finish(null, data);
      } };
      this.waiters.add(waiter);
      timer = setTimeout(() => finish(new Error('Reactor took too long. End the session and try again.')), timeout);
      waiter.check();
    });
  }
  close(message = 'Session ended.') {
    this.closed = new Error(message);
    for (const waiter of [...this.waiters]) waiter.reject(this.closed);
  }
}
