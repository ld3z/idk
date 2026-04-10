import { mkdirSync, readFileSync, writeFileSync, existsSync, readdirSync } from "node:fs";
import { join, basename } from "node:path";
import { Database } from "bun:sqlite";
import { BrowserView, BrowserWindow, Updater, Utils } from "electrobun/bun";
import type { MangaJson, MangaEntry, Chapter } from "../shared/types.ts";

type AppSettings = {
	imgchestApiKey: string;
	githubToken: string;
	githubOwner: string;
	githubRepo: string;
	githubBranch: string;
};

type RpcSchema = {
	bun: {
		requests: {
			getSettings: { params: void; response: { settings: AppSettings; dbPath: string } };
			saveSettings: { params: AppSettings; response: { ok: true } };
			getTheme: { params: void; response: { theme: string } };
			setTheme: { params: { theme: string }; response: { ok: true } };
			listManga: { params: void; response: MangaEntry[] };
			addMangaFolder: { params: { folderPath: string }; response: MangaEntry };
			removeManga: { params: { id: number }; response: { ok: true } };
			updateManga: { params: { id: number; manga: MangaJson }; response: { ok: true } };
			addChapter: { params: { id: number; chapterNum: string; chapter: Chapter }; response: { ok: true } };
			removeChapter: { params: { id: number; chapterNum: string }; response: { ok: true } };
			uploadImages: { params: { id: number; chapterNum: string; group: string; filePaths: string[] }; response: { urls: string[] } };
			uploadImagesFromFolder: { params: { id: number; chapterNum: string; group: string; folderPath: string }; response: { urls: string[] } };
			pickFolder: { params: void; response: { path: string } | null };
			pickImages: { params: void; response: { paths: string[] } | null };
			searchMangaBaka: { params: { query: string }; response: { results: { id: number; title: string; description: string; author: string; artist: string; cover: string }[] } };
		};
		messages: Record<never, never>;
	};
	webview: {
		requests: Record<never, never>;
		messages: Record<never, never>;
	};
};

const DEFAULT_SETTINGS: AppSettings = {
	imgchestApiKey: "",
	githubToken: "",
	githubOwner: "",
	githubRepo: "",
	githubBranch: "main",
};

const DEFAULT_MANGA: MangaJson = {
	title: "Untitled",
	description: "",
	artist: "",
	author: "",
	cover: "",
	chapters: {},
};

const DB_FILENAME = "kaguya-settings.sqlite";
const DEV_SERVER_PORT = 5173;
const DEV_SERVER_URL = `http://localhost:${DEV_SERVER_PORT}`;

async function getSettingsDbPath() {
	const appDataFolder = await Updater.appDataFolder();
	mkdirSync(appDataFolder, { recursive: true });
	return join(appDataFolder, DB_FILENAME);
}

function initDb(dbPath: string) {
	const db = new Database(dbPath);

	db.run(`
		CREATE TABLE IF NOT EXISTS app_settings (
			id INTEGER PRIMARY KEY CHECK (id = 1),
			imgchestApiKey TEXT NOT NULL DEFAULT '',
			githubToken TEXT NOT NULL DEFAULT '',
			githubOwner TEXT NOT NULL DEFAULT '',
			githubRepo TEXT NOT NULL DEFAULT '',
			githubBranch TEXT NOT NULL DEFAULT 'main'
		)
	`);
	db.run(`INSERT OR IGNORE INTO app_settings (id) VALUES (1)`);

	const cols = db.query(`PRAGMA table_info(app_settings)`).all() as { name: string }[];
	if (!cols.some((c) => c.name === "theme")) {
		db.run(`ALTER TABLE app_settings ADD COLUMN theme TEXT NOT NULL DEFAULT 'light'`);
	}

	db.run(`
		CREATE TABLE IF NOT EXISTS manga_library (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			folderPath TEXT NOT NULL UNIQUE
		)
	`);

	return db;
}

function readMangaJson(folderPath: string): MangaJson | null {
	const filePath = join(folderPath, "manga.json");
	if (!existsSync(filePath)) return null;
	try {
		return JSON.parse(readFileSync(filePath, "utf-8"));
	} catch {
		return null;
	}
}

function writeMangaJson(folderPath: string, manga: MangaJson) {
	writeFileSync(join(folderPath, "manga.json"), JSON.stringify(manga, null, 2), "utf-8");
}

function loadMangaEntry(row: { id: number; folderPath: string }): MangaEntry {
	const manga = readMangaJson(row.folderPath);
	if (!manga) {
		return {
			id: row.id,
			folderPath: row.folderPath,
			manga: { ...DEFAULT_MANGA, title: basename(row.folderPath) },
			available: false,
			chapterCount: 0,
		};
	}
	return {
		id: row.id,
		folderPath: row.folderPath,
		manga,
		available: true,
		chapterCount: Object.keys(manga.chapters ?? {}).length,
	};
}

