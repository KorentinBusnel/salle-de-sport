import { ImageResponse } from "next/og";
import { Mark } from "@/lib/mark";
import { ogFonts } from "@/lib/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default async function AppleIcon() {
  return new ImageResponse(<Mark size={size.width} rounded={false} />, {
    ...size,
    fonts: [...(await ogFonts())],
  });
}
