<script lang="ts">
  import { onMount } from "svelte";
  import type { MangaEntry } from "../shared/types.ts";
  import PhPlus from "~icons/ph/plus";
  import PhMagnifyingGlass from "~icons/ph/magnifying-glass";
  import PhTrash from "~icons/ph/trash";
  import PhFolderOpen from "~icons/ph/folder-open";
  import PhWarningFill from "~icons/ph/warning-fill";

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
              <h3 class="card-title">{entry.manga.title}</h3>
              <p class="card-author">{entry.manga.author || entry.manga.artist || "Unknown"}</p>
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
            onclick={(e) => { e.stopPropagation(); confirmRemoveId = entry.id; }}
          >
            <PhTrash />
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
          <PhTrash />
          Remove
        </button>
      </div>
    </div>
  </div>
{/if}

<style>
  .library-page {
    display: flex;
    flex-direction: column;
    gap: 24px;
  }

  .page-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    flex-wrap: wrap;
    gap: 16px;
  }

  .page-title {
    font-size: 1.75rem;
    font-weight: 700;
    color: var(--text-primary);
    letter-spacing: -0.03em;
    margin: 0;
  }

  .page-subtitle {
    font-size: 0.85rem;
    color: var(--text-muted);
    margin: 4px 0 0;
    font-family: var(--mono);
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
    border: 1px solid var(--border-subtle);
    border-radius: var(--radius-sm);
    background: var(--bg-surface);
    color: var(--text-primary);
    font-family: inherit;
    font-size: 0.8rem;
    width: 180px;
    outline: none;
    transition: border-color 0.15s ease, box-shadow 0.15s ease;
  }

  .search-input::placeholder { color: var(--text-muted); }

  .search-input:focus {
    border-color: var(--accent-blue);
    box-shadow: 0 0 0 3px var(--accent-blue-light);
  }

  .add-btn {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 8px 16px;
    background: var(--accent-blue);
    border: none;
    border-radius: var(--radius-sm);
    color: #fff;
    font-family: inherit;
    font-size: 0.8rem;
    font-weight: 600;
    cursor: pointer;
    transition: background 0.15s ease;
    box-shadow: 0 1px 3px rgba(37, 99, 235, 0.25);
  }

  .add-btn:hover { background: var(--accent-blue-hover); }

  .add-btn:disabled { opacity: 0.6; cursor: default; pointer-events: none; }

  :global(.btn-icon) { font-size: 0.95rem; }

  /* Empty state */
  .empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 12px;
    padding: 60px 20px;
    text-align: center;
  }

  :global(.empty-icon) {
    font-size: 3rem;
    color: var(--text-muted);
    opacity: 0.5;
  }

  .empty-title {
    font-size: 1.1rem;
    font-weight: 600;
    color: var(--text-primary);
    margin: 0;
  }

  .empty-text {
    font-size: 0.85rem;
    color: var(--text-muted);
    margin: 0;
  }

  /* Cards grid */
  .cards-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
    gap: 16px;
  }

  .manga-card {
    position: relative;
    background: var(--bg-surface);
    border: 1px solid var(--border-subtle);
    border-radius: var(--radius-lg);
    overflow: hidden;
    box-shadow: var(--shadow-sm);
    transition: border-color 0.15s ease, box-shadow 0.15s ease, transform 0.15s ease;
  }

  .manga-card:hover {
    border-color: var(--border-default);
    box-shadow: var(--shadow-lg);
    transform: translateY(-3px);
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
  }

  .card-cover {
    position: relative;
    height: 180px;
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
  }

  .card-initial {
    font-size: 2.5rem;
    font-weight: 700;
    color: var(--text-muted);
    opacity: 0.4;
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
    font-weight: 600;
    border-radius: 999px;
  }

  .card-unavailable-badge :global(svg) { font-size: 0.75rem; }

  .card-body { padding: 14px 16px 16px; }

  .card-title {
    font-size: 0.9rem;
    font-weight: 600;
    color: var(--text-primary);
    margin: 0 0 2px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    letter-spacing: -0.01em;
  }

  .card-author {
    font-size: 0.75rem;
    color: var(--text-muted);
    margin: 0 0 10px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .card-meta {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .card-chapters {
    font-family: var(--mono);
    font-size: 0.7rem;
    color: var(--accent-blue);
    font-weight: 600;
    padding: 2px 8px;
    background: var(--accent-blue-light);
    border-radius: 999px;
  }

  .card-updated {
    font-family: var(--mono);
    font-size: 0.65rem;
    color: var(--text-muted);
  }

  .card-remove-btn {
    position: absolute;
    top: 8px;
    right: 8px;
    width: 28px;
    height: 28px;
    border-radius: var(--radius-sm);
    background: var(--bg-surface);
    border: 1px solid var(--border-subtle);
    color: var(--text-muted);
    cursor: pointer;
    display: grid;
    place-items: center;
    opacity: 0;
    transition: opacity 0.15s ease, color 0.15s ease, background 0.15s ease;
  }

  .manga-card:hover .card-remove-btn { opacity: 1; }

  .card-remove-btn:hover {
    color: var(--accent-rose);
    background: var(--accent-rose-light);
    border-color: var(--accent-rose);
  }

  .card-remove-btn :global(svg) { font-size: 0.85rem; }

  /* Modals */
  .modal-overlay {
    position: fixed;
    inset: 0;
    background: rgba(15, 23, 42, 0.4);
    backdrop-filter: blur(4px);
    display: grid;
    place-items: center;
    z-index: 50;
    padding: 20px;
  }

  .modal {
    background: var(--bg-surface);
    border: 1px solid var(--border-default);
    border-radius: var(--radius-lg);
    padding: 28px;
    max-width: 480px;
    width: 100%;
    box-shadow: var(--shadow-lg);
  }

  .modal-title {
    font-size: 1.15rem;
    font-weight: 700;
    color: var(--text-primary);
    margin: 0 0 10px;
    letter-spacing: -0.02em;
  }

  .modal-message {
    font-size: 0.85rem;
    color: var(--text-secondary);
    line-height: 1.6;
    margin: 0 0 18px;
  }

  .modal-actions {
    display: flex;
    gap: 10px;
    justify-content: flex-end;
  }

  .modal-btn-cancel {
    padding: 9px 20px;
    background: var(--bg-elevated);
    border: 1px solid var(--border-subtle);
    border-radius: var(--radius-sm);
    color: var(--text-secondary);
    font-family: inherit;
    font-size: 0.85rem;
    font-weight: 500;
    cursor: pointer;
    transition: border-color 0.15s ease, color 0.15s ease;
  }

  .modal-btn-cancel:hover {
    border-color: var(--border-default);
    color: var(--text-primary);
  }

  .modal-btn-danger {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 9px 20px;
    background: var(--accent-rose);
    border: none;
    border-radius: var(--radius-sm);
    color: #fff;
    font-family: inherit;
    font-size: 0.85rem;
    font-weight: 600;
    cursor: pointer;
    transition: background 0.15s ease;
  }

  .modal-btn-danger:hover { background: #be123c; }

  .modal-btn-danger :global(svg) { font-size: 0.95rem; }

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
      grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
    }

    .header-actions {
      flex-wrap: wrap;
    }
  }
</style>
