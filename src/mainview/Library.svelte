<script lang="ts">
  import Icon from "@iconify/svelte";

  type MangaStatus = "Reading" | "Plan to read" | "On hold" | "Completed";

  type Manga = {
    id: number;
    title: string;
    author: string;
    status: MangaStatus;
    progress: string;
    rating: number;
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
      rating: 4.8,
      volumes: "14 vols",
      updated: "Updated 2h ago",
      color: "linear-gradient(135deg, #00d4ff 0%, #09090b 100%)",
      tags: ["Seinen", "Action"],
    },
    {
      id: 2,
      title: "Paper Lantern Girl",
      author: "N. Hoshino",
      status: "Completed",
      progress: "Read 12 / 12",
      rating: 4.9,
      volumes: "12 vols",
      updated: "Finished last week",
      color: "linear-gradient(135deg, #ff6b35 0%, #09090b 100%)",
      tags: ["Romance", "Drama"],
    },
    {
      id: 3,
      title: "Steel Orchard",
      author: "K. Teshima",
      status: "On hold",
      progress: "Paused at Vol. 4",
      rating: 4.2,
      volumes: "9 vols",
      updated: "Paused 5 days ago",
      color: "linear-gradient(135deg, #a855f7 0%, #09090b 100%)",
      tags: ["Sci-Fi", "Mystery"],
    },
    {
      id: 4,
      title: "Garden of Quiet Stars",
      author: "R. Yamada",
      status: "Plan to read",
      progress: "Queued for next",
      rating: 4.6,
      volumes: "6 vols",
      updated: "Saved today",
      color: "linear-gradient(135deg, #22c55e 0%, #09090b 100%)",
      tags: ["Slice of life", "Fantasy"],
    },
    {
      id: 5,
      title: "Rift Runner",
      author: "S. Kurono",
      status: "Reading",
      progress: "Vol. 2 / 11",
      rating: 4.4,
      volumes: "11 vols",
      updated: "Updated yesterday",
      color: "linear-gradient(135deg, #ec4899 0%, #09090b 100%)",
      tags: ["Adventure", "Shounen"],
    },
    {
      id: 6,
      title: "Inkbound Library",
      author: "A. Shira",
      status: "Completed",
      progress: "Read 20 / 20",
      rating: 5.0,
      volumes: "20 vols",
      updated: "Completed 3 months ago",
      color: "linear-gradient(135deg, #eab308 0%, #09090b 100%)",
      tags: ["Fantasy", "Mystery"],
    },
  ];

  function getCardDelay(index: number) {
    return `${0.05 * (index % 6)}s`;
  }

  let library = $state(seedLibrary);
</script>