function getImgchestApiKey(db: Database): string {
	const row = db.query(`SELECT imgchestApiKey FROM app_settings WHERE id = 1`).get() as { imgchestApiKey: string } | undefined;
	return row?.imgchestApiKey ?? "";
}

async function uploadToImgChest(apiKey: string, filePaths: string[]): Promise<string[]> {
	const form = new FormData();
	for (const fp of filePaths) {
		form.append("images[]", Bun.file(fp), basename(fp));
	}

	const res = await fetch("https://api.imgchest.com/v1/post", {
		method: "POST",
		headers: { Authorization: `Bearer ${apiKey}`, Accept: "application/json" },
		body: form,
	});

	const text = await res.text();

	if (!res.ok) {
		throw new Error(`ImgChest upload failed (${res.status}): ${text}`);
	}

	let json: any;
	try {
		json = JSON.parse(text);
	} catch {
		throw new Error(`Failed to parse ImgChest response: ${text.slice(0, 300)}`);
	}

	return (json.data?.images ?? []).map((img: any) => img.link);
}

async function getMainViewUrl(): Promise<string> {
	const channel = await Updater.localInfo.channel();
	if (channel === "dev") {
		try {
			await fetch(DEV_SERVER_URL, { method: "HEAD" });
			console.log(`HMR enabled: Using Vite dev server at ${DEV_SERVER_URL}`);
			return DEV_SERVER_URL;
		} catch {
			console.log("Vite dev server not running. Run 'bun run dev:hmr' for HMR support.");
		}
	}
	return "views://mainview/index.html";
}

const dbPath = await getSettingsDbPath();
const db = initDb(dbPath);

