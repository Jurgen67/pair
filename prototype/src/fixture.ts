import type { WardrobeFixture } from "./types.js";

// Dummy fixture for unit tests + manual eval starting point.
// During manual eval (Task 8), point photoPath values at real images in eval-data/.

export const SIMONE_FIXTURE: WardrobeFixture = {
  user: {
    proportionsText:
      "Korte benen, iets dikkere benen. Liever geen strakke pijp onder de knie.",
    styleReferences: [
      { photoPath: "eval-data/style-ref-1.jpg" },
      { photoPath: "eval-data/style-ref-2.jpg" },
    ],
  },
  items: [
    // Tops
    { id: "top-1", category: "top", colors: "wit", occasion: "werk", photoPath: "eval-data/top-1.jpg" },
    { id: "top-2", category: "top", colors: "donkerblauw", occasion: "casual", photoPath: "eval-data/top-2.jpg" },
    { id: "top-3", category: "top", colors: "zwart met patroon", occasion: "uit", photoPath: "eval-data/top-3.jpg" },
    { id: "top-4", category: "top", colors: "lichtgrijs", occasion: "casual", photoPath: "eval-data/top-4.jpg" },

    // Broeken / rokken
    { id: "bottom-1", category: "broek_of_rok", colors: "donkerblauwe jeans", occasion: "casual", photoPath: "eval-data/bottom-1.jpg" },
    { id: "bottom-2", category: "broek_of_rok", colors: "zwart", occasion: "werk", photoPath: "eval-data/bottom-2.jpg" },
    { id: "bottom-3", category: "broek_of_rok", colors: "beige", occasion: "werk", photoPath: "eval-data/bottom-3.jpg" },
    { id: "bottom-4", category: "broek_of_rok", colors: "zwarte rok", occasion: "uit", photoPath: "eval-data/bottom-4.jpg" },

    // Schoenen
    { id: "shoes-1", category: "schoenen", colors: "witte sneakers", occasion: "casual", photoPath: "eval-data/shoes-1.jpg" },
    { id: "shoes-2", category: "schoenen", colors: "zwarte loafers", occasion: "werk", photoPath: "eval-data/shoes-2.jpg" },
    { id: "shoes-3", category: "schoenen", colors: "bruine boots", occasion: "uit", photoPath: "eval-data/shoes-3.jpg" },

    // Jassen
    { id: "coat-1", category: "jas", colors: "donkergrijs trenchcoat", occasion: "werk", photoPath: "eval-data/coat-1.jpg" },
    { id: "coat-2", category: "jas", colors: "spijkerjasje", occasion: "casual", photoPath: "eval-data/coat-2.jpg" },
    { id: "coat-3", category: "jas", colors: "zwart leren jasje", occasion: "uit", photoPath: "eval-data/coat-3.jpg" },
  ],
};
