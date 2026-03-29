<script lang="ts">
  import { onMount } from "svelte";
  import Icon from "@iconify/svelte";
  import { APP_VERSION } from "../shared/version.ts";
  import { Electroview } from "electrobun/view";

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

  let rpc: any;
  let settingsDbPath = $state("");
  let saveStatus = $state<"idle" | "saved">("idle");

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

  function getCardDelay(index: number) {
    return `${0.05 * (index % 6)}s`;
  }

  let library = $state(seedLibrary);

  let activeNav = $state("Library");
  const navItems: { name: string; icon: string; iconActive: string }[] = [
    { name: "Library", icon: "ph:books", iconActive: "ph:books-fill" },
    { name: "Settings", icon: "ph:gear", iconActive: "ph:gear-fill" },
  ];

  // Settings state
  let settings = $state({
    imgchestApiKey: "",
    githubToken: "",
    githubOwner: "",
    githubRepo: "",
    githubBranch: "main",
  } satisfies AppSettings);

  // Password visibility toggles
  let showImgchestKey = $state(false);
  let showGithubToken = $state(false);

  onMount(async () => {
    rpc = Electroview.defineRPC<SettingsRpcSchema>({
      handlers: {
        requests: {},
        messages: {},
      },
    });

    new Electroview({ rpc });

    const stored = await rpc.request.getSettings();
    if (stored) {
      settings = { ...settings, ...stored.settings };
      settingsDbPath = stored.dbPath;
    }
  });

  async function saveSettings() {
    await rpc.request.saveSettings(settings);
    saveStatus = "saved";
    window.setTimeout(() => {
      saveStatus = "idle";
    }, 1800);
  }

</script>

<svelte:head>
  <title>Kaguya Library</title>
  <meta name="description" content="Manga library manager" />
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin="anonymous" />
  <link href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;600&family=Outfit:wght@300;400;500;600;700&display=swap" rel="stylesheet" />
</svelte:head>

