import { brand, preview } from "@/content/landing";
import { ProductPreview } from "@/components/preview/product-preview";
import { PreviewPanel } from "@/components/preview/views";

/** Section de l'aperçu : vues rendues ici (serveur), interactions dans ProductPreview (client). */
export function PreviewSection() {
  return (
    <section id="apercu" aria-labelledby="apercu-title" className="px-4 pb-20 sm:px-6">
      <div className="mx-auto max-w-[1240px]">
        <h2 id="apercu-title" className="sr-only">
          {preview.label}
        </h2>
        <ProductPreview
          brandName={brand.name}
          label={preview.label}
          navTitle={preview.navTitle}
          navHint={preview.navHint}
          live={preview.live}
          steps={preview.steps}
          integrationsCount={preview.integrations.tools.length}
          panels={preview.steps.map((step) => (
            <PreviewPanel key={step.id} step={step} />
          ))}
        />
      </div>
    </section>
  );
}
