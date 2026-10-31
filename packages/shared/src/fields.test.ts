import { describe, expect, it } from "vitest";
import { parseSegmentFilters, segmentFiltersSchema } from "./crm.ts";
import {
  FIELD_OPS,
  FIELD_OPS_BY_TYPE,
  fieldConditionSchema,
  fieldToCellKind,
  fieldValueSchema,
  MEMBER_FIELD_TYPES,
  optionLabel,
  parseFieldOptions,
  parseMemberField,
  slugifyFieldKey,
  slugifyOptionValue,
} from "./fields.ts";

const options = [
  { value: "perte_de_poids", label: "Perte de poids", tone: "brand" as const },
  { value: "competition", label: "Compétition", tone: "success" as const },
];

describe("slugifyFieldKey", () => {
  it("minuscules sans accents, séparateurs en _, 40 caractères au plus", () => {
    expect(slugifyFieldKey("Certificat médical")).toBe("certificat_medical");
    expect(slugifyFieldKey("  Objectif  (2026) ! ")).toBe("objectif_2026");
    expect(slugifyFieldKey("a".repeat(60))).toHaveLength(40);
  });
  it("préfixe f_ quand la clé ne commence pas par une lettre, vide si rien d'exploitable", () => {
    expect(slugifyFieldKey("2e contact")).toBe("f_2e_contact");
    expect(slugifyFieldKey("_x")).toBe("x");
    expect(slugifyFieldKey("!!!")).toBe("");
  });
  it("une option peut commencer par un chiffre", () => {
    expect(slugifyOptionValue("3 fois par semaine")).toBe("3_fois_par_semaine");
    expect(slugifyOptionValue("Élite")).toBe("elite");
  });
});

describe("parseFieldOptions", () => {
  it("ignore les entrées invalides et les doublons", () => {
    expect(
      parseFieldOptions([
        ...options,
        { value: "Perte", label: "x", tone: "brand" },
        { value: "competition", label: "Doublon", tone: "danger" },
        { value: "sans_ton", label: "Sans ton" },
        null,
      ]),
    ).toEqual(options);
    expect(parseFieldOptions("x")).toEqual([]);
  });
});

describe("parseMemberField", () => {
  const row = {
    id: "0c2b4c9e-6f1a-4a3b-9e2d-000000000001",
    key: "objectif",
    label: "Objectif",
    type: "select",
    options,
    position: 0,
    staff_can_edit: true,
    is_active: true,
  };
  it("accepte une ligne valide et refuse un type inconnu", () => {
    expect(parseMemberField(row)?.options).toHaveLength(2);
    expect(parseMemberField({ ...row, type: "rating" })).toBeNull();
    expect(parseMemberField({ ...row, key: "Objectif" })).toBeNull();
  });
});

describe("fieldValueSchema", () => {
  it("texte : non vide, 300 caractères au plus", () => {
    const schema = fieldValueSchema({ type: "text", options: [] });
    expect(schema.safeParse(" ok ").success).toBe(true);
    expect(schema.safeParse("  ").success).toBe(false);
    expect(schema.safeParse("a".repeat(301)).success).toBe(false);
  });
  it("nombre : fini, borné, deux décimales", () => {
    const schema = fieldValueSchema({ type: "number", options: [] });
    expect(schema.safeParse(12.5).success).toBe(true);
    expect(schema.safeParse(12.345).success).toBe(false);
    expect(schema.safeParse(2_000_000_000).success).toBe(false);
    expect(schema.safeParse(Number.NaN).success).toBe(false);
  });
  it("date, oui/non", () => {
    expect(fieldValueSchema({ type: "date", options: [] }).safeParse("2026-02-29").success).toBe(
      false,
    );
    expect(fieldValueSchema({ type: "date", options: [] }).safeParse("2026-03-01").success).toBe(
      true,
    );
    expect(fieldValueSchema({ type: "boolean", options: [] }).safeParse(true).success).toBe(true);
    expect(fieldValueSchema({ type: "boolean", options: [] }).safeParse("oui").success).toBe(false);
  });
  it("liste : option existante ; liste multiple : sous-ensemble sans doublon", () => {
    expect(fieldValueSchema({ type: "select", options }).safeParse("competition").success).toBe(
      true,
    );
    expect(fieldValueSchema({ type: "select", options }).safeParse("autre").success).toBe(false);
    const multi = fieldValueSchema({ type: "multi_select", options });
    expect(multi.safeParse(["competition", "perte_de_poids"]).success).toBe(true);
    expect(multi.safeParse(["competition", "competition"]).success).toBe(false);
    expect(multi.safeParse([]).success).toBe(false);
  });
  it("libellé d'une option, valeur brute si elle a disparu", () => {
    expect(optionLabel({ options }, "competition")).toBe("Compétition");
    expect(optionLabel({ options }, "ancienne")).toBe("ancienne");
  });
});

describe("opérateurs et conditions", () => {
  it("chaque type propose des opérateurs connus, chaque opérateur sert à un type", () => {
    const used = new Set<string>();
    for (const type of MEMBER_FIELD_TYPES) {
      expect(FIELD_OPS_BY_TYPE[type].length).toBeGreaterThan(0);
      for (const op of FIELD_OPS_BY_TYPE[type]) {
        expect(FIELD_OPS).toContain(op);
        used.add(op);
      }
    }
    expect([...used].sort()).toEqual([...FIELD_OPS].sort());
  });
  it("la valeur dépend de l'opérateur", () => {
    expect(fieldConditionSchema.safeParse({ key: "objectif", op: "is", value: "x" }).success).toBe(
      true,
    );
    expect(fieldConditionSchema.safeParse({ key: "objectif", op: "is_empty" }).success).toBe(true);
    expect(
      fieldConditionSchema.safeParse({ key: "certificat", op: "before", value: "hier" }).success,
    ).toBe(false);
    expect(fieldConditionSchema.safeParse({ key: "n", op: "gte", value: "3" }).success).toBe(false);
    expect(
      fieldConditionSchema.safeParse({ key: "tags", op: "has_any", value: ["a", "b"] }).success,
    ).toBe(true);
    expect(fieldConditionSchema.safeParse({ key: "Objectif", op: "is", value: 1 }).success).toBe(
      false,
    );
  });
  it("les filtres de segment acceptent fields et n'écartent que les conditions invalides", () => {
    expect(
      segmentFiltersSchema.safeParse({ fields: [{ key: "objectif", op: "is", value: "x" }] })
        .success,
    ).toBe(true);
    expect(
      parseSegmentFilters({
        statuses: ["active"],
        fields: [{ key: "objectif", op: "is", value: "x" }, { key: "x", op: "nope" }, 3],
      }),
    ).toEqual({ statuses: ["active"], fields: [{ key: "objectif", op: "is", value: "x" }] });
    expect(parseSegmentFilters({ fields: [{ op: "is" }] })).toEqual({});
  });
  it("type de cellule par type de champ", () => {
    expect(MEMBER_FIELD_TYPES.map(fieldToCellKind)).toEqual([
      "text",
      "number",
      "date",
      "switch",
      "select",
      "multi",
    ]);
  });
});
