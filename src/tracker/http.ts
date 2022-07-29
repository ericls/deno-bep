import { ConnInfo, Server } from "https://deno.land/std@0.136.0/http/server.ts";

import * as logger from "https://deno.land/std@0.136.0/log/mod.ts";
import { benEncode } from "../bencoding.ts";
import {
  AnnounceRequest,
  getAnnounceResponseData,
  isAnnounceEvent,
} from "./announce.ts";
import { InMemoryTrackerStorage, TrackerStorage } from "./storage.ts";
import { TrackerReponse } from "./types.ts";

const NOT_FOUND_RESP = new Response("Not found", { status: 404 });

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
  return [
    null,
    {
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
    },
  ];
}

export type TrackerServerHTTPOptions = {
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
      const value = DEFAULT_SERVER_OPTIONS[k];
      if (value === undefined) {
        this.options[k] = value;
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
