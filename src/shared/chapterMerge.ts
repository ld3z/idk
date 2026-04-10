import type { Chapter } from "./types.ts";

/**
 * Merge `incoming` into `existing` for the same chapter number.
 * New group names are added; existing groups are left unchanged unless
 * `incoming` supplies a non-empty URL list for that name (then replace).
 */
export function mergeChapterIntoExisting(existing: Chapter, incoming: Chapter, chapterNum: string): Chapter {
	const groups: Record<string, string[]> = {};
	for (const [k, v] of Object.entries(existing.groups)) {
		groups[k] = [...v];
	}
	for (const [name, urls] of Object.entries(incoming.groups)) {
		if (!(name in groups)) {
			groups[name] = [...urls];
		} else if (urls.length > 0) {
			groups[name] = [...urls];
		}
	}

	let title = existing.title;
	if (incoming.title && incoming.title !== chapterNum) {
		if (!existing.title || existing.title === chapterNum) {
			title = incoming.title;
		}
	}

	const volume = incoming.volume ? incoming.volume : existing.volume;

	return {
		title,
		volume,
		last_updated: incoming.last_updated,
		groups,
	};
}
