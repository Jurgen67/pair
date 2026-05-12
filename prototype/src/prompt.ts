import { readFileSync } from "node:fs";
import { extname } from "node:path";
import type {
  MessageParam,
  ImageBlockParam,
} from "@anthropic-ai/sdk/resources/messages/messages.mjs";
import type { WardrobeFixture } from "./types.js";

const SYSTEM_PROMPT = `Je bent een persoonlijk outfit-adviseur voor één gebruiker.

REGELS — STRIKT VOLGEN:
- Een outfit bestaat uit EXACT 4 categorieën: top, broek_of_rok, schoenen, jas.
- Eén van die 4 is het anchor-item (door de gebruiker gekozen).
- De andere 3 items komen UITSLUITEND uit de wardrobe-lijst hieronder (gebruik hun IDs).
- Geen accessoires (geen sjaal, tas, sieraad, riem) — die zijn buiten v0.1-scope.
- Hallucineer geen items die niet in de lijst staan.

OUTPUT — ALLEEN dit JSON-object, niets erbuiten (geen uitleg vóór of na, geen code-fences):
{
  "outfit": {
    "anchorItemId": "<id van het anchor>",
    "complementItemIds": ["<id-slot-2>", "<id-slot-3>", "<id-slot-4>"]
  },
  "uitleg": "<Nederlandse uitleg van 2-4 zinnen waarom deze combinatie werkt voor deze gebruiker, met verwijzing naar haar proporties/voorkeuren waar relevant>"
}`;

export interface BuiltPrompt {
  system: string;
  messages: MessageParam[];
}

export function buildPromptMessages(
  fixture: WardrobeFixture,
  anchorItemId: string,
): BuiltPrompt {
  const anchor = fixture.items.find((i) => i.id === anchorItemId);
  if (!anchor) {
    throw new Error(`anchor item not found in fixture: ${anchorItemId}`);
  }

  const wardrobeJson = JSON.stringify(
    fixture.items.map((i) => ({
      id: i.id,
      category: i.category,
      colors: i.colors,
      occasion: i.occasion,
    })),
    null,
    2,
  );

  const styleRefBlocks: ImageBlockParam[] = fixture.user.styleReferences.map(
    (ref) => imageBlockFromFile(ref.photoPath),
  );

  const anchorBlock = imageBlockFromFile(anchor.photoPath);

  const userText =
    `USER BODY/STYLE PREFERENCES (eigen woorden):\n` +
    `"${fixture.user.proportionsText}"\n\n` +
    `WARDROBE (kies de overige 3 outfit-slots hieruit):\n` +
    wardrobeJson +
    `\n\n` +
    `STYLE REFERENCES (outfits die de gebruiker droeg en mooi vindt — gebruik als stijl-referentie):\n` +
    (styleRefBlocks.length === 0 ? "(geen)\n" : "") +
    `\n` +
    `ANCHOR ITEM (start hiermee — id ${anchor.id}, ${anchor.category}, ${anchor.colors}, ${anchor.occasion}):\n`;

  const content: Array<
    { type: "text"; text: string } | ImageBlockParam
  > = [
    { type: "text", text: userText },
    ...styleRefBlocks,
    anchorBlock,
  ];

  return {
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content }],
  };
}

function imageBlockFromFile(path: string): ImageBlockParam {
  const buf = readFileSync(path);
  return {
    type: "image",
    source: {
      type: "base64",
      media_type: mediaTypeFromExt(path),
      data: buf.toString("base64"),
    },
  };
}

function mediaTypeFromExt(
  path: string,
): "image/jpeg" | "image/png" | "image/webp" | "image/gif" {
  const ext = extname(path).toLowerCase();
  switch (ext) {
    case ".jpg":
    case ".jpeg":
      return "image/jpeg";
    case ".png":
      return "image/png";
    case ".webp":
      return "image/webp";
    case ".gif":
      return "image/gif";
    default:
      throw new Error(`unsupported image extension: ${ext} (${path})`);
  }
}
