<script lang="ts">
  import { onMount } from "svelte";
  import { prepare, layout } from "@chenglou/pretext";
  import type { MangaEntry } from "../shared/types.ts";
  import PhPlus from "~icons/ph/plus";
  import PhMagnifyingGlass from "~icons/ph/magnifying-glass";
  import PhTrash from "~icons/ph/trash";
  import PhFolderOpen from "~icons/ph/folder-open";
  import PhWarningFill from "~icons/ph/warning-fill";
  import PhGithubLogoFill from "~icons/ph/github-logo-fill";
  import PhCheckCircle from "~icons/ph/check-circle";
  import PhXCircle from "~icons/ph/x-circle";
  import PhArrowSquareOut from "~icons/ph/arrow-square-out";

  interface Props {
    rpc: any;
    onSelectManga: (entry: MangaEntry) => void;
  }

  let { rpc, onSelectManga }: Props = $props();

  let library = $state<MangaEntry[]>([]);
  let loading = $state(true);
  let searchQuery = $state("");
  let addingManga = $state(false);
  let confirmRemoveId = $state<number | null>(null);

  type PushResult = { id: number; title: string; status: "ok"; cubariUrl: string } | { id: number; title: string; status: "err"; error: string };
  let pushing = $state(false);
  let pushResults = $state<PushResult[]>([]);
  let showPushModal = $state(false);

  async function pushAllToGithub() {
    if (pushing || library.length === 0) return;
    pushing = true;
    pushResults = [];
    showPushModal = true;

    for (const entry of library) {
      try {
        const res = await rpc.request.pushToGithub({ id: entry.id });
        pushResults = [...pushResults, { id: entry.id, title: entry.manga.title, status: "ok", cubariUrl: res.cubariUrl }];
      } catch (e: any) {
        pushResults = [...pushResults, { id: entry.id, title: entry.manga.title, status: "err", error: e.message ?? "Unknown error" }];
      }
    }

    pushing = false;
  }

  let filteredLibrary = $derived(
    searchQuery.trim()
      ? library.filter((m) =>
          m.manga.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
          m.manga.author.toLowerCase().includes(searchQuery.toLowerCase())
        )
      : library
  );

  async function loadLibrary() {
    if (!rpc) return;
    loading = true;
    try {
      const data = await rpc.request.listManga();
      console.log("[loadLibrary] got", data?.length, "entries:", JSON.stringify(data));
      library = data ?? [];
    } catch (e) {
      console.error("[loadLibrary] error:", e);
    }
    loading = false;
  }

  onMount(() => {
    loadLibrary();
  });

  async function addManga() {
    if (addingManga) return;
    addingManga = true;
    try {
      const result = await rpc.request.pickFolder();
      console.log("[addManga] pickFolder result:", JSON.stringify(result));
      if (!result) return;
      const folderPath = typeof result === "string" ? result : result.path;
      console.log("[addManga] folderPath:", folderPath);
      if (!folderPath) { console.error("[addManga] no path in result"); return; }
      const entry = await rpc.request.addMangaFolder({ folderPath });
      console.log("[addManga] addMangaFolder result:", JSON.stringify(entry));
      await loadLibrary();
      console.log("[addManga] library loaded, count:", library.length);
    } catch (e: any) {
      console.error("[addManga] error:", e);
    } finally {
      addingManga = false;
    }
  }

  async function removeManga(id: number) {
    try {
      await rpc.request.removeManga({ id });
      confirmRemoveId = null;
      await loadLibrary();
    } catch (e) {
      console.error("Failed to remove manga:", e);
    }
  }

  function formatDate(ts: string): string {
    if (!ts) return "";
    const d = new Date(Number(ts) * 1000);
    if (isNaN(d.getTime())) return "";
    return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
  }

  function getLastUpdated(entry: MangaEntry): string {
    const chapters = entry.manga.chapters;
    if (!chapters || Object.keys(chapters).length === 0) return "";
    let latest = 0;
    for (const ch of Object.values(chapters)) {
      const t = Number(ch.last_updated);
      if (t > latest) latest = t;
    }
    return latest ? formatDate(String(latest)) : "";
  }

  /** Narrowest column (150px @640px) − padding − border; pretext at min width so small cards never clip */
  const CARD_TEXT_WIDTH = 112;
  const CARD_TITLE_FONT = '500 14.4px "Newsreader", Georgia, "Times New Roman", serif';
  const CARD_TITLE_LINE_HEIGHT = 17;
  const CARD_AUTHOR_FONT = '400 12px "DM Sans", Arial, sans-serif';
  const CARD_AUTHOR_LINE_HEIGHT = 15;
  const CARD_TEXT_FUDGE = 2;

  // Push modal text sizing
  // modal--push is max 640px wide, padding 28px each side = 584px inner, minus status icon 18px + gap 10px = ~556px for text column
  const PUSH_TITLE_FONT = '500 13.1px "Newsreader", Georgia, "Times New Roman", serif';
  const PUSH_TITLE_LH = 18;
  const PUSH_TITLE_WIDTH = 380; // title flex:1, leaves room for cubari btn
  const PUSH_ERROR_FONT = '400 11.5px "IBM Plex Mono", ui-monospace, monospace';
  const PUSH_ERROR_LH = 17;
  const PUSH_ERROR_WIDTH = 540; // full row width minus icon indent

  function textHeight(text: string, widthPx: number, font: string, lh: number, minLines = 1): number {
    if (!text) return lh * minLines + CARD_TEXT_FUDGE;
    const p = prepare(text, font);
    const { height } = layout(p, widthPx, lh);
    return Math.max(height, lh * minLines) + CARD_TEXT_FUDGE;
  }
