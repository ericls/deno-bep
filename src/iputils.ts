interface IPV4Array extends Uint8Array {
  length: 4;
}

interface IPV6Array extends Uint8Array {
  length: 16;
}

interface PortArray extends Uint8Array {
  length: 2;
}

export function ipv4ToByteArray(ipv4: string): IPV4Array {
  const arr = new Uint8Array(ipv4.split(".").map((seg) => parseInt(seg, 10)));
  return arr as IPV4Array;
}

export function portNumberToByteArray(port: number): PortArray {
  const arr = new Uint8Array(2);
  arr[0] = Math.floor(port / 0x100);
  arr[1] = port % 0x100;
  return arr as PortArray;
}

export function getIpType(ip: string): "ipv6" | "ipv4" {
  if (ip.includes(":")) return "ipv6";
  return "ipv4";
}

export function expandIpv6(ipv6: string): string {
  const [left, right] = ipv6.split("::", 2);
  const leftSegments = left.split(":").filter(Boolean);
  const rightSegments = right.split(":").filter(Boolean);
  const numRem = 8 - (leftSegments.length + rightSegments.length);
  if (numRem === 0) return ipv6;
  let str = leftSegments.map((i) => i.padStart(4, "0")).join(":") +
    ":" +
    Array.from({ length: numRem }).fill("0000").join(":") +
    ":" +
    rightSegments.map((i) => i.padStart(4, "0")).join(":");
  if (str[0] === ":") {
    str = str.substring(1);
  }
  if (str[str.length - 1] == ":") {
    str = str.substring(0, str.length - 1);
  }
  return str;
}

export function ipv6ToByteArray(ipv6: string): IPV6Array {
  const arr = new Uint8Array(
    expandIpv6(ipv6)
      .split(":")
      .flatMap((seg) => {
        const int = parseInt(seg, 16);
        return [Math.floor(int / 0x100), int % 0x100];
      }),
  );
  return arr as IPV6Array;
}
