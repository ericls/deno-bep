import { assertEquals } from "https://deno.land/std@0.135.0/testing/asserts.ts";
import {
  expandIpv6,
  ipv4ToByteArray,
  ipv6ToByteArray,
  portNumberToByteArray,
} from "../src/iputils.ts";

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

Deno.test("pack ipv6", () => {
  assertEquals(
    Array.from(ipv6ToByteArray("fafb::8888")),
    [250, 251, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 136, 136],
  );
  assertEquals(
    Array.from(ipv6ToByteArray("2001:4860:4860::8888")),
    [32, 1, 72, 96, 72, 96, 0, 0, 0, 0, 0, 0, 0, 0, 136, 136],
  );
});

Deno.test("pack ipv4", () => {
  assertEquals(Array.from(ipv4ToByteArray("127.0.0.1")), [127, 0, 0, 1]);
  assertEquals(
    Array.from(ipv4ToByteArray("255.254.254.0")),
    [255, 254, 254, 0],
  );
});
