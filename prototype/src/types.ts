// Domain types for Pair. Mirrors the v0.1 design (spec §4, §5).
// Will be ported (almost verbatim) to the Supabase Edge Function in Plan 2.

export const CLOTHING_CATEGORIES = [
  "top",
  "broek_of_rok",
  "schoenen",
  "jas",
] as const;

export type ClothingCategory = (typeof CLOTHING_CATEGORIES)[number];

export type ClothingOccasion = "casual" | "werk" | "uit" | "sport";

export interface ClothingItem {
  id: string;
  category: ClothingCategory;
  /** Free-form color name(s) in Dutch, e.g. "donkerblauw", "wit met rode strepen". */
  colors: string;
  occasion: ClothingOccasion;
  /** Local filesystem path to the item's photo. */
  photoPath: string;
}

export interface StyleReferencePhoto {
  /** Local filesystem path to the reference photo. */
  photoPath: string;
}

export interface UserContext {
  /** Free-form text written by the user, used as prompt context. */
  proportionsText: string;
  /** Up to 5 reference photos of outfits the user has worn and likes. */
  styleReferences: StyleReferencePhoto[];
}

export interface WardrobeFixture {
  user: UserContext;
  items: ClothingItem[];
}

export interface AdviceRequest {
  fixture: WardrobeFixture;
  anchorItemId: string;
}

export interface AdviceResponseOutfit {
  anchorItemId: string;
  complementItemIds: string[];
}

export interface AdviceResponse {
  outfit: AdviceResponseOutfit;
  uitleg: string;
}

// Type guards used at runtime to validate untrusted Claude output.

export function isClothingCategory(value: unknown): value is ClothingCategory {
  return (
    typeof value === "string" &&
    (CLOTHING_CATEGORIES as readonly string[]).includes(value)
  );
}
