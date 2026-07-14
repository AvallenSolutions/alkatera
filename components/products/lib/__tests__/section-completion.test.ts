import { describe, expect, it } from "vitest";
import { getPackagingSectionStatus } from "../section-completion";
import type { PackagingFormData } from "@/components/products/PackagingFormCard";

// Minimal packaging form; individual tests override the fields they exercise.
function pkg(overrides: Partial<PackagingFormData>): PackagingFormData {
  return {
    tempId: "temp-1",
    name: "Bottle - Wild Glass",
    packaging_category: "container",
    net_weight_g: "500",
    unit: "g",
    has_component_breakdown: false,
    components: [],
    ...overrides,
  } as PackagingFormData;
}

describe("packaging components section status", () => {
  it("is n/a when the component breakdown is off", () => {
    expect(getPackagingSectionStatus(pkg({})).components).toBe("n/a");
  });

  it("is empty when opted in but no components added", () => {
    const p = pkg({ has_component_breakdown: true, components: [] });
    expect(getPackagingSectionStatus(p).components).toBe("empty");
  });

  it("is complete once a component carries a weight (Clair's 500 g case)", () => {
    const p = pkg({
      has_component_breakdown: true,
      components: [
        { epr_material_type: "glass", component_name: "Bottle - Wild Glass", weight_grams: 500, recycled_content_percentage: 100 },
      ],
    });
    // Regression guard: this read c.weight_g (undefined) and never went green.
    expect(getPackagingSectionStatus(p).components).toBe("complete");
  });

  it("is incomplete when a component exists but has zero weight", () => {
    const p = pkg({
      has_component_breakdown: true,
      components: [
        { epr_material_type: "glass", component_name: "Bottle", weight_grams: 0 },
      ],
    });
    expect(getPackagingSectionStatus(p).components).toBe("incomplete");
  });
});
