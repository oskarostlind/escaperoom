// data/clues.ts
export type ClueConfig = {
  id: string;              // stabilt id du väljer själv
  title: string;           // rubrik i UI
  icon: string;            // emoji/icon
  riddle: string;          // själva gåtan (radbryt med \n)
  type: "digit" | "code";  // "digit" = 0–9, "code" = flersiffrig kod
  expected: string;        // "3" eller "7214" etc (endast siffror)
  durationSec?: number;    // valfritt: tid för denna ledtråd (default 5*60)
  active?: boolean;        // enkel on/off
  final?: boolean;         // true = fast sista fråga som ALLA lag får
};

/**
 * Så funkar urvalet (se lib/order.ts):
 *  - Varje lag får PICK_COUNT gåtor slumpade ur potten (alla aktiva utan `final`),
 *    i slumpad ordning, och därefter sistafrågan (`final: true`).
 *  - Inga två lag får samma ordning (så länge det finns kombinationer kvar:
 *    5 gåtor i potten ger 5·4·3 = 60 unika ordningar).
 *
 * Lägg till gåtor längst ner. Sätt active: false för att dölja en gåta.
 */
export const PICK_COUNT = 3;

// **** Här styr du allt ****
export const CLUES: ClueConfig[] = [
  {
    id: "prime",
    title: "Primtalet",
    icon: "🔢",
    riddle: "Ledtråden finns gömd bakom det primtal som saknas.\n2, 3, 5, 11, 13, 17",
    type: "digit",
    expected: "2",
    active: true,
  },
  {
    id: "sequence",
    title: "Talföljden",
    icon: "📉",
    riddle: "20, 19, 17, 14, 10, ?",
    type: "digit",
    expected: "5",
    active: true,
  },
  {
    id: "dirty",
    title: "Skitiga ställen",
    icon: "🧹",
    riddle: "Ibland finns koden på de mest skitiga ställena.\nTitta inte ovanpå – lyft och titta i.",
    type: "digit",
    expected: "7",
    active: true,
  },
  {
    id: "sauna",
    title: "Bastun",
    icon: "🔥",
    riddle: "Leta i en varm bastu – gåtan leder dit.",
    type: "digit",
    expected: "4",
    active: true,
  },
  {
    id: "oddball",
    title: "Den udda bollen",
    icon: "🎱",
    riddle: "Hitta den udda bollen.",
    type: "digit",
    expected: "6",
    active: true,
  },

  // ---- Fast sista fråga – alla lag får denna sist ----
  {
    id: "door",
    title: "Dörren",
    icon: "🚪",
    riddle: "Vilket nummer stod på dörren?",
    type: "digit",
    expected: "2",
    active: true,
    final: true,
  },
];

// Standardtid om durationSec inte är satt
export const DEFAULT_CLUE_SECONDS = 5 * 60;
