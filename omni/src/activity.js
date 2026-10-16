// Only pass short descriptions, never raw SDK replies, upload references or tokens.
export function safeLogText(value) {
  return String(value)
    .replace(/https?:\/\/[^\s]+/g, '[URL omitted]')
    .replace(/\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g, '[token omitted]')
    .replace(/((?:api[_-]?key|jwt|token|authorization)\s*[:=]\s*)\S+/gi, '$1[omitted]')
    .slice(0, 1200);
}
export function createActivity(list) {
  const lines = [];
  return {
    add(stage, message, level = 'info', context = '') {
      const line = `${new Date().toISOString()} [${stage}]${context ? ` ${safeLogText(context)} ·` : ''} ${safeLogText(message)}`;
      lines.unshift(line); if (lines.length > 200) lines.pop();
      const row = document.createElement('li'); row.textContent = line; row.dataset.level = level;
      list.prepend(row); if (list.children.length > 200) list.lastElementChild.remove();
    },
    text: () => lines.join('\n'),
  };
}
