import { supabase } from './supabaseClient';

export async function createDraftLca(productId: string, organizationId: string) {
  try {
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      throw new Error("User not authenticated");
    }

    const { data: product, error: productError } = await supabase
      .from("products")
      .select("name")
      .eq("id", productId)
      .eq("organization_id", organizationId)
      .maybeSingle();

    if (productError) {
      throw new Error(`Failed to fetch product: ${productError.message}`);
    }

    if (!product) {
      throw new Error("Product not found");
    }

    const { data: lca, error: lcaError } = await supabase
      .from("product_lcas")
      .insert({
        organization_id: organizationId,
        product_id: productId,
        product_name: product.name,
        functional_unit: "1 unit",
        system_boundary: "Cradle to gate",
        status: "draft",
      })
      .select()
      .single();

    if (lcaError) {
      throw new Error(`Failed to create LCA: ${lcaError.message}`);
    }

    return { success: true, lcaId: lca.id };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to create draft LCA";
    return { success: false, error: message };
  }
}

export async function updateSourcingMethodology(
  lcaId: string,
  methodology: "GROWN" | "PURCHASED"
) {
  try {
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      throw new Error("User not authenticated");
    }

    const { error } = await supabase
      .from("product_lcas")
      .update({ sourcing_methodology: methodology })
      .eq("id", lcaId);

    if (error) {
      throw new Error(`Failed to update sourcing methodology: ${error.message}`);
    }

    return { success: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to update sourcing methodology";
    return { success: false, error: message };
  }
}
