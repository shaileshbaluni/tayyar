/**
 * pdf.js v5 expects Map/WeakMap.getOrInsertComputed (ES2024).
 * Polyfill for browsers that lack it — must load before pdfjs-dist.
 */
function patchGetOrInsertComputed(proto) {
  if (!proto || proto.getOrInsertComputed) return;
  proto.getOrInsertComputed = function (key, callbackfn) {
    if (this.has(key)) return this.get(key);
    const value = callbackfn(key);
    this.set(key, value);
    return value;
  };
}

patchGetOrInsertComputed(Map.prototype);
patchGetOrInsertComputed(typeof WeakMap !== "undefined" ? WeakMap.prototype : null);
