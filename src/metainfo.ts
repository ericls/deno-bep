import { benDecode } from "./bencoding.ts";

export type MetaInfo = {
  announce: string;
  info: {
    name: string;
    "piece length": number;
    pieces: Uint8Array;
    "announce-list"?: string[][];
  } & ({ files: { length: number; path: string[] }[] } | { length: number });
};

export function metaInfoFromBencode<T extends MetaInfo = MetaInfo>(
  bencodeBytes: Uint8Array,
) {
  const data = benDecode(bencodeBytes, true) as T;
  return data;
}
