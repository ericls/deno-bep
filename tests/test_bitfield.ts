import { assertEquals } from "https://deno.land/std@0.135.0/testing/asserts.ts";
import { BitField } from "../src/peerprotocol/bitfield.ts";

Deno.test("BitField tests", () => {
  const bf = new BitField(1);
  bf.set(0);
  assertEquals(bf.pactToBytes().at(0), 0b10000000);
  assertEquals(bf.isSet(0), true);
  for (let i = 1; i < 16; i++) {
    assertEquals(bf.isSet(i), false);
  }
  bf.set(16);
  for (let i = 1; i < 16; i++) {
    assertEquals(bf.isSet(i), false);
  }
  assertEquals(bf.isSet(16), true);
  assertEquals(bf.isSet(17), false);
  bf.set(8192);
  assertEquals(bf.isSet(8192), true);
});
