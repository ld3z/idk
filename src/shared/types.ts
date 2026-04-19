export type ChapterGroup = Record<string, string[]>;

export type Chapter = {
	title: string;
	volume: string;
	last_updated: string;
	groups: ChapterGroup;
};

export type MangaJson = {
	title: string;
	description: string;
	artist: string;
	author: string;
	cover: string;
	chapters: Record<string, Chapter>;
};

export type MangaEntry = {
	id: number;
	folderPath: string;
	manga: MangaJson;
	available: boolean;
	chapterCount: number;
};

export type MangaDiff = {
	title?: { before: string; after: string };
	description?: { before: string; after: string };
	author?: { before: string; after: string };
	artist?: { before: string; after: string };
	cover?: { before: string; after: string };
	chaptersAdded: string[];
	chaptersRemoved: string[];
	chaptersModified: string[];
};

export type PendingSave = {
	title: string;
	diff: MangaDiff;
};
