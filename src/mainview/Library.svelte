<script lang="ts">
  import PhMagnifyingGlass from "~icons/ph/magnifying-glass";
  import PhSlidersHorizontal from "~icons/ph/sliders-horizontal";

  type MangaStatus = "Reading" | "Plan to read" | "On hold" | "Completed";

  type Manga = {
    id: number;
    title: string;
    author: string;
    status: MangaStatus;
    progress: string;
    volumes: string;
    updated: string;
    color: string;
    tags: string[];
  };

  interface Props {
    mounted: boolean;
  }

  let { mounted }: Props = $props();

  const seedLibrary: Manga[] = [
    {
      id: 1,
      title: "Chains of the Moon",
      author: "M. Aoyama",
      status: "Reading",
      progress: "Vol. 8 / 14",
      volumes: "14 vols",
      updated: "Updated 2h ago",
      color: "#2563eb",
      tags: ["Seinen", "Action"],
    },
    {
      id: 2,
      title: "Paper Lantern Girl",
      author: "N. Hoshino",
      status: "Completed",
      progress: "Read 12 / 12",
      volumes: "12 vols",
      updated: "Finished last week",
      color: "#059669",
      tags: ["Romance", "Drama"],
    },
    {
      id: 3,
      title: "Steel Orchard",
      author: "K. Teshima",
      status: "On hold",
      progress: "Paused at Vol. 4",
      volumes: "9 vols",
      updated: "Paused 5 days ago",
      color: "#7c3aed",
      tags: ["Sci-Fi", "Mystery"],
    },
    {
      id: 4,
      title: "Garden of Quiet Stars",
      author: "R. Yamada",
      status: "Plan to read",
      progress: "Queued for next",
      volumes: "6 vols",
      updated: "Saved today",
      color: "#0891b2",
      tags: ["Slice of life", "Fantasy"],
    },
    {
      id: 5,
      title: "Rift Runner",
      author: "S. Kurono",
      status: "Reading",
      progress: "Vol. 2 / 11",
      volumes: "11 vols",
      updated: "Updated yesterday",
      color: "#e11d48",
      tags: ["Adventure", "Shounen"],
    },
    {
      id: 6,
      title: "Inkbound Library",
      author: "A. Shira",
      status: "Completed",
      progress: "Read 20 / 20",
      volumes: "20 vols",
      updated: "Completed 3 months ago",
      color: "#d97706",
      tags: ["Fantasy", "Mystery"],
    },
  ];

  let library = $state(seedLibrary);
  let activeFilter = $state<MangaStatus | "All">("All");

  const filters: (MangaStatus | "All")[] = ["All", "Reading", "Completed", "On hold", "Plan to read"];

  let filteredLibrary = $derived(
    activeFilter === "All" ? library : library.filter((m) => m.status === activeFilter)
  );

  function statusColor(status: MangaStatus) {
    switch (status) {
      case "Reading": return "var(--accent-blue)";
      case "Completed": return "var(--accent-green)";
      case "On hold": return "var(--accent-amber)";
      case "Plan to read": return "var(--text-muted)";
    }
  }

  function statusBg(status: MangaStatus) {
    switch (status) {
      case "Reading": return "var(--accent-blue-light)";
      case "Completed": return "var(--accent-green-light)";
      case "On hold": return "var(--accent-amber-light)";
      case "Plan to read": return "var(--bg-elevated)";
    }
  }
</script>

