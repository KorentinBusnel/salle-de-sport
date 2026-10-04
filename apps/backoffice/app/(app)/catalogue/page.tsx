import { redirect } from "next/navigation";

/** Le catalogue vit désormais dans Paramètres → Catalogue. */
export default function CatalogPage() {
  redirect("/parametres?onglet=catalogue");
}
