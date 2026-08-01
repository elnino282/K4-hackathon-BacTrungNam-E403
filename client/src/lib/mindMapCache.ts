import { MindMapNode, parseMindMapResponse } from "./mindMap";

export function readMindMapCache(key: string): MindMapNode | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? parseMindMapResponse(JSON.parse(raw)) : null;
  } catch {
    return null;
  }
}

export function writeMindMapCache(key: string, map: MindMapNode): void {
  try {
    localStorage.setItem(key, JSON.stringify(map));
  } catch {
    // Persistence is optional; the active map remains usable in memory.
  }
}

export function removeMindMapCache(key: string): void {
  try {
    localStorage.removeItem(key);
  } catch {
    // Persistence is optional; no visible error is required.
  }
}
