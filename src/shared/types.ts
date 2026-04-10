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
