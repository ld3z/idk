<script lang="ts">
  import { onMount } from "svelte";
  import { prepare, layout } from "@chenglou/pretext";
  import type { MangaEntry, PendingSave } from "../shared/types.ts";
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
    pendingSaves: Map<number, PendingSave>;
    onPushComplete: () => void;
  }

  let { rpc, onSelectManga, pendingSaves, onPushComplete }: Props = $props();

  let library = $state<MangaEntry[]>([]);
  let loading = $state(true);
  let searchQuery = $state("");
  let addingManga = $state(false);
  let confirmRemoveId = $state<number | null>(null);

  type PushResult = { id: number; title: string; status: "ok"; cubariUrl: string } | { id: number; title: string; status: "err"; error: string };
  let pushing = $state(false);
  let pushResults = $state<PushResult[]>([]);
  let showPushModal = $state(false);

  let hasPendingPush = $derived(pendingSaves.size > 0);

  async function pushAllToGithub() {
    if (pushing || pendingSaves.size === 0) return;
    pushing = true;
    pushResults = [];
    showPushModal = true;

    for (const [id, save] of pendingSaves) {
      try {
        const res = await rpc.request.pushToGithub({ id });
        pushResults = [...pushResults, { id, title: save.title, status: "ok", cubariUrl: res.cubariUrl }];
      } catch (e: any) {
        pushResults = [...pushResults, { id, title: save.title, status: "err", error: e.message ?? "Unknown error" }];
      }
    }

    pushing = false;
    if (pushResults.every(r => r.status === "ok")) {
      onPushComplete();
    }
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
      <p class="page-eyebrow">Collection</p>
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
      {#if hasPendingPush}
      <button class="github-btn" type="button" onclick={pushAllToGithub} disabled={pushing} title="Push saved JSONs to GitHub">
        <PhGithubLogoFill class="btn-icon" />
        {pushing ? "Pushing..." : "Push to GitHub"}
      </button>
      {/if}
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
          Pushing {pushResults.length} / {pendingSaves.size}…
        {:else}
          {pushResults.filter(r => r.status === "ok").length} succeeded,
          {pushResults.filter(r => r.status === "err").length} failed.
        {/if}
      </p>
      <div class="push-list">
        {#each [...pendingSaves.entries()] as [id, save]}
          {@const entry = library.find(e => e.id === id)}
          {@const result = pushResults.find(r => r.id === id)}
          {@const errText = result?.status === "err" ? result.error : ""}
          {@const diff = save.diff}
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
                <span class="push-row-title">{save.title}</span>
                {#if result?.status === "ok"}
                  <button class="push-cubari-btn" type="button" onclick={() => rpc.request.openExternal({ url: result.cubariUrl })} title="Open in Cubari">
                    <PhArrowSquareOut />
                    Cubari
                  </button>
                {/if}
              </div>

              <!-- Diff summary -->
              <div class="push-diff">
                {#if diff.title}
                  <div class="diff-field">
                    <span class="diff-label">Title</span>
                    <span class="diff-before">{diff.title.before || "—"}</span>
                    <span class="diff-arrow">→</span>
                    <span class="diff-after">{diff.title.after || "—"}</span>
                  </div>
                {/if}
                {#if diff.author}
                  <div class="diff-field">
                    <span class="diff-label">Author</span>
                    <span class="diff-before">{diff.author.before || "—"}</span>
                    <span class="diff-arrow">→</span>
                    <span class="diff-after">{diff.author.after || "—"}</span>
                  </div>
                {/if}
                {#if diff.artist}
                  <div class="diff-field">
                    <span class="diff-label">Artist</span>
                    <span class="diff-before">{diff.artist.before || "—"}</span>
                    <span class="diff-arrow">→</span>
                    <span class="diff-after">{diff.artist.after || "—"}</span>
                  </div>
                {/if}
                {#if diff.cover}
                  <div class="diff-field">
                    <span class="diff-label">Cover</span>
                    <span class="diff-before diff-url">{diff.cover.before || "—"}</span>
                    <span class="diff-arrow">→</span>
                    <span class="diff-after diff-url">{diff.cover.after || "—"}</span>
                  </div>
                {/if}
                {#if diff.description}
                  <div class="diff-field diff-field--block">
                    <span class="diff-label">Description</span>
                    <span class="diff-before diff-block">{diff.description.before || "—"}</span>
                    <span class="diff-arrow diff-arrow--block">→</span>
                    <span class="diff-after diff-block">{diff.description.after || "—"}</span>
                  </div>
                {/if}
                {#if diff.chaptersAdded.length > 0}
                  <div class="diff-chapters diff-chapters--added">
                    <span class="diff-label">Added</span>
                    <span class="diff-chapter-list">{diff.chaptersAdded.map(c => `ch.${c}`).join(", ")}</span>
                  </div>
                {/if}
                {#if diff.chaptersRemoved.length > 0}
                  <div class="diff-chapters diff-chapters--removed">
                    <span class="diff-label">Removed</span>
                    <span class="diff-chapter-list">{diff.chaptersRemoved.map(c => `ch.${c}`).join(", ")}</span>
                  </div>
                {/if}
                {#if diff.chaptersModified.length > 0}
                  <div class="diff-chapters diff-chapters--modified">
                    <span class="diff-label">Modified</span>
                    <span class="diff-chapter-list">{diff.chaptersModified.map(c => `ch.${c}`).join(", ")}</span>
                  </div>
                {/if}
              </div>

              {#if result?.status === "err"}
                <p class="push-row-error">{errText}</p>
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
    gap: 36px;
  }

  .page-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-end;
    flex-wrap: wrap;
    gap: 16px;
  }

  .page-eyebrow {
    font-family: var(--mono);
    font-size: 0.65rem;
    font-weight: 400;
    letter-spacing: 0.2em;
    text-transform: uppercase;
    color: var(--text-muted);
    margin: 0 0 8px;
  }

  /* GitHub push button */
  .github-btn {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 7px 16px;
    background: var(--btn-bg);
    border: 1px solid var(--border-default);
    border-radius: var(--radius-pill);
    color: var(--btn-text);
    font-family: var(--mono);
    font-size: 0.65rem;
    font-weight: 400;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    cursor: pointer;
    transition-property: background, border-color, scale;
    transition-duration: 0.15s;
    transition-timing-function: ease;
  }

  .github-btn:hover {
    background: var(--btn-bg-hover);
    border-color: var(--border-strong);
  }

  .github-btn:active:not(:disabled) {
    scale: 0.96;
  }

  .github-btn:focus-visible {
    outline: 1px solid var(--focus-ring);
    outline-offset: 2px;
  }

  .github-btn:disabled {
    opacity: 0.35;
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

  .page-title {
    font-size: 2rem;
    font-weight: 400;
    font-family: var(--display);
    color: var(--text-primary);
    letter-spacing: -0.03em;
    margin: 0;
    line-height: 1.05;
    text-wrap: balance;
  }

  .page-subtitle {
    font-size: 0.72rem;
    color: var(--text-muted);
    margin: 6px 0 0;
    font-family: var(--mono);
    font-variant-numeric: tabular-nums;
    letter-spacing: 0.06em;
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
    font-size: 0.85rem;
    color: var(--text-faint);
    pointer-events: none;
  }

  .search-input {
    padding: 7px 12px 7px 30px;
    border: 1px solid var(--border-default);
    border-radius: var(--radius-pill);
    background: var(--bg-elevated);
    color: var(--text-primary);
    font-family: var(--sans);
    font-size: 0.78rem;
    width: 180px;
    outline: none;
    transition-property: border-color, background;
    transition-duration: 0.15s;
    transition-timing-function: ease;
  }

  .search-input::placeholder { color: var(--text-faint); }

  .search-input:focus {
    border-color: var(--border-mist);
    background: var(--bg-surface);
  }

  /* Primary pill button */
  .add-btn {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 7px 18px;
    background: var(--text-primary);
    border: 1px solid transparent;
    border-radius: var(--radius-pill);
    color: var(--bg-base);
    font-family: var(--mono);
    font-size: 0.65rem;
    font-weight: 400;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    cursor: pointer;
    transition-property: opacity, scale;
    transition-duration: 0.15s;
    transition-timing-function: ease;
  }

  .add-btn:hover { opacity: 0.88; }

  .add-btn:active:not(:disabled) {
    scale: 0.96;
  }

  .add-btn:focus-visible {
    outline: 1px solid var(--focus-ring);
    outline-offset: 2px;
  }

  .add-btn:disabled { opacity: 0.35; cursor: default; pointer-events: none; }

  :global(.btn-icon) { font-size: 0.85rem; }

  /* Empty state */
  .empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 12px;
    padding: 100px 20px;
    text-align: center;
  }

  :global(.empty-icon) {
    font-size: 2.5rem;
    color: var(--text-faint);
  }

  .empty-title {
    font-size: 1.4rem;
    font-weight: 400;
    font-family: var(--display);
    color: var(--text-secondary);
    margin: 0;
    line-height: 1.2;
    letter-spacing: -0.02em;
    text-wrap: balance;
  }

  .empty-text {
    font-size: 0.82rem;
    color: var(--text-muted);
    margin: 0;
    line-height: 1.6;
    text-wrap: pretty;
  }

  /* Cards grid */
  .cards-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(160px, 220px));
    gap: 14px;
  }

  .manga-card {
    position: relative;
    background: var(--bg-surface);
    border-radius: var(--radius-lg);
    overflow: hidden;
    border: 1px solid var(--border-subtle);
    transition-property: border-color, transform;
    transition-duration: 0.2s;
    transition-timing-function: ease;
    will-change: transform;
  }

  .manga-card:hover {
    border-color: var(--border-default);
    transform: translateY(-2px);
  }

  .manga-card:focus-within {
    border-color: var(--border-mist);
  }

  .manga-card.unavailable { opacity: 0.5; }

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
    outline: 1px solid rgba(255, 255, 255, 0.1);
    outline-offset: -1px;
  }

  :global(.light) .card-cover-img {
    outline-color: rgba(0, 0, 0, 0.1);
  }

  .card-initial {
    font-size: 2.5rem;
    font-weight: 400;
    font-family: var(--display);
    color: var(--text-faint);
    letter-spacing: -0.02em;
  }

  .card-unavailable-badge {
    position: absolute;
    bottom: 8px;
    left: 8px;
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 3px 8px;
    background: rgba(154, 122, 58, 0.15);
    color: var(--accent-amber);
    font-size: 0.6rem;
    font-weight: 400;
    font-family: var(--mono);
    letter-spacing: 0.08em;
    text-transform: uppercase;
    border-radius: var(--radius-pill);
    border: 1px solid rgba(154, 122, 58, 0.3);
  }

  .card-unavailable-badge :global(svg) { font-size: 0.7rem; }

  .card-body { padding: 12px 14px 14px; }

  .card-title {
    font-size: 0.85rem;
    font-weight: 400;
    font-family: var(--display);
    color: var(--text-primary);
    margin: 0 0 3px;
    letter-spacing: -0.01em;
    line-height: 17px;
    overflow: hidden;
    word-break: break-word;
    text-wrap: pretty;
  }

  .card-author {
    font-size: 0.7rem;
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
    font-size: 0.62rem;
    color: var(--text-muted);
    font-weight: 400;
    letter-spacing: 0.06em;
    font-variant-numeric: tabular-nums;
  }

  .card-updated {
    font-family: var(--mono);
    font-size: 0.6rem;
    color: var(--text-faint);
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
    background: var(--bg-elevated);
    border: 1px solid var(--border-default);
    color: var(--text-muted);
    cursor: pointer;
    display: grid;
    place-items: center;
    opacity: 0;
    transition-property: opacity, color, background, border-color, scale;
    transition-duration: 0.15s;
    transition-timing-function: ease;
  }

  .manga-card:hover .card-remove-btn,
  .manga-card:focus-within .card-remove-btn {
    opacity: 1;
  }

  @media (hover: none) {
    .card-remove-btn { opacity: 0.92; }
  }

  .card-remove-btn:hover {
    color: #d47070;
    background: rgba(154, 58, 58, 0.15);
    border-color: rgba(154, 58, 58, 0.4);
  }

  .card-remove-btn:active {
    scale: 0.96;
  }

  .card-remove-btn:hover :global(svg) {
    color: #d47070;
    opacity: 1;
  }

  .card-remove-btn:focus-visible {
    opacity: 1;
    outline: 1px solid var(--focus-ring);
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
    width: 15px;
    height: 15px;
    flex-shrink: 0;
    color: inherit;
    opacity: 1;
  }

  /* Modals */
  .modal-overlay {
    position: fixed;
    inset: 0;
    background: rgba(10, 10, 9, 0.7);
    display: grid;
    place-items: center;
    z-index: 50;
    padding: 20px;
    backdrop-filter: blur(4px);
  }

  .modal {
    background: var(--bg-elevated);
    border-radius: var(--radius-lg);
    padding: 28px;
    max-width: 480px;
    width: 100%;
    border: 1px solid var(--border-mist);
    box-shadow: var(--shadow-lg);
  }

  .modal-title {
    font-size: 1.15rem;
    font-weight: 400;
    font-family: var(--display);
    color: var(--text-primary);
    margin: 0 0 10px;
    line-height: 1.2;
    letter-spacing: -0.02em;
    text-wrap: balance;
  }

  .modal-message {
    font-size: 0.82rem;
    color: var(--text-secondary);
    line-height: 1.65;
    margin: 0 0 20px;
    text-wrap: pretty;
  }

  .modal-actions {
    display: flex;
    gap: 8px;
    justify-content: flex-end;
  }

  .modal-btn-cancel {
    padding: 8px 18px;
    background: var(--btn-bg);
    border: 1px solid var(--border-default);
    border-radius: var(--radius-pill);
    color: var(--btn-text);
    font-family: var(--mono);
    font-size: 0.65rem;
    font-weight: 400;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    cursor: pointer;
    transition-property: background, border-color, scale;
    transition-duration: 0.15s;
    transition-timing-function: ease;
  }

  .modal-btn-cancel:hover {
    background: var(--btn-bg-hover);
    border-color: var(--border-strong);
  }

  .modal-btn-cancel:active { scale: 0.96; }

  .modal-btn-cancel:focus-visible {
    outline: 1px solid var(--focus-ring);
    outline-offset: 2px;
  }

  .modal-btn-danger {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    padding: 8px 18px;
    background: rgba(154, 58, 58, 0.15);
    border: 1px solid rgba(154, 58, 58, 0.4);
    border-radius: var(--radius-pill);
    color: #d47070;
    font-family: var(--mono);
    font-size: 0.65rem;
    font-weight: 400;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    line-height: 1;
    cursor: pointer;
    transition-property: background, border-color, scale;
    transition-duration: 0.15s;
    transition-timing-function: ease;
  }

  .modal-btn-danger:hover {
    background: rgba(154, 58, 58, 0.25);
    border-color: rgba(154, 58, 58, 0.6);
  }

  .modal-btn-danger:active { scale: 0.96; }

  .modal-btn-danger:focus-visible {
    outline: 1px solid var(--focus-ring);
    outline-offset: 2px;
  }

  .modal-btn-danger :global(svg),
  :global(.modal-trash-icon) {
    display: block;
    width: 14px;
    height: 14px;
    flex-shrink: 0;
    color: inherit;
    opacity: 1;
  }

  .modal-icon-wrap {
    width: 44px;
    height: 44px;
    border-radius: 50%;
    background: rgba(154, 58, 58, 0.1);
    border: 1px solid rgba(154, 58, 58, 0.25);
    display: grid;
    place-items: center;
    margin: 0 auto 18px;
  }

  .modal-icon-wrap :global(svg) {
    font-size: 1.2rem;
    color: #d47070;
  }

  /* Push modal */
  .modal--push {
    max-width: 640px;
    text-align: left;
  }

  .modal-sub {
    font-size: 0.68rem;
    color: var(--text-muted);
    margin: 4px 0 16px;
    font-family: var(--mono);
    letter-spacing: 0.06em;
  }

  .push-list {
    display: flex;
    flex-direction: column;
    gap: 4px;
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
    background: var(--bg-elevated);
    border: 1px solid var(--border-subtle);
    min-width: 0;
  }

  .push-row--ok {
    border-color: rgba(90, 138, 94, 0.35);
    background: rgba(90, 138, 94, 0.06);
  }

  .push-row--err {
    border-color: rgba(154, 58, 58, 0.35);
    background: rgba(154, 58, 58, 0.06);
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
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: var(--border-strong);
    margin-top: 5px;
  }

  :global(.push-icon) { font-size: 0.9rem; }
  :global(.push-icon--ok) { color: var(--accent-green); }
  :global(.push-icon--err) { color: #d47070; }

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
    font-size: 0.8rem;
    font-weight: 400;
    font-family: var(--display);
    color: var(--text-primary);
    line-height: 18px;
    word-break: break-word;
    min-width: 0;
  }

  .push-row-error {
    font-size: 0.65rem;
    color: #d47070;
    font-family: var(--mono);
    word-break: break-word;
    white-space: pre-wrap;
    line-height: 17px;
    margin: 0;
  }

  /* Diff display */
  .push-diff {
    display: flex;
    flex-direction: column;
    gap: 4px;
    margin-top: 6px;
  }

  .diff-field {
    display: flex;
    align-items: baseline;
    gap: 6px;
    flex-wrap: wrap;
    font-size: 0.68rem;
    line-height: 1.4;
  }

  .diff-field--block {
    flex-direction: column;
    gap: 3px;
  }

  .diff-label {
    font-family: var(--mono);
    font-size: 0.58rem;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: var(--text-faint);
    flex-shrink: 0;
    min-width: 56px;
  }

  .diff-before {
    color: var(--text-muted);
    font-family: var(--sans);
    text-decoration: line-through;
    text-decoration-color: rgba(212, 112, 112, 0.5);
    word-break: break-word;
  }

  .diff-after {
    color: var(--text-primary);
    font-family: var(--sans);
    word-break: break-word;
  }

  .diff-arrow {
    color: var(--text-faint);
    font-size: 0.6rem;
    flex-shrink: 0;
  }

  .diff-arrow--block {
    display: none;
  }

  .diff-url {
    font-family: var(--mono);
    font-size: 0.6rem;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    max-width: 180px;
  }

  .diff-block {
    font-size: 0.65rem;
    line-height: 1.5;
    padding: 4px 8px;
    border-radius: var(--radius-xs);
    max-height: 60px;
    overflow: hidden;
    display: -webkit-box;
    -webkit-line-clamp: 3;
    -webkit-box-orient: vertical;
  }

  .diff-before.diff-block {
    background: rgba(154, 58, 58, 0.08);
    border: 1px solid rgba(154, 58, 58, 0.2);
  }

  .diff-after.diff-block {
    background: rgba(90, 138, 94, 0.08);
    border: 1px solid rgba(90, 138, 94, 0.2);
  }

  .diff-chapters {
    display: flex;
    align-items: baseline;
    gap: 6px;
    font-size: 0.65rem;
    flex-wrap: wrap;
  }

  .diff-chapter-list {
    font-family: var(--mono);
    font-size: 0.62rem;
    letter-spacing: 0.02em;
    word-break: break-word;
  }

  .diff-chapters--added .diff-label { color: var(--accent-green); }
  .diff-chapters--added .diff-chapter-list { color: var(--accent-green); }

  .diff-chapters--removed .diff-label { color: #d47070; }
  .diff-chapters--removed .diff-chapter-list { color: #d47070; }

  .diff-chapters--modified .diff-label { color: var(--text-muted); }
  .diff-chapters--modified .diff-chapter-list { color: var(--text-secondary); }

  .push-cubari-btn {
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 3px 10px;
    border: 1px solid rgba(90, 138, 94, 0.35);
    border-radius: var(--radius-pill);
    background: rgba(90, 138, 94, 0.08);
    color: var(--accent-green);
    font-family: var(--mono);
    font-size: 0.58rem;
    font-weight: 400;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    cursor: pointer;
    flex-shrink: 0;
    transition-property: background, scale;
    transition-duration: 0.15s;
    transition-timing-function: ease;
  }

  .push-cubari-btn:hover { background: rgba(90, 138, 94, 0.16); }
  .push-cubari-btn:active { scale: 0.96; }

  .push-cubari-btn:focus-visible {
    outline: 1px solid var(--focus-ring);
    outline-offset: 2px;
  }

  .push-cubari-btn :global(svg) { font-size: 0.65rem; }

  @media (max-width: 640px) {
    .cards-grid {
      grid-template-columns: repeat(auto-fill, minmax(130px, 180px));
    }

    .header-actions {
      flex-wrap: wrap;
    }
  }
</style>