</script>

<div class="library-page">
  <div class="page-header">
    <div class="header-text">
      <h1 class="page-title">Library</h1>
      <p class="page-subtitle">{library.length} title{library.length !== 1 ? "s" : ""}</p>
    </div>
    <div class="header-actions">
      <div class="search-wrap">
        <PhMagnifyingGlass class="search-icon" />
        <input
          class="search-input"
          type="text"
          placeholder="Search..."
          bind:value={searchQuery}
        />
      </div>
      <button class="github-btn" type="button" onclick={pushAllToGithub} disabled={pushing || library.length === 0} title="Push all JSONs to GitHub">
        <PhGithubLogoFill class="btn-icon" />
        {pushing ? "Pushing..." : "Push to GitHub"}
      </button>
      <button class="add-btn" type="button" onclick={addManga} disabled={addingManga}>
        <PhPlus class="btn-icon" />
        {addingManga ? "Selecting..." : "Add Manga"}
      </button>
    </div>
  </div>

  {#if loading}
    <div class="empty-state">
      <p class="empty-text">Loading library...</p>
    </div>
  {:else if filteredLibrary.length === 0}
    <div class="empty-state">
      {#if library.length === 0}
        <PhFolderOpen class="empty-icon" />
        <p class="empty-title">No manga yet</p>
        <p class="empty-text">Add a manga folder to get started.</p>
        <button class="add-btn" type="button" onclick={addManga} disabled={addingManga}>
          <PhPlus class="btn-icon" />
          {addingManga ? "Selecting..." : "Add Manga"}
        </button>
      {:else}
        <p class="empty-text">No results for "{searchQuery}"</p>
      {/if}
    </div>
  {:else}
    <div class="cards-grid">
      {#each filteredLibrary as entry}
        <div class="manga-card" class:unavailable={!entry.available}>
          <button
            class="card-clickable"
            type="button"
            onclick={() => onSelectManga(entry)}
          >
            <div class="card-cover">
              {#if entry.manga.cover}
                <img
                  src={entry.manga.cover}
                  alt={entry.manga.title}
                  class="card-cover-img"
                  loading="lazy"
                />
              {:else}
                <span class="card-initial">{entry.manga.title[0] ?? "?"}</span>
              {/if}
              {#if !entry.available}
                <div class="card-unavailable-badge">
                  <PhWarningFill />
                  Unavailable
                </div>
              {/if}
            </div>
            <div class="card-body">
              <h3
                class="card-title"
                style="min-height:{textHeight(entry.manga.title, CARD_TEXT_WIDTH, CARD_TITLE_FONT, CARD_TITLE_LINE_HEIGHT)}px"
              >{entry.manga.title}</h3>
              <p
                class="card-author"
                style="min-height:{textHeight(entry.manga.author || entry.manga.artist || 'Unknown', CARD_TEXT_WIDTH, CARD_AUTHOR_FONT, CARD_AUTHOR_LINE_HEIGHT)}px"
              >{entry.manga.author || entry.manga.artist || "Unknown"}</p>
              <div class="card-meta">
                <span class="card-chapters">{entry.chapterCount} ch.</span>
                {#if getLastUpdated(entry)}
                  <span class="card-updated">{getLastUpdated(entry)}</span>
                {/if}
              </div>
            </div>
          </button>
          <button
            class="card-remove-btn"
            type="button"
            title="Remove from library"
            aria-label="Remove {entry.manga.title} from library"
            onclick={(e) => { e.stopPropagation(); confirmRemoveId = entry.id; }}
          >
            <span class="card-remove-btn-inner" aria-hidden="true">
              <PhTrash class="card-trash-icon" />
            </span>
          </button>
        </div>
      {/each}
    </div>
  {/if}
</div>

{#if confirmRemoveId !== null}
  {@const manga = library.find((m) => m.id === confirmRemoveId)}
  <div class="modal-overlay" role="dialog" aria-modal="true" onclick={() => (confirmRemoveId = null)}>
    <div class="modal" onclick={(e) => e.stopPropagation()}>
      <div class="modal-icon-wrap">
        <PhWarningFill />
      </div>
      <h2 class="modal-title">Remove from Library?</h2>
      <p class="modal-message">
        Remove <strong>{manga?.manga.title ?? "this manga"}</strong> from your library?
        The folder and files on disk will not be deleted.
      </p>
      <div class="modal-actions">
        <button class="modal-btn-cancel" type="button" onclick={() => (confirmRemoveId = null)}>Cancel</button>
        <button class="modal-btn-danger" type="button" onclick={() => confirmRemoveId !== null && removeManga(confirmRemoveId)}>
          <PhTrash class="modal-trash-icon" />
          Remove
        </button>
      </div>
    </div>
  </div>
{/if}

{#if showPushModal}
  <div class="modal-overlay" role="dialog" aria-modal="true">
    <div class="modal modal--push" onclick={(e) => e.stopPropagation()}>
      <h2 class="modal-title">Push to GitHub</h2>
      <p class="modal-sub">
        {#if pushing}
          Pushing {pushResults.length} / {library.length}…
        {:else}
          {pushResults.filter(r => r.status === "ok").length} succeeded,
          {pushResults.filter(r => r.status === "err").length} failed.
        {/if}
      </p>
      <div class="push-list">
        {#each library as entry}
          {@const result = pushResults.find(r => r.id === entry.id)}
          {@const errText = result?.status === "err" ? result.error : ""}
          <div class="push-row" class:push-row--ok={result?.status === "ok"} class:push-row--err={result?.status === "err"}>
            <div class="push-row-status">
              {#if !result}
                <span class="push-dot push-dot--pending"></span>
              {:else if result.status === "ok"}
                <PhCheckCircle class="push-icon push-icon--ok" />
              {:else}
                <PhXCircle class="push-icon push-icon--err" />
              {/if}
            </div>
            <div class="push-row-body">
              <div class="push-row-title-line">
                <span
                  class="push-row-title"
                  style="min-height:{textHeight(entry.manga.title, PUSH_TITLE_WIDTH, PUSH_TITLE_FONT, PUSH_TITLE_LH)}px"
                >{entry.manga.title}</span>
                {#if result?.status === "ok"}
                  <button class="push-cubari-btn" type="button" onclick={() => rpc.request.openExternal({ url: result.cubariUrl })} title="Open in Cubari">
                    <PhArrowSquareOut />
                    Cubari
                  </button>
                {/if}
              </div>
              {#if result?.status === "err"}
                <p
                  class="push-row-error"
                  style="min-height:{textHeight(errText, PUSH_ERROR_WIDTH, PUSH_ERROR_FONT, PUSH_ERROR_LH)}px"
                >{errText}</p>
              {/if}
            </div>
          </div>
        {/each}
      </div>
      {#if !pushing}
        <div class="modal-actions">
          <button class="modal-btn-cancel" type="button" onclick={() => (showPushModal = false)}>Close</button>
        </div>
      {/if}
    </div>
  </div>
{/if}

<style>
  .library-page {
    display: flex;
    flex-direction: column;
    gap: 28px;
  }

  .page-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-end;
    flex-wrap: wrap;
    gap: 16px;
  }

  /* GitHub push button */
  .github-btn {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 8px 16px;
    background: var(--bg-surface);
    border: none;
    border-radius: var(--radius-sm);
    color: var(--text-primary);
    font-family: var(--sans);
    font-size: 0.8rem;
    font-weight: 500;
    cursor: pointer;
    box-shadow: 0px 0px 0px 1px var(--border-strong);
    transition-property: background, box-shadow, scale;
    transition-duration: 0.15s;
    transition-timing-function: ease;
  }

  .github-btn:hover {
    background: var(--bg-elevated);
    box-shadow: 0px 0px 0px 1px var(--text-muted);
  }

  .github-btn:active:not(:disabled) {
    scale: 0.96;
  }

  .github-btn:focus-visible {
    outline: 2px solid var(--focus-blue);
    outline-offset: 2px;
  }

  .github-btn:disabled {
    opacity: 0.45;
    cursor: default;
    pointer-events: none;
  }

  /* Push modal */
  .modal--push {
    max-width: 640px;
    text-align: left;
  }

  .modal-sub {
    font-size: 0.82rem;
    color: var(--text-muted);
    margin: 4px 0 16px;
    font-family: var(--mono);
  }

  .push-list {
    display: flex;
    flex-direction: column;
    gap: 6px;
    max-height: 420px;
    overflow-y: auto;
    margin-bottom: 20px;
  }

  .push-row {
    display: flex;
    align-items: flex-start;
    gap: 10px;
    padding: 9px 12px;
    border-radius: var(--radius-sm);
    background: var(--bg-base);
    box-shadow: 0px 0px 0px 1px var(--border-subtle);
    min-width: 0;
  }

  .push-row--ok {
    box-shadow: 0px 0px 0px 1px var(--accent-green);
    background: var(--accent-green-light);
  }

  .push-row--err {
    box-shadow: 0px 0px 0px 1px var(--accent-rose);
    background: var(--accent-rose-light);
  }

  .push-row-status {
    flex-shrink: 0;
    width: 18px;
    display: grid;
    place-items: start center;
    padding-top: 2px;
  }

  .push-dot--pending {
    display: block;
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: var(--border-strong);
    margin-top: 4px;
  }

  :global(.push-icon) { font-size: 1rem; }
  :global(.push-icon--ok) { color: var(--accent-green); }
  :global(.push-icon--err) { color: var(--accent-rose); }

  .push-row-body {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .push-row-title-line {
    display: flex;
    align-items: flex-start;
    gap: 8px;
    min-width: 0;
  }

  .push-row-title {
    flex: 1;
    font-size: 0.82rem;
    font-weight: 500;
    font-family: var(--serif);
    color: var(--text-primary);
    line-height: 18px;
    word-break: break-word;
    min-width: 0;
  }

  .push-row-error {
    font-size: 0.72rem;
    color: var(--accent-rose);
    font-family: var(--mono);
    word-break: break-word;
    white-space: pre-wrap;
    line-height: 17px;
    margin: 0;
  }

  .push-cubari-btn {
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 3px 10px;
    border: none;
    border-radius: 999px;
    background: var(--accent-green-light);
    color: var(--accent-green);
    font-family: var(--mono);
    font-size: 0.62rem;
    font-weight: 600;
    cursor: pointer;
    flex-shrink: 0;
    box-shadow: 0px 0px 0px 1px color-mix(in srgb, var(--accent-green) 35%, transparent);
  }

  .push-cubari-btn:hover {
    background: var(--accent-green);
    color: #faf9f5;
  }

  .push-cubari-btn:focus-visible {
    outline: 2px solid var(--focus-blue);
    outline-offset: 2px;
  }

  .push-cubari-btn :global(svg) { font-size: 0.72rem; }

  .page-title {
    font-size: 2.3rem;
    font-weight: 500;
    font-family: var(--serif);
    color: var(--text-primary);
    letter-spacing: -0.02em;
    margin: 0;
    line-height: 1.1;
    text-wrap: balance;
  }

  .page-subtitle {
    font-size: 0.82rem;
    color: var(--text-muted);
    margin: 6px 0 0;
    font-family: var(--mono);
    font-variant-numeric: tabular-nums;
  }

  .header-actions {
    display: flex;
    gap: 8px;
    align-items: center;
  }

  .search-wrap {
    position: relative;
    display: flex;
    align-items: center;
  }

  :global(.search-icon) {
    position: absolute;
    left: 10px;
    font-size: 0.95rem;
    color: var(--text-muted);
    pointer-events: none;
  }

  .search-input {
    padding: 8px 12px 8px 32px;
    border: none;
    border-radius: var(--radius-md);
    background: var(--bg-surface);
    color: var(--text-primary);
    font-family: var(--sans);
    font-size: 0.8rem;
    width: 180px;
    outline: none;
    transition-property: box-shadow;
    transition-duration: 0.15s;
    transition-timing-function: ease;
    box-shadow: 0px 0px 0px 1px var(--border-default);
  }

  .search-input::placeholder { color: var(--text-muted); }

  .search-input:focus {
    box-shadow: 0px 0px 0px 1px var(--focus-blue), 0px 0px 0px 4px rgba(56, 152, 236, 0.15);
  }

  /* Terracotta brand button */
  .add-btn {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 8px 16px;
    background: var(--accent-brand);
    border: none;
    border-radius: var(--radius-sm);
    color: #faf9f5;
    font-family: var(--sans);
    font-size: 0.8rem;
    font-weight: 500;
    cursor: pointer;
    transition-property: background, scale;
    transition-duration: 0.15s;
    transition-timing-function: ease;
    box-shadow: 0px 0px 0px 1px var(--accent-brand);
  }

  .add-btn:hover { background: var(--accent-brand-hover); }

  .add-btn:active:not(:disabled) {
    scale: 0.96;
  }

  .add-btn:focus-visible {
    outline: 2px solid var(--focus-blue);
    outline-offset: 2px;
  }

  .add-btn:disabled { opacity: 0.6; cursor: default; pointer-events: none; }

  :global(.btn-icon) { font-size: 0.95rem; }

  /* Empty state */
  .empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 12px;
    padding: 80px 20px;
    text-align: center;
  }

  :global(.empty-icon) {
    font-size: 3rem;
    color: var(--text-muted);
    opacity: 0.4;
  }

  .empty-title {
    font-size: 1.3rem;
    font-weight: 500;
    font-family: var(--serif);
    color: var(--text-primary);
    margin: 0;
    line-height: 1.2;
    text-wrap: balance;
  }

  .empty-text {
    font-size: 0.88rem;
    color: var(--text-muted);
    margin: 0;
    line-height: 1.6;
    text-wrap: pretty;
  }

  /* Cards grid */
  .cards-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(180px, 240px));
    gap: 18px;
  }

  .manga-card {
    position: relative;
    background: var(--bg-surface);
    border-radius: var(--radius-lg);
    overflow: hidden;
    box-shadow: var(--shadow-sm);
    transition-property: box-shadow, transform;
    transition-duration: 0.2s;
    transition-timing-function: ease;
    will-change: transform;
  }

  .manga-card:hover {
    box-shadow: var(--shadow-md);
    transform: translateY(-2px);
  }

  .manga-card:focus-within {
    box-shadow: 0px 0px 0px 1px var(--accent-brand), 0px 0px 0px 4px rgba(201, 100, 66, 0.12);
  }

  .manga-card.unavailable { opacity: 0.6; }

  .card-clickable {
    display: block;
    width: 100%;
    text-align: left;
    padding: 0;
    border: none;
    background: none;
    cursor: pointer;
    color: inherit;
    font: inherit;
    border-radius: var(--radius-lg);
  }

  .card-clickable:focus-visible {
    outline: 2px solid var(--focus-blue);
    outline-offset: -2px;
  }

  .card-cover {
    position: relative;
    width: 100%;
    aspect-ratio: 3 / 4;
    background: var(--bg-elevated);
    display: flex;
    align-items: center;
    justify-content: center;
    overflow: hidden;
  }

  .card-cover-img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    object-position: center top;
    outline: 1px solid rgba(0, 0, 0, 0.1);
    outline-offset: -1px;
  }

  :global(.dark) .card-cover-img {
    outline-color: rgba(255, 255, 255, 0.1);
  }

  .card-initial {
    font-size: 2.5rem;
    font-weight: 500;
    font-family: var(--serif);
    color: var(--text-muted);
    opacity: 0.35;
  }

  .card-unavailable-badge {
    position: absolute;
    bottom: 8px;
    left: 8px;
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 3px 8px;
    background: var(--accent-amber-light);
    color: var(--accent-amber);
    font-size: 0.65rem;
    font-weight: 500;
    border-radius: 999px;
  }

  .card-unavailable-badge :global(svg) { font-size: 0.75rem; }

  .card-body { padding: 14px 16px 16px; }

  .card-title {
    font-size: 0.9rem;
    font-weight: 500;
    font-family: var(--serif);
    color: var(--text-primary);
    margin: 0 0 2px;
    letter-spacing: -0.01em;
    line-height: 17px;
    overflow: hidden;
    word-break: break-word;
    text-wrap: pretty;
  }

  .card-author {
    font-size: 0.75rem;
    color: var(--text-muted);
    margin: 0 0 10px;
    line-height: 15px;
    overflow: hidden;
    word-break: break-word;
    text-wrap: pretty;
  }

  .card-meta {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .card-chapters {
    font-family: var(--mono);
    font-size: 0.7rem;
    color: var(--accent-brand);
    font-weight: 500;
    padding: 2px 8px;
    background: var(--accent-brand-light);
    border-radius: 999px;
    font-variant-numeric: tabular-nums;
  }

  .card-updated {
    font-family: var(--mono);
    font-size: 0.65rem;
    color: var(--text-muted);
    font-variant-numeric: tabular-nums;
  }

  .card-remove-btn {
    position: absolute;
    top: 8px;
    right: 8px;
    z-index: 4;
    width: 40px;
    height: 40px;
    padding: 0;
    border-radius: 50%;
    background: var(--bg-surface);
    border: none;
    color: var(--text-secondary);
    cursor: pointer;
    display: grid;
    place-items: center;
    opacity: 0;
    box-shadow: var(--shadow-sm);
    transition-property: opacity, color, background, scale;
    transition-duration: 0.15s;
    transition-timing-function: ease;
  }

  .manga-card:hover .card-remove-btn,
  .manga-card:focus-within .card-remove-btn {
    opacity: 1;
  }

  @media (hover: none) {
    .card-remove-btn {
      opacity: 0.92;
    }
  }

  .card-remove-btn:hover {
    color: #faf9f5;
    background: var(--accent-rose);
    box-shadow: 0px 0px 0px 1px var(--accent-rose);
  }

  .card-remove-btn:active {
    scale: 0.96;
  }

  .card-remove-btn:hover :global(svg) {
    color: #faf9f5;
    opacity: 1;
  }

  .card-remove-btn:focus-visible {
    opacity: 1;
    outline: 2px solid var(--focus-blue);
    outline-offset: 2px;
  }

  .card-remove-btn-inner {
    display: grid;
    place-items: center;
    width: 100%;
    height: 100%;
  }

  .card-remove-btn-inner :global(svg),
  :global(.card-trash-icon) {
    display: block;
    width: 17px;
    height: 17px;
    flex-shrink: 0;
    color: inherit;
    opacity: 1;
  }

  /* Modals */
  .modal-overlay {
    position: fixed;
    inset: 0;
    background: rgba(20, 20, 19, 0.45);
    display: grid;
    place-items: center;
    z-index: 50;
    padding: 20px;
  }

  .modal {
    background: var(--bg-surface);
    border-radius: var(--radius-lg);
    padding: 28px;
    max-width: 480px;
    width: 100%;
    box-shadow: var(--shadow-lg);
  }

  .modal-title {
    font-size: 1.25rem;
    font-weight: 500;
    font-family: var(--serif);
    color: var(--text-primary);
    margin: 0 0 10px;
    line-height: 1.2;
    text-wrap: balance;
  }

  .modal-message {
    font-size: 0.88rem;
    color: var(--text-secondary);
    line-height: 1.6;
    margin: 0 0 18px;
    text-wrap: pretty;
  }

  .modal-actions {
    display: flex;
    gap: 10px;
    justify-content: flex-end;
  }

  /* Warm Sand cancel button */
  .modal-btn-cancel {
    padding: 9px 20px;
    background: var(--bg-elevated);
    border: none;
    border-radius: var(--radius-sm);
    color: var(--text-primary);
    font-family: var(--sans);
    font-size: 0.85rem;
    font-weight: 500;
    cursor: pointer;
    box-shadow: 0px 0px 0px 1px var(--border-strong);
    transition-property: background, scale;
    transition-duration: 0.15s;
    transition-timing-function: ease;
  }

  .modal-btn-cancel:hover {
    background: var(--border-default);
  }

  .modal-btn-cancel:active {
    scale: 0.96;
  }

  .modal-btn-cancel:focus-visible {
    outline: 2px solid var(--focus-blue);
    outline-offset: 2px;
  }

  /* Error crimson danger button */
  .modal-btn-danger {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    padding: 9px 20px;
    background: var(--accent-rose);
    border: none;
    border-radius: var(--radius-sm);
    color: #faf9f5;
    font-family: var(--sans);
    font-size: 0.85rem;
    font-weight: 500;
    line-height: 1;
    cursor: pointer;
    box-shadow: 0px 0px 0px 1px var(--accent-rose);
    transition-property: background, scale;
    transition-duration: 0.15s;
    transition-timing-function: ease;
  }

  .modal-btn-danger:hover { background: #9a2b2b; }

  .modal-btn-danger:active {
    scale: 0.96;
  }

  .modal-btn-danger:focus-visible {
    outline: 2px solid var(--focus-blue);
    outline-offset: 2px;
  }

  .modal-btn-danger :global(svg),
  :global(.modal-trash-icon) {
    display: block;
    width: 18px;
    height: 18px;
    flex-shrink: 0;
    color: #faf9f5;
    opacity: 1;
  }

  .modal-icon-wrap {
    width: 52px;
    height: 52px;
    border-radius: 50%;
    background: var(--accent-rose-light);
    display: grid;
    place-items: center;
    margin: 0 auto 18px;
  }

  .modal-icon-wrap :global(svg) {
    font-size: 1.5rem;
    color: var(--accent-rose);
  }

  @media (max-width: 640px) {
    .cards-grid {
      grid-template-columns: repeat(auto-fill, minmax(140px, 200px));
    }

    .header-actions {
      flex-wrap: wrap;
    }
  }
</style>
