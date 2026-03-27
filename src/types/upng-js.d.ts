declare module "upng-js" {
  function encode(
    imgs: ArrayBuffer[],
    w: number,
    h: number,
    cnum: number,
  ): ArrayBuffer;
  function decode(buffer: ArrayBuffer): {
    width: number;
    height: number;
    depth: number;
    ctype: number;
    data: ArrayBuffer;
    tabs: Record<string, unknown>;
    frames: Array<{ rect: { x: number; y: number; width: number; height: number }; delay: number; dispose: number; blend: number }>;
  };
  function toRGBA8(img: ReturnType<typeof decode>): ArrayBuffer[];
  export default { encode, decode, toRGBA8 };
}
