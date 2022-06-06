import {
  dirname,
  fromFileUrl,
  join,
} from "https://deno.land/std@0.135.0/path/mod.ts";
import { benDecode, benEncode } from "../src/bencoding.ts";

const __file = fromFileUrl(import.meta.url);
const ubuntuTorrent = Deno.readFileSync(
  join(dirname(__file), "../tests/ubuntu-20.04.4-desktop-amd64.iso.torrent"),
);
const decodedUbuntuTorrent = benDecode(ubuntuTorrent);

Deno.bench("benDecode ubuntu torrent", () => {
  benDecode(ubuntuTorrent);
});
Deno.bench("benEncode ubuntu torrent", () => {
  benEncode(decodedUbuntuTorrent);
});
