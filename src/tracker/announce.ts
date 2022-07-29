import {
  ipv4ToByteArray,
  ipv6ToByteArray,
  portNumberToByteArray,
} from "../iputils.ts";
import { TrackerStorage } from "./storage.ts";
import { Peer, TrackerReponse } from "./types.ts";

type AnnounceEvent = "started" | "completed" | "stopped" | "";
const ANNOUNCE_EVENTS = new Set<AnnounceEvent>([
  "started",
  "completed",
  "stopped",
  "",
]);
export function isAnnounceEvent(eventStr: string): eventStr is AnnounceEvent {
  return (ANNOUNCE_EVENTS as Set<string>).has(eventStr);
}
export type AnnounceRequest = {
  infoHash: string;
  peerId: string;
  ip: string;
  port: number;
  uploaded: number;
  downloaded: number;
  left: number;
  event: AnnounceEvent | null;
  compact: boolean | null;
  noPeerId: boolean | null; // No spec?
  numWant: number | null;
};

export async function getAnnounceResponseData(
  announceRequest: AnnounceRequest,
  storage: TrackerStorage,
): Promise<TrackerReponse> {
  if (announceRequest.event !== "stopped") {
    storage.addOrUpdatePeer(announceRequest);
  } else {
    storage.removePeer(announceRequest);
  }
  const interval = 5 * 60;
  let allPeers = await storage.getPeers(
    announceRequest.infoHash,
    announceRequest.peerId,
  );
  if (announceRequest.numWant) {
    allPeers = allPeers.slice(0, announceRequest.numWant);
  }
  let peersResp: Extract<TrackerReponse, { interval: number }>["peers"];
  let peers6Resp:
    | Extract<TrackerReponse, { interval: number }>["peers6"]
    | null = null;
  if (!announceRequest.compact) {
    peersResp = allPeers.map((p) => {
      const peer: typeof peersResp[0] = {
        ip: p.ip,
        port: p.port,
      };
      if (!announceRequest.noPeerId) {
        peer["peer id"] = p.peerId;
      }
      return peer;
    });
  } else {
    const ipv4Peers: Peer[] = [];
    const ipv6Peers: Peer[] = [];
    for (const peer of allPeers) {
      if (peer.ipType === "ipv4") {
        ipv4Peers.push(peer);
      } else {
        ipv6Peers.push(peer);
      }
    }
    peersResp = new Uint8Array(ipv4Peers.length * 6);
    for (const [i, peer] of ipv4Peers.entries()) {
      peersResp.set(
        [...ipv4ToByteArray(peer.ip), ...portNumberToByteArray(peer.port)],
        i * 6,
      );
    }
    peers6Resp = new Uint8Array(ipv6Peers.length * 18);
    for (const [i, peer] of ipv6Peers.entries()) {
      peers6Resp.set(
        [...ipv6ToByteArray(peer.ip), ...portNumberToByteArray(peer.port)],
        i * 18,
      );
    }
  }
  const data: TrackerReponse = {
    interval,
    peers: peersResp,
  };
  if (peers6Resp) {
    data["peers6"] = peers6Resp;
  }
  return data;
}
