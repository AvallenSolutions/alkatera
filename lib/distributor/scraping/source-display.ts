/**
 * Maps a raw scraped_brand_data.source_name into a sentence-cased
 * provenance phrase shown to brand uploaders on /brand-upload/[token].
 *
 * The brand-facing portal speaks to the brand, so "your website",
 * "your B Corp listing", not "scraped from third-party source".
 */
export function describeSource(sourceName: string): string {
  switch (sourceName) {
    case 'brand_verified':
      return 'Verified by you';
    case 'alkatera_live':
      return 'From your alkatera profile';
    case 'brand_upload':
      return 'From a document you uploaded';
    case 'Brand Website':
      return 'From your website';
    case 'Wikipedia':
      return 'From Wikipedia';
    case 'B Corp Directory':
      return 'From your B Corp listing';
    case 'Carbon Trust Certification':
      return 'From the Carbon Trust register';
    case 'Organic Farmers and Growers':
      return 'From the Organic Farmers and Growers register';
    case 'Fairtrade Foundation':
      return 'From the Fairtrade Foundation register';
    case 'Rainforest Alliance':
      return 'From the Rainforest Alliance register';
    case 'CIVB (Bordeaux Wine)':
      return 'From the Bordeaux Wine Council';
    case 'Drinks Ireland':
      return 'From Drinks Ireland';
    case 'Companies House UK':
      return 'From Companies House';
    case 'Sedex SMETA':
      return 'From your Sedex profile';
    default:
      return `From ${sourceName}`;
  }
}

export function isBrandVerified(sourceName: string): boolean {
  return sourceName === 'brand_verified';
}
