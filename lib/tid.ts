// lib/tid.ts – delade konstanter för Tidsspelet
export const TID_TARGET_SEC = 60;

export function teamKey(name: string) {
  return name.trim().toLowerCase().replace(/\s+/g, " ");
}
