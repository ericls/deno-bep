import { Sha1 } from "https://deno.land/std@0.136.0/hash/sha1.ts";
import { MetaInfo, metaInfoFromBencode } from "./metainfo.ts";

export class Torrent {
  constructor(public metainfo: MetaInfo, public infoHash: string) {}
  static async fromFile(filePath: string | URL) {
    const fileContent = await Deno.readFile(filePath);
    const metaInfo = metaInfoFromBencode(fileContent);
    const infoHash = new Sha1().update(fileContent).hex();
    return new Torrent(metaInfo, infoHash);
  }
}
