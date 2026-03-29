import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { Database } from "bun:sqlite";
import { BrowserView, BrowserWindow, Updater } from "electrobun/bun";

type AppSettings = {
	imgchestApiKey: string;
	githubToken: string;
	githubOwner: string;
	githubRepo: string;
	githubBranch: string;
};

type SettingsRpcSchema = {
	bun: {
		requests: {
			getSettings: { params: void; response: { settings: AppSettings; dbPath: string } };
			saveSettings: { params: AppSettings; response: { ok: true } };
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

const DB_FILENAME = "kaguya-settings.sqlite";
const DEV_SERVER_PORT = 5173;
const DEV_SERVER_URL = `http://localhost:${DEV_SERVER_PORT}`;

async function getSettingsDbPath() {
	const appDataFolder = await Updater.appDataFolder();
	mkdirSync(appDataFolder, { recursive: true });
	return join(appDataFolder, DB_FILENAME);
}

function createSettingsDb(dbPath: string) {
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
	return db;
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
const db = createSettingsDb(dbPath);

const settingsRpc = BrowserView.defineRPC<SettingsRpcSchema>({
	handlers: {
		requests: {
			getSettings: () => {
				const row = db.query(`SELECT * FROM app_settings WHERE id = 1`).get() as Partial<AppSettings> | undefined;
				return {
					settings: { ...DEFAULT_SETTINGS, ...row },
					dbPath,
				};
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
		},
	},
});

const url = await getMainViewUrl();

const mainWindow = new BrowserWindow({
	title: "Svelte App",
	url,
	rpc: settingsRpc,
	frame: {
		width: 900,
		height: 700,
		x: 200,
		y: 200,
	},
});

mainWindow.setPageZoom(1);

console.log("Svelte app started!");
