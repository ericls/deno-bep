import { assertEquals } from "https://deno.land/std@0.135.0/testing/asserts.ts";
import {
  dirname,
  fromFileUrl,
  join,
} from "https://deno.land/std@0.135.0/path/mod.ts";
import { BencodeData, benDecode, benEncode } from "../src/bencoding.ts";

Deno.test("benEncode str", () => {
  const input = "foo";
  assertEquals(benEncode(input, true), "3:foo");
  assertEquals(benEncode("", true), "0:");
  assertEquals(
    benEncode("foofoofoofoofoofoofoofoofoofoo", true),
    "30:foofoofoofoofoofoofoofoofoofoo",
  );
});
Deno.test("benEncode bytes", () => {
  assertEquals(benEncode(Uint8Array.of(97, 98, 99), true), "3:abc");
  assertEquals(
    benEncode({ a: { b: Uint8Array.of(1, 2, 3) } }),
    new Uint8Array([
      100,
      49,
      58,
      97,
      100,
      49,
      58,
      98,
      51,
      58,
      1,
      2,
      3,
      101,
      101,
    ]),
  );
});
Deno.test("benEncode int", () => {
  let input = 1;
  assertEquals(benEncode(input, true), "i1e");
  input = 0;
  assertEquals(benEncode(input, true), "i0e");
  input = -1;
  assertEquals(benEncode(input, true), "i-1e");
  const big = 1267650600228229401496703205377n;
  assertEquals(benEncode(big, true), "i1267650600228229401496703205377e");
});

Deno.test("benEncode list", () => {
  let input: BencodeData = ["spam", "eggs"];
  assertEquals(benEncode(input, true), "l4:spam4:eggse");
  input = [1, "a"];
  assertEquals(benEncode(input, true), "li1e1:ae");
});

Deno.test("benEncode dict", () => {
  const input = { spam: ["a", "b", 1] };
  assertEquals(benEncode(input, true), "d4:spaml1:a1:bi1eee");
});

Deno.test("benEncode dict nested", () => {
  const input = { spam: ["a", "b", 1, { key: [1, 200, { key: [2, 3] }] }] };
  assertEquals(
    benEncode(input, true),
    "d4:spaml1:a1:bi1ed3:keyli1ei200ed3:keyli2ei3eeeeeee",
  );
});

Deno.test("benDecode int", () => {
  assertEquals(benDecode("i1e"), 1);
  assertEquals(benDecode("i0e"), 0);
  assertEquals(benDecode("i-1e"), -1);
  assertEquals(
    benDecode("i1267650600228229401496703205377e"),
    1267650600228229401496703205377n,
  );
});

Deno.test("benDecode str", () => {
  assertEquals(benDecode("3:foo", true), "foo");
  assertEquals(benDecode("0:", true), "");
  assertEquals(
    benDecode("30:foofoofoofoofoofoofoofoofoofoo", true),
    "foofoofoofoofoofoofoofoofoofoo",
  );
});

Deno.test("benDecode list", () => {
  assertEquals(benDecode("l4:spam4:eggse", true), ["spam", "eggs"]);
  assertEquals(benDecode("li1e1:ae", true), [1, "a"]);
});

Deno.test("benDecode dict", () => {
  assertEquals(benDecode("d4:spaml1:a1:bi1eee", true), { spam: ["a", "b", 1] });
});

Deno.test("benDecode dict nested", () => {
  assertEquals(
    benDecode("d4:spaml1:a1:bi1ed3:keyli1ei200ed3:keyli2ei3eeeeeee", true),
    { spam: ["a", "b", 1, { key: [1, 200, { key: [2, 3] }] }] },
  );
});

const __file = fromFileUrl(import.meta.url);
const ubuntuTorrent = Deno.readFileSync(
  join(dirname(__file), "./ubuntu-20.04.4-desktop-amd64.iso.torrent"),
);
const decodedUbuntuTorrent = benDecode(ubuntuTorrent);

Deno.test("benDecode ubuntu torrent", () => {
  // deno-lint-ignore no-explicit-any
  const data = benDecode(ubuntuTorrent, true) as any;
  assertEquals(data["info"]["piece length"], 262144);
  assertEquals(data["creation date"], 1645734650);
  assertEquals(data["announce"], "https://torrent.ubuntu.com/announce");
});

Deno.test("benDecode/benEncode", () => {
  const reEncoded = benEncode(decodedUbuntuTorrent);
  assertEquals(benDecode(reEncoded), benDecode(ubuntuTorrent));
});