<main class="shell">
  <!-- Sleek icon-only sidebar -->
  <aside class="sidebar">
    <div class="brand-icon" class:visible={mounted}>
      <span class="k-icon">K</span>
    </div>

    <nav class="icon-nav">
      {#each navItems as item, i}
        <button
          class="nav-icon-btn"
          class:active={activeNav === item.name}
          class:visible={mounted}
          type="button"
          onclick={() => (activeNav = item.name)}
          style={`transition-delay: ${0.06 + i * 0.04}s`}
          title={item.name}
        >
          <div class="icon-wrapper">
            <Icon icon={activeNav === item.name ? item.iconActive : item.icon} class="nav-svg" />
          </div>

          {#if activeNav === item.name}
            <span class="active-indicator"></span>
          {/if}
        </button>
      {/each}
    </nav>


  </aside>

  <section class="content">


    {#if activeNav === "Library"}
    <section class="workspace">
      <div class="library-header" class:visible={mounted}>
        <div class="header-left">
          <h1 class="page-title">Library</h1>
          <span class="item-count">6 manga</span>
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
    </section>
    {/if}

    {#if activeNav === "Settings"}
    <section class="workspace">
      <div class="settings-header" class:visible={mounted}>
        <div class="header-left">
          <h1 class="page-title">Settings</h1>
          <span class="item-count">Configuration</span>
        </div>
        <button class="global-save-btn" type="button" onclick={saveSettings}>
          <Icon icon="ph:floppy-disk" class="save-icon" />
          {saveStatus === "saved" ? "Saved" : "Save Changes"}
        </button>
      </div>
      
      <div class="settings-grid">
        <div class="settings-card" class:visible={mounted} style="transition-delay: 0.08s">
          <div class="card-header">
            <Icon icon="ph:database" class="card-icon" />
            <h3>Database</h3>
          </div>
          <p class="card-desc">Local settings storage</p>
          <div class="db-path-display">
            <span class="path-label">Database Path</span>
            <code class="path-value">{settingsDbPath || "Loading..."}</code>
          </div>
        </div>

        <div class="settings-card" class:visible={mounted} style="transition-delay: 0.1s">
          <div class="card-header">
            <Icon icon="ph:cloud-arrow-up" class="card-icon" />
            <h3>ImgChest</h3>
          </div>
          <p class="card-desc">Image hosting API for manga covers</p>
          <div class="input-row password-input">
            <label class="input-label">API Key</label>
            <div class="input-wrapper">
              <input 
                bind:value={settings.imgchestApiKey} 
                class="setting-input" 
                placeholder="Enter your API key" 
                type={showImgchestKey ? "text" : "password"} 
              />
              <button class="toggle-password" type="button" onclick={() => showImgchestKey = !showImgchestKey}>
                <Icon icon={showImgchestKey ? "ph:eye-slash" : "ph:eye"} />
              </button>
            </div>
          </div>
        </div>

        <div class="settings-card" class:visible={mounted} style="transition-delay: 0.12s">
          <div class="card-header">
            <Icon icon="ph:github-logo" class="card-icon" />
            <h3>GitHub</h3>
          </div>
          <p class="card-desc">Repository for syncing manga data</p>
          <div class="input-list">
            <div class="input-row">
              <label class="input-label">Personal Access Token</label>
              <div class="input-wrapper">
                <input 
                  bind:value={settings.githubToken} 
                  class="setting-input" 
                  placeholder="ghp_xxxxxxxxxxxx" 
                  type={showGithubToken ? "text" : "password"} 
                />
                <button class="toggle-password" type="button" onclick={() => showGithubToken = !showGithubToken}>
                  <Icon icon={showGithubToken ? "ph:eye-slash" : "ph:eye"} />
                </button>
              </div>
            </div>
            <div class="input-row">
              <label class="input-label">Repository Owner</label>
              <input bind:value={settings.githubOwner} class="setting-input" placeholder="username or org" />
            </div>
            <div class="input-row">
              <label class="input-label">Repository Name</label>
              <input bind:value={settings.githubRepo} class="setting-input" placeholder="my-manga-repo" />
            </div>
            <div class="input-row">
              <label class="input-label">Branch</label>
              <input bind:value={settings.githubBranch} class="setting-input" placeholder="main" />
            </div>
          </div>
        </div>

        <div class="settings-card about-card" class:visible={mounted} style="transition-delay: 0.16s">
          <div class="card-header">
            <Icon icon="ph:heart-straight" class="card-icon" />
            <h3>About</h3>
          </div>
          <div class="about-content">
            <div class="about-logo">
              <span class="logo-mark">K</span>
              <div class="logo-text">
                <span class="app-name">Kaguya</span>
                <span class="app-version">Version {APP_VERSION}</span>
              </div>
            </div>
            <p class="about-tagline">Manga collection manager</p>
          </div>
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
    font-family: "Outfit", sans-serif;
    -webkit-font-smoothing: antialiased;
    min-height: 100vh;
  }

  /* CSS Variables */
  :global(:root) {
    --bg-deep: #050507;
    --bg-base: #09090b;
    --bg-surface: #111113;
    --bg-elevated: #18181b;
    --border-subtle: #1f1f23;
    --border-default: #27272a;
    --text-primary: #fafafa;
    --text-secondary: #a1a1aa;
    --text-muted: #52525b;
    --accent-cyan: #22d3ee;
    --accent-green: #4ade80;
    --accent-amber: #fbbf24;
    --accent-rose: #fb7185;
    --accent-muted: #71717a;
  }

  .shell {
    min-height: 100vh;
    display: grid;
    grid-template-columns: 72px 1fr;
    gap: 0;
    padding: 0;
  }

  /* Sleek icon-only sidebar */
  .sidebar {
    background: linear-gradient(180deg, var(--bg-deep) 0%, var(--bg-base) 100%);
    border-right: 1px solid var(--border-subtle);
    padding: 20px 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    position: sticky;
    top: 0;
    height: 100vh;
  }

  .brand-icon {
    width: 44px;
    height: 44px;
    border-radius: 12px;
    display: grid;
    place-items: center;
    background: linear-gradient(135deg, var(--accent-cyan) 0%, #0891b2 100%);
    margin-bottom: 32px;
    opacity: 0;
    transform: scale(0.8);
    transition: all 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
    box-shadow: 0 4px 20px rgba(34, 211, 238, 0.25);
  }

  .brand-icon.visible {
    opacity: 1;
    transform: scale(1);
  }

  .k-icon {
    font-weight: 700;
    font-size: 1.25rem;
    color: var(--bg-deep);
    font-family: "Outfit", sans-serif;
    letter-spacing: -0.02em;
  }

  .icon-nav {
    display: flex;
    flex-direction: column;
    gap: 8px;
    flex: 1;
  }

  .nav-icon-btn {
    width: 44px;
    height: 44px;
    border-radius: 12px;
    background: transparent;
    border: none;
    color: var(--text-muted);
    cursor: pointer;
    position: relative;
    display: grid;
    place-items: center;
    opacity: 0;
    transform: translateY(8px);
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  }

  .nav-icon-btn.visible {
    opacity: 1;
    transform: translateY(0);
  }

  .nav-icon-btn:hover {
    background: var(--bg-elevated);
    color: var(--text-secondary);
  }

  .nav-icon-btn.active {
    background: var(--bg-surface);
    color: var(--accent-cyan);
  }

  .icon-wrapper {
    position: relative;
    z-index: 1;
  }

  :global(.nav-svg) {
    font-size: 1.35rem;
    transition: all 0.25s ease;
  }

  .nav-icon-btn.active :global(.nav-svg) {
    filter: drop-shadow(0 0 8px rgba(34, 211, 238, 0.5));
  }

  .active-indicator {
    position: absolute;
    left: -8px;
    top: 50%;
    transform: translateY(-50%);
    width: 3px;
    height: 20px;
    background: var(--accent-cyan);
    border-radius: 0 3px 3px 0;
    box-shadow: 0 0 12px var(--accent-cyan);
  }

  /* Content area */
  .content {
    background: var(--bg-base);
    padding: 32px 40px;
    display: flex;
    flex-direction: column;
    gap: 24px;
    min-height: 100vh;
    position: relative;
  }

  /* Subtle grid pattern background */
  .content::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background-image: 
      radial-gradient(circle at 1px 1px, var(--border-subtle) 1px, transparent 0);
    background-size: 32px 32px;
    opacity: 0.5;
    pointer-events: none;
  }

  h1 {
    font-size: 1.5rem;
    font-weight: 600;
    color: var(--text-primary);
  }

  .workspace {
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

  :global(.search-icon) {
    font-size: 1.1rem;
    color: var(--text-muted);
  }

  :global(.empty-icon) {
    font-size: 3rem;
    color: var(--text-muted);
    margin-bottom: 12px;
  }

  /* Settings Grid */
  .settings-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
    gap: 20px;
    position: relative;
    z-index: 1;
  }

  .settings-card {
    background: var(--bg-surface);
    border: 1px solid var(--border-subtle);
    border-radius: 16px;
    padding: 24px;
    opacity: 0;
    transform: translateY(16px);
    transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
  }

  .settings-card.visible {
    opacity: 1;
    transform: translateY(0);
  }

  .settings-card:hover {
    border-color: var(--border-default);
    transform: translateY(-2px);
  }

  .card-header {
    display: flex;
    align-items: center;
    gap: 12px;
    margin-bottom: 8px;
  }

  :global(.card-icon) {
    font-size: 1.5rem;
    color: var(--accent-cyan);
  }

  .card-header h3 {
    font-size: 1.1rem;
    font-weight: 600;
    color: var(--text-primary);
    margin: 0;
    letter-spacing: -0.01em;
  }

  .card-desc {
    font-size: 0.8rem;
    color: var(--text-muted);
    margin: 0 0 20px;
  }

  .settings-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 28px;
    opacity: 0;
    transform: translateY(-8px);
    transition: all 0.4s ease;
  }

  .settings-header.visible {
    opacity: 1;
    transform: translateY(0);
  }

  .global-save-btn {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 10px 18px;
    background: linear-gradient(135deg, var(--accent-cyan) 0%, #0891b2 100%);
    border: none;
    border-radius: 8px;
    color: var(--bg-deep);
    font-family: inherit;
    font-size: 0.85rem;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .global-save-btn:hover {
    transform: translateY(-1px);
    box-shadow: 0 4px 16px rgba(34, 211, 238, 0.3);
  }

  .global-save-btn:active {
    transform: translateY(0);
  }

  .db-path-display {
    display: flex;
    flex-direction: column;
    gap: 6px;
    padding: 12px;
    border: 1px solid var(--border-subtle);
    border-radius: 8px;
    background: var(--bg-elevated);
  }

  .path-label {
    font-size: 0.65rem;
    font-weight: 600;
    color: var(--text-secondary);
    text-transform: uppercase;
    letter-spacing: 0.08em;
  }

  .path-value {
    color: var(--text-primary);
    font-size: 0.78rem;
    font-family: "JetBrains Mono", monospace;
    word-break: break-all;
    white-space: pre-wrap;
  }

  .input-list {
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  .input-row {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  :global(.save-icon) {
    font-size: 1rem;
  }

  .input-label {
    font-size: 0.7rem;
    font-weight: 500;
    color: var(--text-secondary);
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .input-wrapper {
    position: relative;
    display: flex;
    align-items: center;
  }

  .input-wrapper .setting-input {
    padding-right: 44px;
    border-radius: 4px;
  }

  .toggle-password {
    position: absolute;
    right: 8px;
    top: 50%;
    transform: translateY(-50%);
    background: none;
    border: none;
    color: var(--text-muted);
    cursor: pointer;
    padding: 6px;
    display: grid;
    place-items: center;
    border-radius: 6px;
    transition: all 0.2s ease;
  }

  .toggle-password:hover {
    color: var(--text-secondary);
    background: var(--bg-surface);
  }

  .toggle-password :global(svg) {
    font-size: 1.1rem;
  }

  .setting-input {
    width: 100%;
    padding: 14px 16px;
    border-radius: 4px;
    background: var(--bg-elevated);
    border: 1px solid var(--border-subtle);
    color: var(--text-primary);
    font-family: inherit;
    font-size: 0.875rem;
    outline: none;
    transition: all 0.2s ease;
  }

  .setting-input::placeholder {
    color: var(--text-muted);
  }

  .setting-input:focus {
    border-color: var(--accent-cyan);
    box-shadow: 0 0 0 3px rgba(34, 211, 238, 0.1);
  }

  /* About card */
  .about-card {
    background: linear-gradient(135deg, var(--bg-surface) 0%, rgba(34, 211, 238, 0.05) 100%);
  }

  .about-content {
    margin-top: 8px;
  }

  .about-logo {
    display: flex;
    align-items: center;
    gap: 14px;
    margin-bottom: 12px;
  }

  .logo-mark {
    width: 40px;
    height: 40px;
    border-radius: 10px;
    display: grid;
    place-items: center;
    font-weight: 700;
    font-size: 1.1rem;
    background: linear-gradient(135deg, var(--accent-cyan) 0%, #0891b2 100%);
    color: var(--bg-deep);
  }

  .logo-text {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .app-name {
    font-size: 1rem;
    font-weight: 600;
    color: var(--text-primary);
  }

  .app-version {
    font-size: 0.75rem;
    color: var(--text-muted);
    font-family: "JetBrains Mono", monospace;
  }

  .about-tagline {
    font-size: 0.85rem;
    color: var(--text-secondary);
    margin: 0;
  }

  @media (max-width: 768px) {
    .content {
      padding: 16px;
    }

    .library-grid {
      grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
    }
  }
</style>
