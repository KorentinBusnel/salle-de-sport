import { ImageResponse } from "next/og";
import { brand, hero, pricing, seo } from "@/content/landing";
import { ogFonts } from "@/lib/og";
import { colors } from "@/lib/tokens";

export const alt = seo.ogAlt;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/** Image Open Graph (1200 × 630) : logo, titre du hero, tarif fondateur. */
export default async function OpenGraphImage() {
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        padding: 72,
        background: colors.background,
        color: colors.foreground,
        fontFamily: "Geist",
      }}
    >
      <div style={{ display: "flex", fontFamily: "Fraunces", fontWeight: 500, fontSize: 56 }}>
        {brand.wordmark}
        <span style={{ color: colors.primary }}>.</span>
      </div>
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          fontFamily: "Fraunces",
          fontSize: 84,
          lineHeight: 1.08,
          letterSpacing: "-0.02em",
          maxWidth: 1000,
        }}
      >
        {hero.title.before}
        <span style={{ fontStyle: "italic", margin: "0 0.22em" }}>{hero.title.emphasis}</span>
        {hero.title.after.trim()}
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
        <div
          style={{
            display: "flex",
            alignItems: "baseline",
            gap: 14,
            padding: "14px 22px",
            borderRadius: 14,
            border: `1px solid ${colors.border}`,
            background: colors.card,
          }}
        >
          <span
            style={{
              fontSize: 20,
              fontWeight: 600,
              letterSpacing: "0.04em",
              textTransform: "uppercase",
              color: colors["muted-foreground"],
            }}
          >
            {pricing.label}
          </span>
          <span style={{ fontSize: 34, fontWeight: 600 }}>{pricing.display}</span>
          <span style={{ fontSize: 24, color: colors["muted-foreground"] }}>{pricing.period}</span>
        </div>
        <span style={{ fontSize: 26, color: colors["muted-foreground"] }}>{brand.domain}</span>
      </div>
    </div>,
    { ...size, fonts: [...(await ogFonts())] },
  );
}
