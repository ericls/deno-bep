export type TrackerReponse =
  | { "failure reason": string }
  | {
    "warning message"?: string;
    interval: number;
    "min interval"?: number;
    complete?: number;
    incomplete?: number;
    peers: { "peer id"?: string; ip: string; port: number }[] | Uint8Array;
    peers6?: Uint8Array;
  };

export type Peer = {
  peerId: string;
  ip: string;
  port: number;
  ipType: "ipv6" | "ipv4";
};
