import { expandIpv6 } from "../src/iputils.ts";

Deno.bench("expand ipv6", () => {
  expandIpv6("::");
});
