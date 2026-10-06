import { PDFDocument, rgb, StandardFonts } from "pdf-lib";
import { t } from "@/lib/i18n";

export type ReceiptData = {
  paymentId: string;
  paidAt: string;
  timeZone: string;
  gym: { name: string; address: string | null; email: string | null; phone: string | null };
  member: { name: string; email: string | null };
  label: string;
  promoCode: string | null;
  method: string;
  amount: string;
  refunded: boolean;
};

/** Numéro lisible et stable : date de paiement (heure de la salle) et début de l'identifiant. */
export function receiptNumber(paymentId: string, paidAt: string, timeZone: string): string {
  const day = new Intl.DateTimeFormat("en-CA", { timeZone, dateStyle: "short" })
    .format(new Date(paidAt))
    .replaceAll("-", "");
  return `R-${day}-${paymentId.replaceAll("-", "").slice(0, 8).toUpperCase()}`;
}

// Polices standard du PDF (WinAnsi) : caractères latins, plus ces signes typographiques.
const WIN_ANSI_EXTRA = new Set("€‚ƒ„…†‡ˆ‰Š‹ŒŽ‘’“”•–—˜™š›œžŸ");

/** Texte encodable par les polices standard (espaces fines d'Intl → espace simple). */
export function pdfText(text: string): string {
  return [...text.replace(/[   ]/g, " ")]
    .map((c) => (c.charCodeAt(0) <= 0xff || WIN_ANSI_EXTRA.has(c) ? c : "?"))
    .join("");
}

/** Reçu de paiement A4 : salle, adhérent, ligne payée, montant, moyen de paiement. */
export async function buildReceipt(data: ReceiptData): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const number = receiptNumber(data.paymentId, data.paidAt, data.timeZone);
  pdf.setTitle(pdfText(`${t("receipt.title")} ${number}`));
  pdf.setAuthor(pdfText(data.gym.name));
  const page = pdf.addPage([595.28, 841.89]);
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const ink = rgb(0.1, 0.1, 0.12);
  const muted = rgb(0.42, 0.42, 0.46);
  const left = 56;
  const right = 595.28 - 56;
  let y = 841.89 - 64;

  const write = (
    text: string,
    options: { size?: number; font?: typeof regular; color?: typeof ink; x?: number } = {},
  ) => {
    const size = options.size ?? 10.5;
    page.drawText(pdfText(text), {
      x: options.x ?? left,
      y,
      size,
      font: options.font ?? regular,
      color: options.color ?? ink,
    });
    y -= size * 1.5;
  };
  const writeRight = (text: string, size: number, font = regular) => {
    const safe = pdfText(text);
    page.drawText(safe, {
      x: right - font.widthOfTextAtSize(safe, size),
      y,
      size,
      font,
      color: ink,
    });
  };

  // Émetteur
  write(data.gym.name, { size: 16, font: bold });
  for (const line of [data.gym.address, data.gym.phone, data.gym.email])
    if (line) write(line, { color: muted });

  // Titre et références
  y -= 24;
  write(t("receipt.title"), { size: 20, font: bold });
  const date = new Intl.DateTimeFormat("fr-FR", {
    timeZone: data.timeZone,
    dateStyle: "long",
    timeStyle: "short",
  }).format(new Date(data.paidAt));
  write(t("receipt.number", { number }), { color: muted });
  write(t("receipt.date", { date }), { color: muted });

  // Adhérent
  y -= 16;
  write(t("receipt.billedTo"), { size: 9, color: muted });
  write(data.member.name, { font: bold });
  if (data.member.email) write(data.member.email, { color: muted });

  // Ligne payée
  y -= 20;
  page.drawLine({
    start: { x: left, y: y + 14 },
    end: { x: right, y: y + 14 },
    color: muted,
    thickness: 0.5,
  });
  write(t("receipt.item"), { size: 9, color: muted });
  y += 13.5;
  writeRight(t("receipt.amount"), 9);
  y -= 13.5;
  y -= 4;
  write(data.label, { font: bold });
  y += 15.75;
  writeRight(data.amount, 10.5, bold);
  y -= 15.75;
  if (data.promoCode) write(t("receipt.promo", { code: data.promoCode }), { color: muted });
  write(t("receipt.method", { method: data.method }), { color: muted });
  y -= 6;
  page.drawLine({
    start: { x: left, y: y + 14 },
    end: { x: right, y: y + 14 },
    color: muted,
    thickness: 0.5,
  });
  y -= 6;
  write(t("receipt.total"), { size: 12, font: bold });
  y += 18;
  writeRight(data.amount, 12, bold);
  y -= 18;
  write(t(data.refunded ? "receipt.refunded" : "receipt.paid"), { color: muted });

  // Pied
  y = 56;
  write(t("receipt.footer", { gym: data.gym.name }), { size: 8.5, color: muted });
  return pdf.save();
}
