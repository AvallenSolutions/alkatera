import { redirect } from "next/navigation";

/**
 * Retired duplicate product-create route.
 *
 * This route carried a second, independent "create a product" form writing the
 * same products columns as /products/new but under a DIFFERENT required-field
 * contract: SKU and description were required here and optional there, while
 * product category was required there and never asked here at all. It also
 * shipped a third unit vocabulary ("L" vs "l" vs "units") into the same
 * unit_size_unit column, and a URL-only image field.
 *
 * /products/new is the single product-creation journey. Kept as a redirect so
 * existing bookmarks and deep links still land somewhere useful.
 */
export default function RetiredCreateProductPage() {
  redirect("/products/new");
}
