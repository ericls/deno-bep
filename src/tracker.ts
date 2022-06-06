// deno-lint-ignore-file require-await
import { ConnInfo, Server } from "https://deno.land/std@0.136.0/http/server.ts";
import * as logger from "https://deno.land/std@0.136.0/log/mod.ts";

import { benEncode } from "./bencoding.ts";
import {
  getIpType,
  ipv4ToByteArray,
  ipv6ToByteArray,
  portNumberToByteArray,
} from "./iputils.ts";

const NOT_FOUND_RESP = new Response("Not found", { status: 404 });

export type Peer = {
  peerId: string;
  ip: string;
  port: number;
  ipType: "ipv6" | "ipv4";
};

export interface TrackerStorage {
  addOrUpdatePeer(
    req: Pick<AnnounceRequest, "infoHash" | "ip" | "port" | "peerId">,
  ): Promise<void>;
  removePeer(req: Pick<AnnounceRequest, "infoHash" | "peerId">): Promise<void>;
  getPeers(infoHash: string, excludePeerId?: string): Promise<Peer[]>;
}

export class InMemoryTrackerStorage implements TrackerStorage {
  peers: { [key: string]: Peer & { count: number } } = {};
  infoHashPeers: { [key: string]: Set<string> } = {};
  addOrUpdatePeer = async (
    req: Pick<AnnounceRequest, "infoHash" | "ip" | "port" | "peerId">,
  ) => {
    const { peerId, infoHash } = req;
    const peer = (this.peers[peerId] ??= {
      peerId: peerId,
      ip: req.ip,
      port: req.port,
      count: 0,
      ipType: getIpType(req.ip),
    });
    if (peer.count !== 0) {
      peer.port = req.port;
      peer.ip = req.ip;
      peer.ipType = getIpType(peer.ip);
    }
    if (!(this.infoHashPeers[infoHash] ??= new Set()).has(peerId)) {
      this.infoHashPeers[infoHash].add(peerId);
      peer.count += 1;
    }
  };
  removePeer = async (req: Pick<AnnounceRequest, "infoHash" | "peerId">) => {
    const { peerId, infoHash } = req;
    if (!(peerId in this.peers)) return;
    const peer = this.peers[peerId];
    const infoHashPeers = this.infoHashPeers[infoHash];
    if (infoHashPeers && infoHashPeers.has(peerId)) {
      infoHashPeers.delete(peer.peerId);
      peer.count -= 1;
      if (infoHashPeers.size === 0) {
        delete this.infoHashPeers[infoHash];
      }
      if (peer.count === 0) {
        delete this.peers[peerId];
      }
    }
  };
  getPeers = async (infoHash: string, excludePeerId: string) => {
    const peers = [];
    if (!(infoHash in this.infoHashPeers)) return [];
    for (const id of this.infoHashPeers[infoHash]) {
      if (id !== excludePeerId) {
        peers.push(this.peers[id]);
      }
    }
    return peers;
  };
}

