export class BitField {
  private bytes: Uint8Array;
  constructor(initialSize: number) {
    this.bytes = new Uint8Array(initialSize);
  }
  set(index: number) {
    const byteIndex = Math.floor(index / 8);
    if ((byteIndex + 1) > this.bytes.length) {
      // NOTE: possible oom attack
      this.grow(byteIndex + 1 - this.bytes.length);
    }
    const bitOffset = index - byteIndex * 8;
    this.bytes[byteIndex] ^= 0x80 >> bitOffset;
  }
  isSet(index: number): boolean {
    const byteIndex = Math.floor(index / 8);
    if (byteIndex + 1 > this.bytes.length) return false;
    const bitOffset = index - byteIndex * 8;
    return !!(this.bytes[byteIndex] & (0x80 >> bitOffset));
  }
  setFromBytes(bytes: Uint8Array) {
    const newBytes = new Uint8Array(Math.max(this.bytes.length, bytes.length));
    newBytes.set(bytes, 0);
    this.bytes = newBytes;
  }
  pactToBytes() {
    return this.bytes.slice(0);
  }
  private grow(howManyMore = 1024) {
    const newBytes = new Uint8Array(
      // grow by at least 512 bytes to avoid repeated calls
      this.bytes.length + Math.max(howManyMore, 512),
    );
    newBytes.set(this.bytes, 0);
    this.bytes = newBytes;
  }
}
