import { brand } from "@/content/landing";
import { colors } from "@/lib/tokens";

/** Marque carrée (icônes, logo des données structurées) : initiale et point d'action. */
export function Mark({ size, rounded }: { size: number; rounded: boolean }) {
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: colors.foreground,
        borderRadius: rounded ? size * 0.22 : 0,
        color: colors.card,
        fontFamily: "Fraunces",
        fontWeight: 500,
        fontSize: size * 0.72,
        letterSpacing: "-0.03em",
        paddingBottom: size * 0.08,
      }}
    >
      {brand.wordmark.charAt(0)}
      <span style={{ color: colors.primary }}>.</span>
    </div>
  );
}
