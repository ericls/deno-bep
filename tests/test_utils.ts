import { assertEquals } from "https://deno.land/std@0.135.0/testing/asserts.ts";
import { iterableEq } from "../src/utils.ts";

Deno.test("test iterableEq", () => {
  assertEquals(iterableEq([1, 2, 3], [1, 2, 3]), true);
  assertEquals(iterableEq([1, 2, 3], [1, 2]), false);
  assertEquals(iterableEq([1, 2], [1, 2, 3]), false);
  assertEquals(iterableEq([1, 2, 3], [1, 2, 4]), false);
  assertEquals(iterableEq([], [1, 2, 4]), false);
  assertEquals(iterableEq([1, 2, 3], []), false);
  assertEquals(iterableEq([], []), true);
  assertEquals(
    iterableEq(new Uint8Array([1, 2, 3]), new Uint8Array([1, 2, 3])),
    true
  );
  assertEquals(
    iterableEq(new Uint8Array([1, 2, 3, 4]), new Uint8Array([1, 2, 3, 5])),
    false
  );
});
