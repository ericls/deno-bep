import { assertEquals } from "https://deno.land/std@0.135.0/testing/asserts.ts";
import {
  InMemoryTrackerStorage,
  TrackerServerHTTP,
  TrackerStorage,
} from "../src/tracker/index.ts";
import { benDecode } from "../src/bencoding.ts";

import { makeTrackerAnnounceRequest } from "./utils.ts";

interface TrackerStorageConstructor {
  new (): TrackerStorage;
}

function testTrackerStorageClass(cls: TrackerStorageConstructor) {
  const storage = new cls();
  const peerA = { ip: "127.0.0.1", port: 65534, peerId: "A" } as const;
  const peerB = { ip: "127.0.0.2", port: 65533, peerId: "B" } as const;
  Deno.test(`Storage Test Suite: [${cls.name}] can add peer`, async () => {
    await storage.addOrUpdatePeer({ ...peerA, infoHash: "foo" });
    await storage.addOrUpdatePeer({ ...peerA, infoHash: "foo" }); // test handling duplicated add
    await storage.addOrUpdatePeer({ ...peerA, infoHash: "bar" });
    await storage.addOrUpdatePeer({ ...peerB, infoHash: "foo" });
    assertEquals(await storage.getPeers("foo"), [
      {
        ...peerA,
        ipType: "ipv4",
        count: 2,
      },
      {
        ...peerB,
        ipType: "ipv4",
        count: 1,
      },
    ]);
  });
  Deno.test(`Storage Test Suite: [${cls.name}] can remove peer`, async () => {
    await storage.removePeer({ ...peerA, infoHash: "foo" });
    assertEquals(await storage.getPeers("foo"), [
      {
        ...peerB,
        ipType: "ipv4",
        count: 1,
      },
    ]);
    assertEquals(await storage.getPeers("bar"), [
      {
        ...peerA,
        ipType: "ipv4",
        count: 1,
      },
    ]);
  });
  Deno.test(`Storage Test Suite: [${cls.name}] can update peer`, async () => {
    await storage.addOrUpdatePeer({ ...peerA, infoHash: "bar", port: 1111 });
    assertEquals(await storage.getPeers("bar"), [
      {
        ...peerA,
        ipType: "ipv4",
        count: 1,
        port: 1111,
      },
    ]);
  });
}

testTrackerStorageClass(InMemoryTrackerStorage);

Deno.test("Tracker returns 400 when request is malformed", async () => {
  const server = new TrackerServerHTTP();
  const [_resp, body] = await makeTrackerAnnounceRequest(server.handler, {});
  // deno-lint-ignore no-explicit-any
  const data = benDecode(body, true) as any;
  assertEquals(Boolean(data["failure reason"]), true);
});

Deno.test("Tracker can return peers, dict format", async () => {
  const storage = new InMemoryTrackerStorage();
  const server = new TrackerServerHTTP({ makeStorage: () => storage });
  const infoHash = "foo";
  const peerA = { ip: "127.0.0.1", port: 65534, peerId: "A" } as const;
  await storage.addOrUpdatePeer({ ...peerA, infoHash });
  const [_resp, body] = await makeTrackerAnnounceRequest(server.handler, {
    info_hash: infoHash,
    peer_id: "B",
    port: "1",
    uploaded: "1",
    downloaded: "1",
    left: "1",
  });
  // deno-lint-ignore no-explicit-any
  const data = benDecode(body, true) as any;
  assertEquals(data.peers.length, 1);
});

Deno.test("Tracker can handle stop event", async () => {
  const storage = new InMemoryTrackerStorage();
  const server = new TrackerServerHTTP({ makeStorage: () => storage });
  const infoHash = "foo";
  const peerA = { ip: "127.0.0.1", port: 65534, peerId: "A" } as const;
  await storage.addOrUpdatePeer({ ...peerA, infoHash });
  let [_resp, body] = await makeTrackerAnnounceRequest(server.handler, {
    info_hash: infoHash,
    peer_id: "A",
    port: "1",
    uploaded: "1",
    downloaded: "1",
    left: "1",
    event: "stopped",
  });
  // deno-lint-ignore no-explicit-any
  let data = benDecode(body, true) as any;
  assertEquals(data.peers.length, 0);
  [_resp, body] = await makeTrackerAnnounceRequest(server.handler, {
    info_hash: infoHash,
    peer_id: "B",
    port: "1",
    uploaded: "1",
    downloaded: "1",
    left: "1",
  });
  // deno-lint-ignore no-explicit-any
  data = benDecode(body, true) as any;
  assertEquals(data.peers.length, 0);
});

Deno.test("Tracker can return peers, compact format", async () => {
  const storage = new InMemoryTrackerStorage();
  const server = new TrackerServerHTTP({ makeStorage: () => storage });
  const infoHash = "foo";
  const peerA = { ip: "127.0.0.1", port: 65534, peerId: "A" } as const;
  await storage.addOrUpdatePeer({ ...peerA, infoHash });
  const [_resp, body] = await makeTrackerAnnounceRequest(server.handler, {
    info_hash: infoHash,
    peer_id: "B",
    port: "1",
    uploaded: "1",
    downloaded: "1",
    left: "1",
    compact: "1",
  });
  // deno-lint-ignore no-explicit-any
  const data = benDecode(body) as any;
  assertEquals(storage.peers["A"].port, 65534);
  assertEquals(Array.from(data.peers), [127, 0, 0, 1, 255, 254]);
});

Deno.test("Tracker can return peers, IPv6 compact format", async () => {
  const storage = new InMemoryTrackerStorage();
  const server = new TrackerServerHTTP({ makeStorage: () => storage });
  const infoHash = "foo";
  const peerA = {
    ip: "2001:4860:4860::8888",
    port: 65534,
    peerId: "A",
  } as const;
  await storage.addOrUpdatePeer({ ...peerA, infoHash });
  assertEquals(storage.peers["A"].port, 65534);
  const [_resp, body] = await makeTrackerAnnounceRequest(server.handler, {
    info_hash: infoHash,
    peer_id: "B",
    port: "1",
    uploaded: "1",
    downloaded: "1",
    left: "1",
    compact: "1",
  });
  // deno-lint-ignore no-explicit-any
  const data = benDecode(body) as any;
  assertEquals(
    Array.from(data.peers6),
    [32, 1, 72, 96, 72, 96, 0, 0, 0, 0, 0, 0, 0, 0, 136, 136, 255, 254],
  );
});
