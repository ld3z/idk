import type { MangaJson } from "./types.ts";

/** JSON files in a manga folder that are never treated as manga metadata */
export const METADATA_JSON_DENYLIST = new Set(
	["package.json", "package-lock.json", "tsconfig.json", "jsconfig.json", "manifest.json"].map((s) => s.toLowerCase()),
);

export function isMangaJsonPayload(v: unknown): v is MangaJson {
	if (typeof v !== "object" || v === null) return false;
	const o = v as Record<string, unknown>;
	if (typeof o.title !== "string") return false;
	if (typeof o.chapters !== "object" || o.chapters === null || Array.isArray(o.chapters)) return false;
	return true;
}

/**
 * Filename only (e.g. `My Series.json`). Invalid path characters stripped; never empty.
 */
export function mangaMetadataBasename(title: string): string {
	let base = (title || "Untitled").trim();
	if (base.toLowerCase().endsWith(".json")) {
		base = base.slice(0, -5).trim();
	}
	base = base.replace(/[<>:"/\\|?*\x00-\x1f]/g, "_");
	base = base.replace(/^\.+/, "").replace(/\.+$/, "").trim();
	if (!base) base = "Untitled";
	if (base.length > 180) {
		base = base.slice(0, 180).trim() || "Untitled";
	}
	return `${base}.json`;
}