<div class="library-wrapper">
  <div class="library-header" class:visible={mounted}>
    <div class="header-left">
      <h1 class="page-title">Library</h1>
      <span class="item-count">{library.length} manga</span>
    </div>
    <div class="header-actions">
      <button class="action-btn" type="button">
        <Icon icon="ph:magnifying-glass" class="action-icon" />
      </button>
      <button class="action-btn" type="button">
        <Icon icon="ph:funnel" class="action-icon" />
      </button>
    </div>
  </div>

  <div class="library-grid">
    {#each library as manga, i}
      <button
        class="manga-card"
        class:visible={mounted}
        type="button"
        style={`transition-delay: ${getCardDelay(i)}`}
      >
        <div class="cover" style={`background:${manga.color}`}>
          <span class="cover-letter">{manga.title.slice(0, 2).toUpperCase()}</span>
          <div class="cover-overlay">
            <Icon icon="ph:eye" class="preview-icon" />
          </div>
        </div>
        <div class="manga-info">
          <div class="title-row">
            <h3 class="manga-title">{manga.title}</h3>
            <div class="rating" style={`--rating-color: ${manga.rating >= 4.5 ? 'var(--accent-amber)' : 'var(--accent-muted)'}`}>
              <Icon icon="ph:star-fill" class="star-icon" />
              <span>{manga.rating.toFixed(1)}</span>
            </div>
          </div>
          <p class="author">{manga.author}</p>
          <span class="volumes">{manga.volumes}</span>
        </div>
      </button>
    {/each}
  </div>
</div>

<style>
  .library-wrapper {
    display: block;
    flex: 1;
    position: relative;
    z-index: 1;
  }

  /* Library header */
  .library-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 28px;
    opacity: 0;
    transform: translateY(-8px);
    transition: all 0.4s ease;
  }

  .library-header.visible {
    opacity: 1;
    transform: translateY(0);
  }

  .header-left {
    display: flex;
    align-items: baseline;
    gap: 12px;
  }

  .page-title {
    font-size: 1.75rem;
    font-weight: 600;
    color: var(--text-primary);
    letter-spacing: -0.02em;
  }

  .item-count {
    font-size: 0.85rem;
    color: var(--text-muted);
    font-family: "JetBrains Mono", monospace;
  }

  .header-actions {
    display: flex;
    gap: 8px;
  }

  .action-btn {
    width: 40px;
    height: 40px;
    border-radius: 10px;
    background: var(--bg-surface);
    border: 1px solid var(--border-subtle);
    color: var(--text-muted);
    cursor: pointer;
    display: grid;
    place-items: center;
    transition: all 0.2s ease;
  }

  .action-btn:hover {
    background: var(--bg-elevated);
    color: var(--text-secondary);
    border-color: var(--border-default);
  }

  :global(.action-icon) {
    font-size: 1.1rem;
  }

  /* Library grid */
  .library-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
    gap: 20px;
  }

  .manga-card {
    background: var(--bg-surface);
    border: 1px solid var(--border-subtle);
    border-radius: 14px;
    padding: 14px;
    cursor: pointer;
    text-align: left;
    opacity: 0;
    transform: translateY(20px) scale(0.98);
    transition: all 0.35s cubic-bezier(0.4, 0, 0.2, 1);
  }

  .manga-card.visible {
    opacity: 1;
    transform: translateY(0) scale(1);
  }

  .manga-card:hover {
    border-color: var(--border-default);
    transform: translateY(-4px);
    box-shadow: 0 12px 40px rgba(0, 0, 0, 0.4);
  }

  .cover {
    aspect-ratio: 3/4;
    border-radius: 10px;
    display: flex;
    align-items: flex-end;
    padding: 14px;
    margin-bottom: 14px;
    position: relative;
    overflow: hidden;
  }

  .cover::after {
    content: '';
    position: absolute;
    bottom: 0;
    left: 0;
    right: 0;
    height: 60%;
    background: linear-gradient(to top, rgba(0,0,0,0.6) 0%, transparent 100%);
    pointer-events: none;
  }

  .cover-letter {
    font-family: "Outfit", sans-serif;
    font-weight: 700;
    font-size: 1.6rem;
    color: var(--text-primary);
    text-shadow: 0 2px 12px rgba(0, 0, 0, 0.6);
    position: relative;
    z-index: 1;
  }

  .cover-overlay {
    position: absolute;
    inset: 0;
    display: grid;
    place-items: center;
    background: rgba(0, 0, 0, 0.5);
    opacity: 0;
    transition: all 0.25s ease;
  }

  .manga-card:hover .cover-overlay {
    opacity: 1;
  }

  :global(.preview-icon) {
    font-size: 2rem;
    color: var(--text-primary);
  }

  .manga-info {
    padding: 0 2px;
  }

  .title-row {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 8px;
    margin-bottom: 4px;
  }

  .manga-title {
    font-size: 0.95rem;
    font-weight: 600;
    color: var(--text-primary);
    margin: 0;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    flex: 1;
    letter-spacing: -0.01em;
  }

  .rating {
    display: flex;
    align-items: center;
    gap: 3px;
    font-size: 0.75rem;
    color: var(--rating-color);
    font-family: "JetBrains Mono", monospace;
    white-space: nowrap;
  }

  :global(.star-icon) {
    font-size: 0.8rem;
  }

  .author {
    font-size: 0.8rem;
    color: var(--text-muted);
    margin-bottom: 10px;
  }

  .volumes {
    font-size: 0.7rem;
    color: var(--text-muted);
    font-family: "JetBrains Mono", monospace;
  }

  @media (max-width: 768px) {
    .library-grid {
      grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
    }
  }
</style>