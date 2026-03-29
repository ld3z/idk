<script lang="ts">
  import { onMount } from "svelte";
  import Icon from "@iconify/svelte";

  type MangaStatus = "Reading" | "Plan to read" | "On hold" | "Completed";
  type Shelf = "All" | "Reading" | "Plan to read" | "On hold" | "Completed";

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

  type AppSettings = {
    imgchestApiKey: string;
    githubOwner: string;
    githubRepo: string;
    githubBranch: string;
    showRatings: boolean;
  };

  const SETTINGS_STORAGE_KEY = "kaguya.settings";

  let mounted = $state(false);
  onMount(() => {
    setTimeout(() => (mounted = true), 50);
  });

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

  const statusOptions: Shelf[] = ["All", "Reading", "Plan to read", "On hold", "Completed"];
  const sortOptions = ["Recent", "Title", "Rating"];

  function getCardDelay(index: number) {
    return `${0.06 * (index % 6)}s`;
  }

  let library = $state(seedLibrary);
  let search = $state("");
  let activeShelf = $state<Shelf>("All");
  let selectedSort = $state("Recent");
  let selectedMangaId = $state(seedLibrary[0].id);

  let newTitle = $state("");
  let newAuthor = $state("");
  let newStatus = $state<MangaStatus>("Reading");
  let newProgress = $state("Vol. 1 / 1");
  let newVolumes = $state("1 vol");

  const totalCount = $derived(library.length);
  const readingCount = $derived(library.filter((manga) => manga.status === "Reading").length);
  const completedCount = $derived(library.filter((manga) => manga.status === "Completed").length);
  const averageRating = $derived(
    library.length
      ? (library.reduce((sum, manga) => sum + manga.rating, 0) / library.length).toFixed(1)
      : "0.0",
  );

  const filteredLibrary = $derived.by(() => {
    const term = search.trim().toLowerCase();
    return [...library]
      .filter((manga) => {
        const matchesShelf = activeShelf === "All" || manga.status === activeShelf;
        const matchesSearch =
          !term ||
          manga.title.toLowerCase().includes(term) ||
          manga.author.toLowerCase().includes(term) ||
          manga.tags.some((tag) => tag.toLowerCase().includes(term));
        return matchesShelf && matchesSearch;
      })
      .sort((a, b) => {
        if (selectedSort === "Title") return a.title.localeCompare(b.title);
        if (selectedSort === "Rating") return b.rating - a.rating;
        return b.id - a.id;
      });
  });

  const selectedManga = $derived(library.find((manga) => manga.id === selectedMangaId) ?? filteredLibrary[0] ?? library[0]);

  function addManga(event: SubmitEvent) {
    event.preventDefault();
    if (!newTitle.trim() || !newAuthor.trim()) return;

    const accentColors = [
      "linear-gradient(135deg, #00d4ff 0%, #09090b 100%)",
      "linear-gradient(135deg, #ff6b35 0%, #09090b 100%)",
      "linear-gradient(135deg, #22c55e 0%, #09090b 100%)",
      "linear-gradient(135deg, #ec4899 0%, #09090b 100%)",
    ];

    const nextManga: Manga = {
      id: Date.now(),
      title: newTitle.trim(),
      author: newAuthor.trim(),
      status: newStatus,
      progress: newProgress.trim() || "New entry",
      rating: 4.0,
      volumes: newVolumes.trim() || "1 vol",
      updated: "Just added",
      color: accentColors[library.length % accentColors.length],
      tags: [newStatus, "Local"],
    };

    library = [nextManga, ...library];
    selectedMangaId = nextManga.id;
    activeShelf = "All";
    search = "";
    newTitle = "";
    newAuthor = "";
    newStatus = "Reading";
    newProgress = "Vol. 1 / 1";
    newVolumes = "1 vol";
  }

  function selectManga(id: number) {
    selectedMangaId = id;
  }

  let activeNav = $state("Library");
  const navItems: { name: string; icon: string }[] = [
    { name: "Library", icon: "ph:books-thin" },
    { name: "Settings", icon: "ph:gear-thin" },
  ];

  // Settings state
  let settings = $state({
    imgchestApiKey: "",
    githubOwner: "",
    githubRepo: "",
    githubBranch: "main",
    showRatings: true,
  } satisfies AppSettings);

  onMount(() => {
    const raw = localStorage.getItem(SETTINGS_STORAGE_KEY);
    if (!raw) return;

    try {
      const stored = JSON.parse(raw) as Partial<AppSettings>;
      settings = {
        ...settings,
        ...stored,
      };
    } catch {
      // Ignore malformed saved settings.
    }
  });

  $effect(() => {
    localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings));
  });
