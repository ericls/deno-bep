// deno-lint-ignore-file require-await

import { getIpType } from "../iputils.ts";
import { AnnounceRequest } from "./announce.ts";
import { Peer } from "./types.ts";

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