type AnnounceEvent = "started" | "completed" | "stopped" | "";
const ANNOUNCE_EVENTS = new Set<AnnounceEvent>([
  "started",
  "completed",
  "stopped",
  "",
]);
function isAnnounceEvent(eventStr: string): eventStr is AnnounceEvent {
  return (ANNOUNCE_EVENTS as Set<string>).has(eventStr);
}
type AnnounceRequest = {
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

function announceRequestFromSearchParams(
  params: URLSearchParams,
  connectionIp?: string,
): [error: string, request: null] | [error: null, request: AnnounceRequest] {
  const infoHash = params.get("info_hash");
  const peerId = params.get("peer_id");
  const ip = params.get("ip") || connectionIp;
  const portStr = params.get("port");
  if (!portStr) return ["missing port", null];
  const port = parseInt(portStr, 10);
  const uploadedStr = params.get("uploaded");
  if (!uploadedStr) return ["missing uploaded", null];
  const uploaded = parseInt(uploadedStr, 10);
  const downloadedStr = params.get("downloaded");
  if (!downloadedStr) return ["missing downloaded", null];
  const downloaded = parseInt(downloadedStr, 10);
  const leftStr = params.get("left");
  if (!leftStr) return ["missing left", null];
  const left = parseInt(leftStr, 10);
  const event = params.get("event");
  if (event !== null && !isAnnounceEvent(event)) return ["invalid event", null];
  const compact = params.get("compact") === "1";
  const noPeerId = params.get("no_peer_id") === "1";
  const numWant = params.get("numwant");
  if (!infoHash || !peerId || !ip || !uploaded || !downloaded || !left) {
    return ["missing request keys", null];
  }
  return [null, {
    infoHash,
    peerId,
    ip,
    port,
    uploaded,
    downloaded,
    left,
    event,
    compact,
    noPeerId,
    numWant: numWant ? parseInt(numWant, 10) : null,
  }];
}

async function getAnnounceResponseData(
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
      const peer: typeof peersResp[0] = ({
        ip: p.ip,
        port: p.port,
      });
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
      peersResp.set([
        ...ipv4ToByteArray(peer.ip),
        ...portNumberToByteArray(peer.port),
      ], i * 6);
    }
    peers6Resp = new Uint8Array(ipv6Peers.length * 6);
    for (const [i, peer] of ipv6Peers.entries()) {
      peersResp.set([
        ...ipv6ToByteArray(peer.ip),
        ...portNumberToByteArray(peer.port),
      ], i * 18);
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

type TrackerReponse = { "failure reason": string } | {
  "warning message"?: string;
  interval: number;
  "min interval"?: number;
  complete?: number;
  incomplete?: number;
  peers: ({ "peer id"?: string; ip: string; port: number })[] | Uint8Array;
  peers6?: Uint8Array;
};

type TrackerServerHTTPOptions = {
  port?: number;
  hostname?: string;
  interval?: number;
  makeStorage?: () => TrackerStorage;
};

const DEFAULT_SERVER_OPTIONS: TrackerServerHTTPOptions = {
  port: 8080,
  hostname: "0.0.0.0",
  interval: 10,
} as const;

export class TrackerServerHTTP {
  storage: TrackerStorage;
  constructor(
    private options: TrackerServerHTTPOptions = DEFAULT_SERVER_OPTIONS,
  ) {
    this.storage = this.options.makeStorage?.() || new InMemoryTrackerStorage();
    Object.keys(DEFAULT_SERVER_OPTIONS).forEach((key) => {
      const k = key as keyof typeof DEFAULT_SERVER_OPTIONS;
      if (this.options[k] === undefined) {
        // deno-lint-ignore ban-ts-comment
        // @ts-ignore
        this.options[k] = DEFAULT_SERVER_OPTIONS[k];
      }
    });
  }

  private packTrackerResponse = (
    responseData: TrackerReponse,
    status = 200,
  ) => {
    const encoded = benEncode(responseData);
    const resp = new Response(encoded, {
      status,
      headers: { "content-type": "text/plain" },
    });
    return resp;
  };

  handler = async (req: Request, conn: ConnInfo) => {
    const parsedUrl = new URL(req.url);
    if (parsedUrl.pathname === "/announce") {
      logger.debug(() => "new announce request from: ", conn.remoteAddr);
      const [err, announceReq] = announceRequestFromSearchParams(
        parsedUrl.searchParams,
        (conn.remoteAddr as Deno.NetAddr).hostname,
      );
      if (err !== null) {
        return this.packTrackerResponse({ "failure reason": err }, 400);
      } else {
        const respData = await getAnnounceResponseData(
          announceReq,
          this.storage,
        );
        const resp = this.packTrackerResponse(respData);
        return resp;
      }
    } else if (parsedUrl.pathname === "/scrape") {
      return NOT_FOUND_RESP;
    }
    return NOT_FOUND_RESP;
  };

  listen = () => {
    const server = new Server({
      ...this.options,
      handler: this.handler,
    });
    server.listenAndServe();
    server.addrs.forEach((addr) => {
      if (addr.transport === "tcp") {
        logger.info(() => `Tracker listening: ${addr.hostname}:${addr.port}`);
      }
    });
  };
}