<div class="library-page">
  <div class="page-header">
    <div class="header-text">
      <h1 class="page-title">Library</h1>
      <p class="page-subtitle">{filteredLibrary.length} titles</p>
    </div>
    <div class="header-actions">
      <button class="icon-btn" type="button" title="Search">
        <PhMagnifyingGlass class="icon-btn-svg" />
      </button>
      <button class="icon-btn" type="button" title="Filter">
        <PhSlidersHorizontal class="icon-btn-svg" />
      </button>
    </div>
  </div>

  <div class="filter-bar">
    {#each filters as f}
      <button
        class="filter-chip"
        class:active={activeFilter === f}
        type="button"
        onclick={() => (activeFilter = f)}
      >
        {f}
        {#if f !== "All"}
          <span class="filter-count">{library.filter((m) => m.status === f).length}</span>
        {/if}
      </button>
    {/each}
  </div>

  <div class="cards-grid">
    {#each filteredLibrary as manga}
      <button class="manga-card" type="button">
        <div class="card-cover" style={`background: ${manga.color}`}>
          <span class="card-initial">{manga.title[0]}</span>
        </div>
        <div class="card-body">
          <h3 class="card-title">{manga.title}</h3>
          <p class="card-author">{manga.author}</p>
          <div class="card-footer">
            <span class="card-status" style={`color: ${statusColor(manga.status)}; background: ${statusBg(manga.status)}`}>
              {manga.status}
            </span>
            <span class="card-volumes">{manga.volumes}</span>
          </div>
          <div class="card-tags">
            {#each manga.tags as tag}
              <span class="card-tag">{tag}</span>
            {/each}
          </div>
        </div>
      </button>
    {/each}
  </div>
</div>

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
    gap: 6px;
  }

  .icon-btn {
    width: 38px;
    height: 38px;
    border-radius: var(--radius-sm);
    background: var(--bg-surface);
    border: 1px solid var(--border-subtle);
    color: var(--text-secondary);
    cursor: pointer;
    display: grid;
    place-items: center;
    transition: all 0.15s ease;
    box-shadow: var(--shadow-sm);
  }

  .icon-btn:hover {
    background: var(--bg-elevated);
    border-color: var(--border-default);
    color: var(--text-primary);
  }

  :global(.icon-btn-svg) {
    font-size: 1.1rem;
  }

  .filter-bar {
    display: flex;
    gap: 6px;
    flex-wrap: wrap;
  }

  .filter-chip {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 6px 14px;
    border: 1px solid var(--border-subtle);
    border-radius: 999px;
    background: var(--bg-surface);
    color: var(--text-secondary);
    font-family: inherit;
    font-size: 0.8rem;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .filter-chip:hover {
    border-color: var(--border-default);
    color: var(--text-primary);
  }

  .filter-chip.active {
    background: var(--accent-blue);
    border-color: var(--accent-blue);
    color: #fff;
  }

  .filter-count {
    font-family: var(--mono);
    font-size: 0.7rem;
    opacity: 0.7;
  }

  .filter-chip.active .filter-count {
    opacity: 0.85;
  }

  .cards-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
    gap: 16px;
  }

  .manga-card {
    background: var(--bg-surface);
    border: 1px solid var(--border-subtle);
    border-radius: var(--radius-lg);
    overflow: hidden;
    cursor: pointer;
    text-align: left;
    padding: 0;
    box-shadow: var(--shadow-sm);
    transition: border-color 0.15s ease, box-shadow 0.15s ease, transform 0.15s ease;
  }

  .manga-card:hover {
    border-color: var(--border-default);
    box-shadow: var(--shadow-lg);
    transform: translateY(-3px);
  }

  .card-cover {
    height: 140px;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .card-initial {
    font-size: 2.5rem;
    font-weight: 700;
    color: rgba(255, 255, 255, 0.85);
    letter-spacing: -0.03em;
  }

  .card-body {
    padding: 14px 16px 16px;
  }

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
  }

  .card-footer {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 8px;
  }

  .card-status {
    font-size: 0.7rem;
    font-weight: 600;
    padding: 3px 10px;
    border-radius: 999px;
  }

  .card-volumes {
    font-family: var(--mono);
    font-size: 0.7rem;
    color: var(--text-muted);
  }

  .card-tags {
    display: flex;
    gap: 4px;
    flex-wrap: wrap;
  }

  .card-tag {
    font-size: 0.65rem;
    padding: 2px 8px;
    border-radius: 999px;
    background: var(--bg-elevated);
    color: var(--text-muted);
    font-weight: 500;
    border: 1px solid var(--border-subtle);
  }

  @media (max-width: 640px) {
    .cards-grid {
      grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
    }
  }
</style>
