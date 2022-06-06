import { assertEquals } from "https://deno.land/std@0.135.0/testing/asserts.ts";
import { expandIpv6, portNumberToByteArray } from "../src/iputils.ts";

Deno.test("expand ipv6", () => {
  assertEquals(
    expandIpv6("2001:4860:4860::8888"),
    "2001:4860:4860:0000:0000:0000:0000:8888",
  );
  assertEquals(expandIpv6("::1"), "0000:0000:0000:0000:0000:0000:0000:0001");
  assertEquals(
    expandIpv6("2404:6800:4003:808::"),
    "2404:6800:4003:0808:0000:0000:0000:0000",
  );
});

Deno.test("pack port number", () => {
  assertEquals(Array.from(portNumberToByteArray(65534)), [255, 254]);
});
