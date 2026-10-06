import { ImageResponse } from "next/og";
import { Mark } from "@/lib/mark";
import { ogFonts } from "@/lib/og";

export const size = { width: 64, height: 64 };
export const contentType = "image/png";

export default async function Icon() {
  return new ImageResponse(<Mark size={size.width} rounded />, {
    ...size,
    fonts: [...(await ogFonts())],
  });
}
