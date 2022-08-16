import { fourBytesToPositiveInt, randomStr } from "../utils.ts";
import { BitField } from "./bitfield.ts";
import { PeerMessageType } from "./messageTypes.ts";

const CLIENT_VERSION = "0001";
const INACTIVE_TIMEOUT = 120_000;

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

const PROTOCOL_NAME_BYTES = textEncoder.encode("BitTorrent protocol");

class PeerConnectionHandler {
  amChoking = true;
  amInterested = false;
  peerChoking = true;
  peerInterested = false;

  handshakeComplete = false;

  lastReceivedMessageTs = new Date().getTime();
  inactiveTimeout = INACTIVE_TIMEOUT;

  peerBitField: BitField;

  constructor(
    private client: Client,
    private peerId: string,
    private conn: Deno.Conn,
    private isInitiator: boolean,
    bitFieldSize: number,
  ) {
    this.peerBitField = new BitField(bitFieldSize);
  }

  async handshake() {
    if (this.isInitiator) {
      await this.sendHandshake();
    }
    await this.conn.read(new Uint8Array(4));
    let buf = new Uint8Array(19);
    await this.conn.read(buf);
    if (buf !== PROTOCOL_NAME_BYTES) {
      throw new Error(
        "Protocol name error, the other side doesn't speak bittorrent 1.0",
      );
    }
    buf = new Uint8Array(20);
    await this.conn.read(buf);
    if (buf !== this.client.infoHash) {
      throw new Error("info_hash doesn't match");
    }
    if (!this.isInitiator) {
      await this.sendHandshake();
    }
    buf = new Uint8Array(20);
    await this.conn.read(buf);
    if (textDecoder.decode(buf) !== this.peerId) {
      throw new Error("peer_id doesn't match");
    }
  }

  async readAndComsumeMessage() {
    const lengthBytes = new Uint8Array(4) as Uint8Array & { length: 4 };
    await this.conn.read(lengthBytes);
    this.lastReceivedMessageTs = new Date().getTime();
    const length = fourBytesToPositiveInt(lengthBytes);
    if (length === 0) {
      return;
    }
    const buf = new Uint8Array(length);
    await this.conn.read(buf);
    const messageId = buf.at(0);
    const payload = buf.slice(1);
    switch (messageId) {
      case PeerMessageType.CHOKE: {
        this.peerChoking = true;
        break;
      }
      case PeerMessageType.UNCHOKE: {
        this.peerChoking = false;
        break;
      }
      case PeerMessageType.INTERESTED: {
        this.peerInterested = true;
        break;
      }
      case PeerMessageType.NOT_INTERESTED: {
        this.peerInterested = false;
        break;
      }
      case PeerMessageType.HAVE: {
        this.peerBitField.set(fourBytesToPositiveInt(payload));
        break;
      }
      case PeerMessageType.BITFIELD: {
        this.peerBitField.setFromBytes(payload);
        break;
      }
      case PeerMessageType.REQUEST: {
        const index = fourBytesToPositiveInt(payload.slice(0, 4));
        const begin = fourBytesToPositiveInt(payload.slice(4, 8));
        const length = fourBytesToPositiveInt(payload.slice(8, 12));
        break;
      }
      default:
        throw new Error(`Unknown message_id: ${messageId}`);
    }
  }

  private checkAndDisconnectIfInactive() {
    const ts = new Date().getTime();
    if (ts - this.lastReceivedMessageTs > this.inactiveTimeout) {
      this.close();
    }
  }

  private close() {
    this.conn.close();
  }

  private async sendHandshake() {
    const handshakePayload = new Uint8Array([
      0x13, // length of `PROTOCOL_NAME_BYTES`
      ...PROTOCOL_NAME_BYTES,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      ...this.client.infoHash,
      ...textEncoder.encode(this.client.selfPeerId),
    ]);
    await this.conn.write(handshakePayload);
  }
}

export type ClientProps = {
  selfPeerId?: string;
  infoHash: Uint8Array;
};

export const makePeerId = () => {
  return `-DB${CLIENT_VERSION}${randomStr(13)}`;
};

export class Client {
  selfPeerId: string;
  infoHash: Uint8Array;
  constructor({ selfPeerId, infoHash }: ClientProps) {
    this.selfPeerId = selfPeerId || makePeerId();
    this.infoHash = infoHash;
  }
}
