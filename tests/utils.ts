import {
  ConnInfo,
  Handler,
} from "https://deno.land/std@0.136.0/http/server.ts";

type AnnounceRequestParamKeys =
  | "info_hash"
  | "peer_id"
  | "port"
  | "uploaded"
  | "downloaded"
  | "left"
  | "compact"
  | "event"
  | "num_want";

type AnnounceRequestParams = { [key in AnnounceRequestParamKeys]?: string } & {
  [key: string]: string;
};

const fakeConnInfo: ConnInfo = {
  localAddr: { transport: "tcp", hostname: "host", port: 2 },
  remoteAddr: { transport: "tcp", hostname: "host", port: 2 },
};

export async function makeTrackerRequest(
  handler: Handler,
  path: string,
  params: AnnounceRequestParams | Record<string, string>,
) {
  const query = new URLSearchParams(params);
  const req = new Request(`https://host/${path}?${query}`);
  const resp = await handler(req, fakeConnInfo);
  const reader = resp.body?.getReader()!;
  const body = await reader.read();
  return [resp, body.value!] as const;
}

export async function makeTrackerAnnounceRequest(
  handler: Handler,
  params: AnnounceRequestParams,
) {
  return await makeTrackerRequest(handler, "announce", params);
}