const rpc = BrowserView.defineRPC<RpcSchema>({
	maxRequestTime: 120_000,
	handlers: {
		requests: {
			// --- Settings ---
			getSettings: () => {
				const row = db.query(`SELECT * FROM app_settings WHERE id = 1`).get() as Partial<AppSettings> | undefined;
				return { settings: { ...DEFAULT_SETTINGS, ...row }, dbPath };
			},
			saveSettings: (settings) => {
				db.query(`
					INSERT INTO app_settings (id, imgchestApiKey, githubToken, githubOwner, githubRepo, githubBranch)
					VALUES (1, ?, ?, ?, ?, ?)
					ON CONFLICT(id) DO UPDATE SET
						imgchestApiKey = excluded.imgchestApiKey,
						githubToken = excluded.githubToken,
						githubOwner = excluded.githubOwner,
						githubRepo = excluded.githubRepo,
						githubBranch = excluded.githubBranch
				`).run(
					settings.imgchestApiKey ?? "",
					settings.githubToken ?? "",
					settings.githubOwner ?? "",
					settings.githubRepo ?? "",
					settings.githubBranch ?? "main",
				);
				return { ok: true as const };
			},
			getTheme: () => {
				const row = db.query(`SELECT theme FROM app_settings WHERE id = 1`).get() as { theme: string } | undefined;
				return { theme: row?.theme ?? "light" };
			},
			setTheme: (params) => {
				db.query(`UPDATE app_settings SET theme = ? WHERE id = 1`).run(params.theme);
				return { ok: true as const };
			},

			// --- Manga Library ---
			listManga: () => {
				const rows = db.query(`SELECT id, folderPath FROM manga_library ORDER BY id`).all() as { id: number; folderPath: string }[];
				return rows.map(loadMangaEntry);
			},

			addMangaFolder: (params) => {
				const folderPath = params.folderPath;
				if (!existsSync(folderPath)) {
					mkdirSync(folderPath, { recursive: true });
				}

				let manga = readMangaJson(folderPath);
				if (!manga) {
					manga = { ...DEFAULT_MANGA, title: basename(folderPath) };
					writeMangaJson(folderPath, manga);
				}

				db.query(`INSERT OR IGNORE INTO manga_library (folderPath) VALUES (?)`).run(folderPath);
				const row = db.query(`SELECT id, folderPath FROM manga_library WHERE folderPath = ?`).get(folderPath) as { id: number; folderPath: string };
				return loadMangaEntry(row);
			},

			removeManga: (params) => {
				db.query(`DELETE FROM manga_library WHERE id = ?`).run(params.id);
				return { ok: true as const };
			},

			updateManga: (params) => {
				const row = db.query(`SELECT folderPath FROM manga_library WHERE id = ?`).get(params.id) as { folderPath: string } | undefined;
				if (!row) throw new Error("Manga not found");
				writeMangaJson(row.folderPath, params.manga);
				return { ok: true as const };
			},

			// --- Chapters ---
			addChapter: (params) => {
				const row = db.query(`SELECT folderPath FROM manga_library WHERE id = ?`).get(params.id) as { folderPath: string } | undefined;
				if (!row) throw new Error("Manga not found");
				const manga = readMangaJson(row.folderPath);
				if (!manga) throw new Error("manga.json not found");
				manga.chapters[params.chapterNum] = params.chapter;
				writeMangaJson(row.folderPath, manga);
				return { ok: true as const };
			},

			removeChapter: (params) => {
				const row = db.query(`SELECT folderPath FROM manga_library WHERE id = ?`).get(params.id) as { folderPath: string } | undefined;
				if (!row) throw new Error("Manga not found");
				const manga = readMangaJson(row.folderPath);
				if (!manga) throw new Error("manga.json not found");
				delete manga.chapters[params.chapterNum];
				writeMangaJson(row.folderPath, manga);
				return { ok: true as const };
			},

			// --- Upload ---
			uploadImages: async (params) => {
				const apiKey = getImgchestApiKey(db);
				if (!apiKey) throw new Error("ImgChest API key not configured");

				const row = db.query(`SELECT folderPath FROM manga_library WHERE id = ?`).get(params.id) as { folderPath: string } | undefined;
				if (!row) throw new Error("Manga not found");

				const urls = await uploadToImgChest(apiKey, params.filePaths);

				const manga = readMangaJson(row.folderPath);
				if (manga && manga.chapters[params.chapterNum]) {
					const chapter = manga.chapters[params.chapterNum];
					if (!chapter.groups[params.group]) {
						chapter.groups[params.group] = [];
					}
					chapter.groups[params.group].push(...urls);
					writeMangaJson(row.folderPath, manga);
				}

				return { urls };
			},

			// --- Native Dialogs ---
			pickFolder: async () => {
				const paths = await Utils.openFileDialog({
					canChooseFiles: false,
					canChooseDirectory: true,
					allowsMultipleSelection: false,
				});
				if (!paths || paths.length === 0) return null;
				return { path: paths[0] };
			},

			pickImages: async () => {
				const paths = await Utils.openFileDialog({
					allowedFileTypes: "*",
					canChooseFiles: true,
					canChooseDirectory: false,
					allowsMultipleSelection: true,
				});
				if (!paths || paths.length === 0) return null;
				return { paths };
			},

			// --- MangaBaka Search ---
			searchMangaBaka: async (params) => {
				const q = encodeURIComponent(params.query.trim());
				if (!q) return { results: [] };

				const res = await fetch(`https://api.mangabaka.dev/v1/series/search?q=${q}`, {
					headers: { Accept: "application/json" },
				});

				if (!res.ok) throw new Error(`MangaBaka search failed (${res.status})`);

				const json = (await res.json()) as { data: any[] };
				const results = (json.data ?? []).slice(0, 10).map((s: any) => ({
					id: s.id as number,
					title: (s.title ?? "") as string,
					description: (s.description ?? "") as string,
					author: (s.authors?.[0] ?? "") as string,
					artist: (s.artists?.[0] ?? "") as string,
					cover: (s.cover?.raw?.url ?? "") as string,
				}));

				return { results };
			},

			// --- Upload from folder ---
			uploadImagesFromFolder: async (params) => {
				const apiKey = getImgchestApiKey(db);
				if (!apiKey) throw new Error("ImgChest API key not configured");

				const row = db.query(`SELECT folderPath FROM manga_library WHERE id = ?`).get(params.id) as { folderPath: string } | undefined;
				if (!row) throw new Error("Manga not found");

				if (!existsSync(params.folderPath)) throw new Error("Images folder not found");

				const imageExts = new Set(["jpg", "jpeg", "png", "webp", "gif", "bmp", "tiff", "tif", "avif"]);
				const files = readdirSync(params.folderPath)
					.filter((f) => imageExts.has(f.split(".").pop()?.toLowerCase() ?? ""))
					.sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
					.map((f) => join(params.folderPath, f));

				if (files.length === 0) throw new Error("No image files found in folder");

				const urls = await uploadToImgChest(apiKey, files);

				const manga = readMangaJson(row.folderPath);
				if (manga && manga.chapters[params.chapterNum]) {
					const chapter = manga.chapters[params.chapterNum];
					if (!chapter.groups[params.group]) {
						chapter.groups[params.group] = [];
					}
					chapter.groups[params.group].push(...urls);
					writeMangaJson(row.folderPath, manga);
				}

				return { urls };
			},
		},
	},
});

const url = await getMainViewUrl();

const mainWindow = new BrowserWindow({
	title: "Kaguya",
	url,
	rpc,
	frame: {
		width: 1000,
		height: 750,
		x: 200,
		y: 200,
	},
});

mainWindow.setPageZoom(1);
console.log("Kaguya started!");
