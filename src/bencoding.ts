import { BaseError } from "./error.ts";

export type BencodeData =
  | BencodeData[]
  | {
    [key: string]: BencodeData;
  }
  | number
  | string
  | BigInt
  | Uint8Array;

class BenEncodeError extends BaseError {}
class BenDecodeError extends BaseError {}

const textDecoder = new TextDecoder("utf-8", { fatal: true });
const textEncoder = new TextEncoder();

const e_BYTE = textEncoder.encode("e").at(0)!;
const i_BYTE = textEncoder.encode("i").at(0)!;
const l_BYTE = textEncoder.encode("l").at(0)!;
const d_BYTE = textEncoder.encode("d").at(0)!;
const COL_BYTE = textEncoder.encode(":").at(0)!;

const MAX_INTEGER_DIGITS = Number.MAX_SAFE_INTEGER.toString().length;

function concatByteArrays(
  byteArrays: Uint8Array[],
) {
  const totalLength = byteArrays.reduce((acc, value) => acc + value.length, 0);

  if (byteArrays.length === 0) return new Uint8Array(0);

  const result = new Uint8Array(totalLength);

  let copied = 0;
  for (const byteArray of byteArrays) {
    result.set(byteArray, copied);
    copied += byteArray.length;
  }

  return result;
}

const DIGITS_BYTES = new Set(
  [..."1234567890"].map((d) => textEncoder.encode(d).at(0)!),
);

function _encodeStr(str: string) {
  return textEncoder.encode(`${str.length}:${str}`);
}

function _encodeBigInt(big: BigInt) {
  return textEncoder.encode(`i${big.toString()}e`);
}

function _encodeBytes(bytes: Uint8Array) {
  const lengthBytes = textEncoder.encode(bytes.length.toString());
  return concatByteArrays([lengthBytes, Uint8Array.of(COL_BYTE), bytes]);
}

function _encodeInt(int: number) {
  if (!Number.isInteger(int)) {
    throw new BenEncodeError(`value ${int} is not an integer`);
  }
  return textEncoder.encode(`i${int}e`);
}

function _encodeList(input: BencodeData[]) {
  const items = input.map((item) => _benEncode(item));
  const itemsBytes = concatByteArrays(items);
  const res = new Uint8Array(itemsBytes.length + 2);
  res.set([l_BYTE], 0);
  res.set(itemsBytes, 1);
  res.set([e_BYTE], itemsBytes.length + 1);
  return res;
}

function _encodeDict(input: { [key: string]: BencodeData }) {
  const entries = Object.entries(input).flatMap((
    [k, v],
  ) => [_encodeStr(k), _benEncode(v)]);
  const entryBytes = concatByteArrays(entries);
  const res = new Uint8Array(entryBytes.length + 2);
  res.set([d_BYTE], 0);
  res.set(entryBytes, 1);
  res.set([e_BYTE], entryBytes.length + 1);
  return res;
}

export function _benEncode(input: BencodeData): Uint8Array {
  if (Array.isArray(input)) {
    return _encodeList(input);
  } else if (input instanceof Uint8Array) {
    return _encodeBytes(input);
  } else if (input instanceof BigInt || typeof input === "bigint") {
    return _encodeBigInt(input);
  } else if (typeof input === "object") {
    return _encodeDict(input);
  } else if (typeof input === "string") {
    return _encodeStr(input);
  } else if (Number.isInteger(input)) {
    return _encodeInt(input);
  }
  throw new BenEncodeError("unknown value: " + input);
}

export function benEncode(input: BencodeData, decodeResult: true): string;
export function benEncode(input: BencodeData, decodeResult?: false): Uint8Array;
export function benEncode(input: BencodeData, decodeResult = false) {
  const res = _benEncode(input);
  if (decodeResult) return textDecoder.decode(res);
  return res;
}

function _benDecode(
  input: Uint8Array,
  pos = 0,
  decodeText = false,
): [BencodeData, number] {
  const fisrtByte = input[pos];
  if (fisrtByte === i_BYTE) {
    let nPos = pos + 1;
    const start = nPos;
    while (input.at(nPos)! !== e_BYTE) {
      nPos += 1;
    }
    const nDigits = nPos - start;
    const value = (() => {
      const digits = textDecoder.decode(input.slice(start, nPos));
      if (nDigits < MAX_INTEGER_DIGITS) {
        return parseInt(digits);
      } else if (nDigits > MAX_INTEGER_DIGITS) {
        return BigInt(digits);
      } else {
        const v = BigInt(digits);
        if (v < Number.MAX_SAFE_INTEGER) {
          return Number(v);
        }
        return v;
      }
    })();
    return [
      value,
      nPos + 1,
    ];
  } else if (fisrtByte === l_BYTE) {
    const value = [];
    let nPos = pos + 1;
    while (input.at(nPos) !== e_BYTE) {
      const [item, afterPos] = _benDecode(input, nPos, decodeText);
      value.push(item);
      nPos = afterPos;
    }
    return [value, nPos + 1];
  } else if (fisrtByte === d_BYTE) {
    const value: BencodeData = {};
    let nPos = pos + 1;
    while (input.at(nPos)! !== e_BYTE) {
      const [key, p1] = _benDecode(input, nPos, true);
      const [v, afterPos] = _benDecode(input, p1, decodeText);
      nPos = afterPos;
      value[key as string] = v;
    }
    return [value, nPos + 1];
  } else if (DIGITS_BYTES.has(fisrtByte)) {
    const digitsStart = pos;
    let nPos = pos + 1;
    while (input.at(nPos)! !== COL_BYTE) {
      nPos += 1;
    }
    const length = parseInt(
      textDecoder.decode(input.slice(digitsStart, nPos)),
      10,
    );
    const endPos = nPos + 1 + length;
    let value: Uint8Array | string = input.slice(nPos + 1, endPos);
    if (decodeText) {
      try {
        value = textDecoder.decode(value);
      } catch (_e) {
        // ignore
      }
    }
    return [value, endPos];
  }
  throw new BenDecodeError(
    "unknown input type at postion " + pos.toString() + ": " + input.slice(pos),
  );
}

export function benDecode(input: string | Uint8Array, decodeText = false) {
  const [value, pos] = _benDecode(
    input instanceof Uint8Array ? input : textEncoder.encode(input),
    0,
    decodeText,
  );
  if (pos === input.length) return value;
  throw new BenDecodeError(
    `Error at postion ${pos}`,
  );
}
