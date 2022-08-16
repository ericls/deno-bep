const RAND_CHARS = "0123456789" as const;

export function randomStr(length: number, dictionary = RAND_CHARS) {
  return Array.from({ length })
    .map(() => dictionary[Math.floor(Math.random() * dictionary.length)])
    .join("");
}

export function iterableEq<T>(
  a: { [Symbol.iterator](): Iterator<T>; length?: number },
  b: { [Symbol.iterator](): Iterator<T>; length?: number }
) {
  if ("length" in a && "length" in b && a.length !== b.length) return false;
  let a_done = false;
  let b_done = false;
  const a_iter = a[Symbol.iterator]();
  const b_iter = b[Symbol.iterator]();
  while (!a_done && !b_done) {
    const a_next = a_iter.next();
    if (a_next.done) {
      a_done = true;
    }
    const b_next = b_iter.next();
    if (b_next.done) {
      b_done = true;
    }
    if (a_next.value !== b_next.value) return false;
    if (a_done && b_done) return true;
  }
  return false;
}

export function fourBytesToPositiveInt(buf: Uint8Array) {
  return buf.reduce((a, c, i) => a + c * 2 ** (24 - i * 8), 0);
}
