declare module "jpeg-js" {
  export function decode(
    data: Buffer | Uint8Array,
    options?: { useTArray?: boolean; formatAsRGBA?: boolean },
  ): { data: Uint8Array; width: number; height: number };
}
