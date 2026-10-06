import { ImageResponse } from "next/og";
import { Mark } from "@/lib/mark";
import { ogFonts } from "@/lib/og";

export const dynamic = "force-static";

/** /logo.png (512 × 512) : logo de l'organisation dans les données structurées. */
export async function GET() {
  return new ImageResponse(<Mark size={512} rounded={false} />, {
    width: 512,
    height: 512,
    fonts: [...(await ogFonts())],
  });
}