</script>

<svelte:head>
  <title>Kaguya Library</title>
  <meta name="description" content="Manga library manager" />
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin="anonymous" />
  <link href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;600&family=Sora:wght@300;400;500;600;700&display=swap" rel="stylesheet" />
</svelte:head>

<main class="shell">
  <aside class="sidebar">
    <div class="brand">
      <div class="brand-mark">K</div>
      <div>
        <p>Kaguya</p>
        <span>Library</span>
      </div>
    </div>

    <nav>
      {#each navItems as item, i}
        <button
          class="nav-item"
          class:active={activeNav === item.name}
          class:visible={mounted}
          type="button"
          onclick={() => (activeNav = item.name)}
          style={`transition-delay: ${0.04 + i * 0.03}s`}
        >
          <Icon icon={item.icon} class={`nav-icon ${activeNav === item.name ? "active" : ""}`} />
          {item.name}
          {#if activeNav === item.name}
            <span class="nav-glow"></span>
          {/if}
        </button>
      {/each}
    </nav>

    <section class="sidebar-card" class:visible={mounted} style="transition-delay: 0.2s">
      <div class="stat-grid">
        <div class="stat">
          <span class="stat-value">{totalCount}</span>
          <span class="stat-label">Titles</span>
        </div>
        <div class="stat">
          <span class="stat-value accent-cyan">{readingCount}</span>
          <span class="stat-label">Reading</span>
        </div>
      </div>
    </section>
  </aside>

  <section class="content">
    <header class="topbar">
      <div>
        <p class="eyebrow">Library</p>
        <h1>Your Collection</h1>
      </div>
      <div class="topbar-actions">
        <button class="btn-ghost" type="button">Import</button>
        <button class="btn-primary" type="button">Sync</button>
      </div>
    </header>

    <section class="hero" class:visible={mounted} style="transition-delay: 0.1s">
      <div class="hero-main">
        <h2>Manage your <span class="gradient-text">manga</span></h2>
        <div class="hero-stats">
          <div class="stat-pill">
            <span class="stat-num">{totalCount}</span>
            <span class="stat-name">Total</span>
          </div>
          <div class="stat-pill cyan">
            <span class="stat-num">{readingCount}</span>
            <span class="stat-name">Reading</span>
          </div>
          <div class="stat-pill orange">
            <span class="stat-num">{completedCount}</span>
            <span class="stat-name">Done</span>
          </div>
          <div class="stat-pill purple">
            <span class="stat-num">{averageRating}</span>
            <span class="stat-name">Rating</span>
          </div>
        </div>
      </div>
      <div class="hero-accent">
        <div class="accent-bar"></div>
      </div>
    </section>

    {#if activeNav === "Library"}
    <section class="toolbar">
      <label class="search-box">
        <Icon icon="ph:magnifying-glass" class="search-icon" />
        <input bind:value={search} placeholder="Search titles..." />
      </label>

      <div class="filter-pills">
        {#each statusOptions as option}
          <button
            class="pill"
            class:active={activeShelf === option}
            type="button"
            onclick={() => (activeShelf = option)}
          >
            {option}
          </button>
        {/each}
      </div>        <label class="sort-select">
        <select bind:value={selectedSort}>
          {#each sortOptions as option}
            <option>{option}</option>
          {/each}
        </select>
      </label>
    </section>

    <section class="workspace">
      <div class="library-grid">
        {#if filteredLibrary.length}
          {#each filteredLibrary as manga, i}
            <button
              class="manga-card"
              class:active={selectedManga?.id === manga.id}
              class:visible={mounted}
              type="button"
              aria-pressed={selectedManga?.id === manga.id}
              onclick={() => selectManga(manga.id)}
              style={`transition-delay: ${getCardDelay(i)}`}
            >
              <div class="cover" style={`background:${manga.color}`}>
                <span class="cover-letter">{manga.title.slice(0, 2).toUpperCase()}</span>
              </div>
              <div class="manga-info">
                <h3>{manga.title}</h3>
                <p class="author">{manga.author}</p>
                <div class="manga-footer">
                  <span class="status-tag">{manga.status}</span>
                  {#if settings.showRatings}
                    <span class="rating">★ {manga.rating.toFixed(1)}</span>
                  {/if}
                </div>
              </div>
            </button>
          {/each}
        {:else}
          <div class="empty-state">
            <Icon icon="ph:folder-open" class="empty-icon" />
            <p>No titles found</p>
          </div>
        {/if}
      </div>

      <aside class="detail-panel">
        <section class="detail-card" class:visible={mounted} style="transition-delay: 0.25s">
          {#if selectedManga}
            <div class="detail-header">
              <div class="detail-cover" style={`background:${selectedManga.color}`}>
                <span>{selectedManga.title.slice(0, 2).toUpperCase()}</span>
              </div>
              <div class="detail-title">
                <h3>{selectedManga.title}</h3>
                <p>{selectedManga.author}</p>
              </div>
            </div>
            <div class="detail-stats">
              <div class="detail-row">
                <span>Status</span>
                <strong>{selectedManga.status}</strong>
              </div>
              <div class="detail-row">
                <span>Progress</span>
                <strong>{selectedManga.progress}</strong>
              </div>
              <div class="detail-row">
                <span>Rating</span>
                <strong class="rating-star">★ {selectedManga.rating.toFixed(1)}</strong>
              </div>
            </div>
          {/if}
        </section>

        <section class="add-form" class:visible={mounted} style="transition-delay: 0.3s">
          <h3>Add Manga</h3>
          <form onsubmit={addManga}>
            <input bind:value={newTitle} placeholder="Title" />
            <input bind:value={newAuthor} placeholder="Author" />
            <div class="form-row">
              <select bind:value={newStatus}>
                <option>Reading</option>
                <option>Plan to read</option>
                <option>On hold</option>
                <option>Completed</option>
              </select>
              <input bind:value={newVolumes} placeholder="Vols" />
            </div>
            <button class="btn-primary full" type="submit">Add to Library</button>
          </form>
        </section>
      </aside>
    </section>
    {/if}

    {#if activeNav === "Settings"}
    <section class="settings-panel" class:visible={mounted} style="transition-delay: 0.1s">
      <div class="settings-header">
        <Icon icon="ph:gear-thin" class="settings-icon" />
        <div>
          <h2>Settings</h2>
          <p>Configure ImgChest and GitHub integration</p>
        </div>
      </div>

      <div class="settings-section">
        <h3>ImgChest</h3>
        <div class="setting-row">
          <div class="setting-info">
            <span class="setting-label">API Key</span>
            <span class="setting-desc">Used to authenticate with ImgChest</span>
          </div>
          <input bind:value={settings.imgchestApiKey} class="setting-input" placeholder="Enter ImgChest API key" />
        </div>
      </div>

      <div class="settings-section">
        <h3>GitHub</h3>
        <div class="setting-row">
          <div class="setting-info">
            <span class="setting-label">Repository Owner</span>
            <span class="setting-desc">GitHub account or organization</span>
          </div>
          <input bind:value={settings.githubOwner} class="setting-input" placeholder="owner" />
        </div>
        <div class="setting-row">
          <div class="setting-info">
            <span class="setting-label">Repository Name</span>
            <span class="setting-desc">Repository that stores uploads</span>
          </div>
          <input bind:value={settings.githubRepo} class="setting-input" placeholder="repo-name" />
        </div>
        <div class="setting-row">
          <div class="setting-info">
            <span class="setting-label">Branch</span>
            <span class="setting-desc">Default branch to target</span>
          </div>
          <input bind:value={settings.githubBranch} class="setting-input" placeholder="main" />
        </div>
      </div>

      <div class="settings-section">
        <h3>About</h3>
        <div class="about-info">
          <p><strong>Kaguya Library</strong> v1.0.0</p>
          <p class="muted">Manga collection manager</p>
        </div>
      </div>
    </section>
    {/if}
  </section>
</main>

<style>
  :global(*) {
    margin: 0;
    padding: 0;
    box-sizing: border-box;
  }

  :global(html) {
    color-scheme: dark;
  }

  :global(body) {
    background: #09090b;
    color: #fafafa;
    font-family: "Sora", sans-serif;
    -webkit-font-smoothing: antialiased;
    min-height: 100vh;
  }

  .shell {
    min-height: 100vh;
    display: grid;
    grid-template-columns: 240px 1fr;
    gap: 0;
    padding: 0;
  }

  .sidebar {
    background: #0c0c0e;
    border-right: 1px solid #1a1a1e;
    padding: 24px 16px;
    display: flex;
    flex-direction: column;
    gap: 24px;
    position: sticky;
    top: 0;
    height: 100vh;
  }

  .brand {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 0 8px;
  }

  .brand-mark {
    width: 36px;
    height: 36px;
    border-radius: 8px;
    display: grid;
    place-items: center;
    font-weight: 700;
    font-size: 1.1rem;
    background: #00d4ff;
    color: #09090b;
  }

  .brand p {
    font-weight: 600;
    font-size: 1rem;
    color: #fafafa;
  }

  .brand span {
    font-size: 0.75rem;
    color: #52525b;
    text-transform: uppercase;
    letter-spacing: 0.1em;
  }

  nav {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .nav-item {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 10px 12px;
    border-radius: 6px;
    background: transparent;
    border: none;
    color: #71717a;
    font-family: inherit;
    font-size: 0.875rem;
    cursor: pointer;
    text-align: left;
    position: relative;
    opacity: 0;
    transform: translateX(-8px);
    transition: all 0.25s ease;
  }

  .nav-item.visible {
    opacity: 1;
    transform: translateX(0);
  }

  .nav-item:hover {
    background: #18181b;
    color: #a1a1aa;
  }

  .nav-item.active {
    background: #18181b;
    color: #00d4ff;
  }

  :global(.nav-icon) {
    font-size: 1.25rem;
    opacity: 0.6;
    transition: opacity 0.2s;
  }

  :global(.nav-icon.active) {
    opacity: 1;
    color: #00d4ff;
  }

  :global(.search-icon) {
    font-size: 1.1rem;
    color: #52525b;
  }

  :global(.empty-icon) {
    font-size: 3rem;
    color: #3f3f46;
    margin-bottom: 12px;
  }

  :global(.settings-icon) {
    font-size: 2rem;
    color: #00d4ff;
  }

  .nav-glow {
    position: absolute;
    left: 0;
    top: 50%;
    transform: translateY(-50%);
    width: 3px;
    height: 16px;
    background: #00d4ff;
    border-radius: 0 2px 2px 0;
    box-shadow: 0 0 8px #00d4ff;
  }

  .sidebar-card {
    background: #18181b;
    border: 1px solid #27272a;
    border-radius: 8px;
    padding: 16px;
    margin-top: auto;
    opacity: 0;
    transform: translateY(12px);
    transition: all 0.35s ease;
  }

  .sidebar-card.visible {
    opacity: 1;
    transform: translateY(0);
  }

  .stat-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 12px;
  }

  .stat {
    text-align: center;
  }

  .stat-value {
    display: block;
    font-size: 1.5rem;
    font-weight: 700;
    color: #fafafa;
    font-family: "JetBrains Mono", monospace;
  }

  .stat-value.accent-cyan {
    color: #00d4ff;
  }

  .stat-label {
    font-size: 0.7rem;
    color: #52525b;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .content {
    background: #09090b;
    padding: 24px 32px;
    display: flex;
    flex-direction: column;
    gap: 24px;
    min-height: 100vh;
  }

  .topbar {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .eyebrow {
    font-size: 0.75rem;
    color: #00d4ff;
    text-transform: uppercase;
    letter-spacing: 0.1em;
    margin-bottom: 4px;
  }

  h1 {
    font-size: 1.5rem;
    font-weight: 600;
    color: #fafafa;
  }

  .topbar-actions {
    display: flex;
    gap: 8px;
  }

  .btn-ghost {
    padding: 8px 16px;
    border-radius: 6px;
    background: transparent;
    border: 1px solid #27272a;
    color: #a1a1aa;
    font-family: inherit;
    font-size: 0.875rem;
    cursor: pointer;
    transition: all 0.2s;
  }

  .btn-ghost:hover {
    border-color: #3f3f46;
    color: #fafafa;
  }

  .btn-primary {
    padding: 8px 16px;
    border-radius: 6px;
    background: #00d4ff;
    border: none;
    color: #09090b;
    font-family: inherit;
    font-size: 0.875rem;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s;
  }

  .btn-primary:hover {
    background: #22d3ee;
    box-shadow: 0 0 16px rgba(0, 212, 255, 0.4);
  }

  .btn-primary.full {
    width: 100%;
    margin-top: 12px;
  }

  .hero {
    display: grid;
    grid-template-columns: 1fr auto;
    gap: 24px;
    align-items: center;
    padding: 24px;
    background: #0c0c0e;
    border: 1px solid #18181b;
    border-radius: 12px;
    opacity: 0;
    transform: translateY(16px);
    transition: all 0.4s ease;
  }

  .hero.visible {
    opacity: 1;
    transform: translateY(0);
  }

  .hero-main h2 {
    font-size: 1.75rem;
    font-weight: 600;
    color: #fafafa;
    margin-bottom: 16px;
  }

  .gradient-text {
    background: linear-gradient(90deg, #00d4ff, #a855f7, #ec4899);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
  }

  .hero-stats {
    display: flex;
    gap: 12px;
    flex-wrap: wrap;
  }

  .stat-pill {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 14px;
    background: #18181b;
    border: 1px solid #27272a;
    border-radius: 20px;
  }

  .stat-pill.cyan { border-color: rgba(0, 212, 255, 0.3); }
  .stat-pill.cyan .stat-num { color: #00d4ff; }
  .stat-pill.orange { border-color: rgba(249, 115, 22, 0.3); }
  .stat-pill.orange .stat-num { color: #f97316; }
  .stat-pill.purple { border-color: rgba(168, 85, 247, 0.3); }
  .stat-pill.purple .stat-num { color: #a855f7; }

  .stat-num {
    font-family: "JetBrains Mono", monospace;
    font-weight: 600;
    color: #fafafa;
  }

  .stat-name {
    font-size: 0.75rem;
    color: #52525b;
  }

  .hero-accent {
    display: flex;
    align-items: center;
    justify-content: center;
    height: 100%;
  }

  .accent-bar {
    width: 4px;
    height: 80px;
    background: linear-gradient(180deg, #00d4ff, #a855f7, #ec4899);
    border-radius: 2px;
    box-shadow: 0 0 12px rgba(0, 212, 255, 0.5);
  }

  .toolbar {
    display: flex;
    gap: 16px;
    align-items: center;
    flex-wrap: wrap;
  }

  .search-box {
    display: flex;
    align-items: center;
    gap: 10px;
    background: #18181b;
    border: 1px solid #27272a;
    border-radius: 8px;
    padding: 8px 14px;
    flex: 1;
    min-width: 200px;
    max-width: 320px;
  }

  .search-box:focus-within {
    border-color: #00d4ff;
    box-shadow: 0 0 0 2px rgba(0, 212, 255, 0.1);
  }

  .search-icon {
    color: #52525b;
    font-size: 1.1rem;
  }

  .search-box input {
    background: transparent;
    border: none;
    color: #fafafa;
    font-family: inherit;
    font-size: 0.875rem;
    outline: none;
    width: 100%;
  }

  .search-box input::placeholder {
    color: #52525b;
  }

  .filter-pills {
    display: flex;
    gap: 6px;
  }

  .pill {
    padding: 6px 12px;
    border-radius: 16px;
    background: #18181b;
    border: 1px solid #27272a;
    color: #71717a;
    font-family: inherit;
    font-size: 0.8rem;
    cursor: pointer;
    transition: all 0.2s;
  }

  .pill:hover {
    border-color: #3f3f46;
    color: #a1a1aa;
  }

  .pill.active {
    background: #00d4ff;
    border-color: #00d4ff;
    color: #09090b;
    font-weight: 500;
  }

  .sort-select select {
    padding: 8px 12px;
    border-radius: 6px;
    background: #18181b;
    border: 1px solid #27272a;
    color: #a1a1aa;
    font-family: inherit;
    font-size: 0.875rem;
    cursor: pointer;
    outline: none;
  }

  .sort-select select:focus {
    border-color: #00d4ff;
  }

  .workspace {
    display: grid;
    grid-template-columns: 1fr 280px;
    gap: 24px;
    flex: 1;
  }

  .library-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
    gap: 16px;
  }

  .manga-card {
    background: #18181b;
    border: 1px solid #27272a;
    border-radius: 10px;
    padding: 12px;
    cursor: pointer;
    text-align: left;
    opacity: 0;
    transform: translateY(16px) scale(0.98);
    transition: all 0.3s ease;
  }

  .manga-card.visible {
    opacity: 1;
    transform: translateY(0) scale(1);
  }

  .manga-card:hover {
    border-color: #3f3f46;
    transform: translateY(-2px);
  }

  .manga-card.active {
    border-color: #00d4ff;
    box-shadow: 0 0 20px rgba(0, 212, 255, 0.15);
  }

  .cover {
    aspect-ratio: 3/4;
    border-radius: 8px;
    display: flex;
    align-items: flex-end;
    padding: 10px;
    margin-bottom: 12px;
  }

  .cover-letter {
    font-family: "Sora", sans-serif;
    font-weight: 700;
    font-size: 1.4rem;
    color: #fafafa;
    text-shadow: 0 2px 8px rgba(0, 0, 0, 0.5);
  }

  .manga-info h3 {
    font-size: 0.9rem;
    font-weight: 600;
    color: #fafafa;
    margin-bottom: 2px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .author {
    font-size: 0.75rem;
    color: #52525b;
    margin-bottom: 8px;
  }

  .manga-footer {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .status-tag {
    font-size: 0.65rem;
    padding: 3px 8px;
    border-radius: 10px;
    background: #27272a;
    color: #a1a1aa;
  }

  .rating {
    font-size: 0.75rem;
    color: #fbbf24;
    font-family: "JetBrains Mono", monospace;
  }

  .detail-panel {
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  .detail-card {
    background: #18181b;
    border: 1px solid #27272a;
    border-radius: 10px;
    padding: 16px;
    opacity: 0;
    transform: translateY(12px);
    transition: all 0.35s ease;
  }

  .detail-card.visible {
    opacity: 1;
    transform: translateY(0);
  }

  .detail-header {
    display: flex;
    gap: 14px;
    margin-bottom: 16px;
  }

  .detail-cover {
    width: 80px;
    height: 110px;
    border-radius: 8px;
    display: flex;
    align-items: flex-end;
    padding: 8px;
    flex-shrink: 0;
  }

  .detail-cover span {
    font-family: "Sora", sans-serif;
    font-weight: 700;
    font-size: 1rem;
    color: #fafafa;
  }

  .detail-title h3 {
    font-size: 1rem;
    font-weight: 600;
    color: #fafafa;
    margin-bottom: 4px;
  }

  .detail-title p {
    font-size: 0.8rem;
    color: #52525b;
  }

  .detail-stats {
    border-top: 1px solid #27272a;
    padding-top: 12px;
  }

  .detail-row {
    display: flex;
    justify-content: space-between;
    padding: 6px 0;
    font-size: 0.85rem;
  }

  .detail-row span {
    color: #52525b;
  }

  .detail-row strong {
    color: #fafafa;
  }

  .rating-star {
    color: #fbbf24 !important;
  }

  .add-form {
    background: #18181b;
    border: 1px solid #27272a;
    border-radius: 10px;
    padding: 16px;
    opacity: 0;
    transform: translateY(12px);
    transition: all 0.35s ease;
  }

  .add-form.visible {
    opacity: 1;
    transform: translateY(0);
  }

  .add-form h3 {
    font-size: 0.9rem;
    font-weight: 600;
    color: #fafafa;
    margin-bottom: 12px;
  }

  .add-form form {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .add-form input,
  .add-form select {
    padding: 10px 12px;
    border-radius: 6px;
    background: #09090b;
    border: 1px solid #27272a;
    color: #fafafa;
    font-family: inherit;
    font-size: 0.85rem;
    outline: none;
    transition: border-color 0.2s;
  }

  .add-form input:focus,
  .add-form select:focus {
    border-color: #00d4ff;
  }

  .add-form input::placeholder {
    color: #52525b;
  }

  .form-row {
    display: grid;
    grid-template-columns: 1fr 80px;
    gap: 8px;
  }

  .empty-state {
    grid-column: 1 / -1;
    text-align: center;
    padding: 40px;
    color: #52525b;
    display: flex;
    flex-direction: column;
    align-items: center;
  }

  /* Settings Panel */
  .settings-panel {
    display: flex;
    flex-direction: column;
    gap: 24px;
    opacity: 0;
    transform: translateY(16px);
    transition: all 0.4s ease;
  }

  .settings-panel.visible {
    opacity: 1;
    transform: translateY(0);
  }

  .settings-header {
    display: flex;
    align-items: center;
    gap: 16px;
    padding: 20px;
    background: #0c0c0e;
    border: 1px solid #18181b;
    border-radius: 12px;
  }

  .settings-header h2 {
    font-size: 1.5rem;
    font-weight: 600;
    color: #fafafa;
    margin: 0;
  }

  .settings-header p {
    font-size: 0.85rem;
    color: #52525b;
    margin: 4px 0 0;
  }

  .settings-section {
    background: #0c0c0e;
    border: 1px solid #18181b;
    border-radius: 12px;
    padding: 20px;
  }

  .settings-section h3 {
    font-size: 0.75rem;
    font-weight: 600;
    color: #00d4ff;
    text-transform: uppercase;
    letter-spacing: 0.1em;
    margin: 0 0 16px;
  }

  .setting-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 12px 0;
    border-bottom: 1px solid #18181b;
  }

  .setting-row:last-child {
    border-bottom: none;
  }

  .setting-info {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .setting-label {
    font-size: 0.9rem;
    color: #fafafa;
  }

  .setting-desc {
    font-size: 0.75rem;
    color: #52525b;
  }

  .setting-input {
    width: 260px;
    padding: 8px 12px;
    border-radius: 6px;
    background: #18181b;
    border: 1px solid #27272a;
    color: #fafafa;
    font-family: inherit;
    font-size: 0.85rem;
    outline: none;
  }

  .setting-input:focus {
    border-color: #00d4ff;
  }

  .about-info {
    text-align: center;
    padding: 16px 0;
  }

  .about-info p {
    margin: 0;
    color: #fafafa;
    font-size: 0.9rem;
  }

  .about-info .muted {
    color: #52525b;
    font-size: 0.8rem;
    margin-top: 4px;
  }

  @media (max-width: 900px) {
    .shell {
      grid-template-columns: 1fr;
    }

    .sidebar {
      display: none;
    }

    .workspace {
      grid-template-columns: 1fr;
    }

    .detail-panel {
      order: -1;
      flex-direction: row;
      flex-wrap: wrap;
    }

    .detail-card, .add-form {
      flex: 1;
      min-width: 200px;
    }
  }

  @media (max-width: 600px) {
    .content {
      padding: 16px;
    }

    .hero {
      flex-direction: column;
    }

    .toolbar {
      flex-direction: column;
      align-items: stretch;
    }

    .search-box {
      max-width: none;
    }

    .filter-pills {
      overflow-x: auto;
      padding-bottom: 4px;
    }
  }
</style>
