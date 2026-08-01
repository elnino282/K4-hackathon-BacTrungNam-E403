import { MindMapNode } from "./mindMap";
export function readMindMapCache(key: string): MindMapNode | null { try { const raw = localStorage.getItem(key); return raw ? JSON.parse(raw) as MindMapNode : null; } catch { return null; } }
export function writeMindMapCache(key: string, map: MindMapNode) { try { localStorage.setItem(key, JSON.stringify(map)); } catch { /* cache is optional */ } }
