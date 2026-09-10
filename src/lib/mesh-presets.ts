// 50 curated pastel mesh-gradient presets: 25 light, 25 dark. Each entry is
// three hex colors fed straight into meshBackground() (slide-canvas.tsx).

export type MeshPresetTone = "light" | "dark";

export type MeshPreset = {
  name: string;
  tone: MeshPresetTone;
  colors: [string, string, string];
};

export const MESH_PRESETS: MeshPreset[] = [
  // ---------- Light pastels ----------
  { name: "Cotton Candy", tone: "light", colors: ["#FFD6E8", "#C7CEFF", "#B8F1FF"] },
  { name: "Peach Sorbet", tone: "light", colors: ["#FFD9C0", "#FFB3C7", "#FFE3A3"] },
  { name: "Mint Cream", tone: "light", colors: ["#C9F2D8", "#A8E6CF", "#E9F5DB"] },
  { name: "Lavender Mist", tone: "light", colors: ["#E0C3FC", "#C7CEFF", "#F3E5F5"] },
  { name: "Baby Blue", tone: "light", colors: ["#BDE0FE", "#A2D2FF", "#CAF0F8"] },
  { name: "Lemon Chiffon", tone: "light", colors: ["#FFF3B0", "#FFE29A", "#FFD6A5"] },
  { name: "Rosewater", tone: "light", colors: ["#FFCAD4", "#F4ACB7", "#FFE5D9"] },
  { name: "Pistachio", tone: "light", colors: ["#D8F3DC", "#B7E4C7", "#F1FAEE"] },
  { name: "Periwinkle", tone: "light", colors: ["#C3BEF0", "#ACA7E8", "#D5CCFF"] },
  { name: "Apricot Glow", tone: "light", colors: ["#FFD6A5", "#FFB997", "#FFE5B4"] },
  { name: "Seafoam", tone: "light", colors: ["#A8E6CF", "#88D8B0", "#D0F4DE"] },
  { name: "Lilac Dream", tone: "light", colors: ["#D5AAFF", "#B892FF", "#E8D5FF"] },
  { name: "Coral Blush", tone: "light", colors: ["#FFB3BA", "#FFC8A2", "#FFDFBA"] },
  { name: "Powder Sky", tone: "light", colors: ["#CAF0F8", "#ADE8F4", "#90E0EF"] },
  { name: "Vanilla Lilac", tone: "light", colors: ["#F3E5F5", "#E1BEE7", "#FFF9C4"] },
  { name: "Melon Frost", tone: "light", colors: ["#FFC9B5", "#FFDAB9", "#FFE5D9"] },
  { name: "Aqua Pastel", tone: "light", colors: ["#B5EAEA", "#A0E7E5", "#C7F9CC"] },
  { name: "Orchid Haze", tone: "light", colors: ["#E4C1F9", "#D5AAFF", "#F0D9FF"] },
  { name: "Butter Cream", tone: "light", colors: ["#FFF3B0", "#FFE8A3", "#FFDDAA"] },
  { name: "Blush Pink", tone: "light", colors: ["#F9C5D5", "#F7A8C4", "#FBDCE5"] },
  { name: "Sky Tint", tone: "light", colors: ["#D6E9FE", "#B8D4FE", "#E8F1FF"] },
  { name: "Sage Whisper", tone: "light", colors: ["#DDE5B6", "#C9D6A3", "#E9F0D2"] },
  { name: "Grapefruit", tone: "light", colors: ["#FFB4A2", "#FFCDB4", "#FFE5D9"] },
  { name: "Ice Lilac", tone: "light", colors: ["#DEC9E9", "#CDB4DB", "#EDE0F5"] },
  { name: "Honeydew", tone: "light", colors: ["#D8F3DC", "#E9F5DB", "#F1FAEE"] },
  // ---------- Dark pastels ----------
  { name: "Midnight Berry", tone: "dark", colors: ["#3D1D3D", "#6D2E5B", "#A34A7E"] },
  { name: "Deep Ocean", tone: "dark", colors: ["#16283F", "#274C77", "#3E7CB1"] },
  { name: "Forest Night", tone: "dark", colors: ["#14342B", "#2D6A4F", "#52B788"] },
  { name: "Plum Smoke", tone: "dark", colors: ["#2E1A47", "#4C2A85", "#6D4AA0"] },
  { name: "Espresso Rose", tone: "dark", colors: ["#3E2723", "#6D4C41", "#A1887F"] },
  { name: "Slate Teal", tone: "dark", colors: ["#1F3349", "#2E5A6B", "#4895A3"] },
  { name: "Indigo Night", tone: "dark", colors: ["#1E1B4B", "#3730A3", "#6366F1"] },
  { name: "Burgundy Haze", tone: "dark", colors: ["#471C2B", "#722F45", "#A0536B"] },
  { name: "Moss Shadow", tone: "dark", colors: ["#243024", "#3A5A40", "#588157"] },
  { name: "Deep Aubergine", tone: "dark", colors: ["#2A1538", "#50246F", "#7B3FBF"] },
  { name: "Ocean Abyss", tone: "dark", colors: ["#0F2A3C", "#1D566E", "#2A9D8F"] },
  { name: "Cocoa Plum", tone: "dark", colors: ["#3B2334", "#6A3B5B", "#9B5B8E"] },
  { name: "Pine Ink", tone: "dark", colors: ["#122B21", "#234F3C", "#388659"] },
  { name: "Storm Violet", tone: "dark", colors: ["#26203D", "#45386B", "#6B5B95"] },
  { name: "Ember Night", tone: "dark", colors: ["#3A1F1F", "#6E2B2B", "#A84848"] },
  { name: "Teal Abyss", tone: "dark", colors: ["#123332", "#1F5C5C", "#319795"] },
  { name: "Royal Dusk", tone: "dark", colors: ["#241F4E", "#3E3480", "#5B4EAD"] },
  { name: "Wine Dark", tone: "dark", colors: ["#3F1D2E", "#652A45", "#8F4A63"] },
  { name: "Olive Night", tone: "dark", colors: ["#2B2B1A", "#4A4A2A", "#8A8A4D"] },
  { name: "Steel Blue Dark", tone: "dark", colors: ["#1C2A3A", "#2F4B5E", "#4A7C8E"] },
  { name: "Magenta Deep", tone: "dark", colors: ["#3A1030", "#6B1D54", "#9C2F7A"] },
  { name: "Emerald Abyss", tone: "dark", colors: ["#0F2E25", "#1D5C4D", "#2E8B77"] },
  { name: "Crimson Shadow", tone: "dark", colors: ["#3D1518", "#6B2228", "#9B3038"] },
  { name: "Azure Night", tone: "dark", colors: ["#14243D", "#26436B", "#3D6B9E"] },
  { name: "Violet Void", tone: "dark", colors: ["#1F1833", "#3B2A5E", "#5A3F8C"] },
];
