export enum PeerMessageType {
  CHOKE = 0x00,
  UNCHOKE = 0x01,
  INTERESTED = 0x02,
  NOT_INTERESTED = 0x03,
  HAVE = 0x04,
  BITFIELD = 0x05,
  REQUEST = 0x06,
  PIECE = 0x07,
  CANCEL = 0x08,
  PORT = 0x09,
}
