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
  let hasUnsavedChanges = $state(false);
  let originalSettings = $state<AppSettings | null>(null);

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
      originalSettings = { ...stored.settings };
      settingsDbPath = stored.dbPath;
    }
  });

  // Track changes to settings
  $effect(() => {
    if (originalSettings) {
      const hasChanges = 
        settings.imgchestApiKey !== originalSettings.imgchestApiKey ||
        settings.githubToken !== originalSettings.githubToken ||
        settings.githubOwner !== originalSettings.githubOwner ||
        settings.githubRepo !== originalSettings.githubRepo ||
        settings.githubBranch !== originalSettings.githubBranch;
      hasUnsavedChanges = hasChanges;
    }
  });

  async function saveSettings() {
    await rpc.request.saveSettings(settings);
    originalSettings = { ...settings };
    hasUnsavedChanges = false;
    saveStatus = "saved";
    window.setTimeout(() => {
      saveStatus = "idle";
    }, 1800);
  }

  // Hidden file input for import
  let fileInput = $state<HTMLInputElement | null>(null);
  let importError = $state<string | null>(null);

  function exportSettings() {
    const exportData = {
      imgchestApiKey: settings.imgchestApiKey,
      githubToken: settings.githubToken,
      githubOwner: settings.githubOwner,
      githubRepo: settings.githubRepo,
      githubBranch: settings.githubBranch,
      exportedAt: new Date().toISOString(),
      version: APP_VERSION,
    };
    
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `kaguya-settings-${new Date().toISOString().split("T")[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  function triggerImport() {
    fileInput?.click();
  }

  async function handleImport(event: Event) {
    const target = event.target as HTMLInputElement;
    const file = target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      const imported = JSON.parse(text);
      
      // Validate and apply imported settings
      if (imported.imgchestApiKey !== undefined) settings.imgchestApiKey = imported.imgchestApiKey;
      if (imported.githubToken !== undefined) settings.githubToken = imported.githubToken;
      if (imported.githubOwner !== undefined) settings.githubOwner = imported.githubOwner;
      if (imported.githubRepo !== undefined) settings.githubRepo = imported.githubRepo;
      if (imported.githubBranch !== undefined) settings.githubBranch = imported.githubBranch;
      
      // Auto-save after import
      await saveSettings();
    } catch (e) {
      importError = "Failed to import settings. Invalid file format.";
      window.setTimeout(() => {
        importError = null;
      }, 3000);
    }
    
    // Reset input so same file can be selected again
    target.value = "";
  }

  function resetSettings() {
    if (!confirm("Are you sure you want to reset all settings? This cannot be undone.")) {
      return;
    }
    
    settings = {
      imgchestApiKey: "",
      githubToken: "",
      githubOwner: "",
      githubRepo: "",
      githubBranch: "main",
    };
    
    saveSettings();
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
        <div class="header-actions">
          <button class="header-btn" type="button" title="Export Settings" onclick={exportSettings}>
            <Icon icon="ph:export" class="action-icon" />
          </button>
          <button class="header-btn" type="button" title="Import Settings" onclick={triggerImport}>
            <Icon icon="ph:download-simple" class="action-icon" />
          </button>
          <input 
            type="file" 
            bind:this={fileInput} 
            accept=".json" 
            style="display: none" 
            onchange={handleImport}
          />
          {#if hasUnsavedChanges || saveStatus === "saved"}
            <button class="global-save-btn" class:saved={saveStatus === "saved"} type="button" onclick={saveSettings}>
              <Icon icon={saveStatus === "saved" ? "ph:check" : "ph:floppy-disk"} class="save-icon" />
              {saveStatus === "saved" ? "Saved" : "Save"}
            </button>
          {/if}
        </div>
      </div>
      
      {#if importError}
        <div class="import-error" class:visible={importError}>
          <Icon icon="ph:warning-circle" class="error-icon" />
          {importError}
        </div>
      {/if}
      
      <div class="settings-list">
        <!-- Database Section -->
        <div class="settings-section" class:visible={mounted} style="transition-delay: 0.08s">
          <div class="section-header">
            <Icon icon="ph:database" class="section-icon" />
            <span class="section-title">Database</span>
          </div>
          <div class="setting-item">
            <div class="setting-info">
              <span class="setting-label">Database Path</span>
              <code class="setting-value">{settingsDbPath || "Loading..."}</code>
            </div>
          </div>
        </div>

        <!-- ImgChest Section -->
        <div class="settings-section" class:visible={mounted} style="transition-delay: 0.1s">
          <div class="section-header">
            <Icon icon="ph:cloud-arrow-up" class="section-icon" />
            <span class="section-title">ImgChest</span>
          </div>
          <div class="setting-item">
            <div class="setting-info">
              <span class="setting-label">API Key</span>
              <div class="password-field">
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
        </div>

        <!-- GitHub Section -->
        <div class="settings-section" class:visible={mounted} style="transition-delay: 0.12s">
          <div class="section-header">
            <Icon icon="ph:github-logo" class="section-icon" />
            <span class="section-title">GitHub</span>
          </div>
          <div class="setting-item">
            <div class="setting-info">
              <span class="setting-label">Personal Access Token</span>
              <div class="password-field">
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
          </div>
          <div class="setting-item">
            <div class="setting-info">
              <span class="setting-label">Repository Owner</span>
              <input bind:value={settings.githubOwner} class="setting-input" placeholder="username or org" />
            </div>
          </div>
          <div class="setting-item">
            <div class="setting-info">
              <span class="setting-label">Repository Name</span>
              <input bind:value={settings.githubRepo} class="setting-input" placeholder="my-manga-repo" />
            </div>
          </div>
          <div class="setting-item">
            <div class="setting-info">
              <span class="setting-label">Branch</span>
              <input bind:value={settings.githubBranch} class="setting-input" placeholder="main" />
            </div>
          </div>
        </div>

        <!-- Actions Section -->
        <div class="settings-section" class:visible={mounted} style="transition-delay: 0.14s">
          <div class="section-header">
            <Icon icon="ph:gear" class="section-icon" />
            <span class="section-title">Actions</span>
          </div>
          <div class="action-buttons">
            <button class="action-btn-reset" type="button" onclick={resetSettings}>
              <Icon icon="ph:trash" class="action-btn-icon" />
              Reset All Settings
            </button>
          </div>
        </div>

        <!-- About Section -->
        <div class="settings-section about-section" class:visible={mounted} style="transition-delay: 0.16s">
          <div class="about-minimal">
            <span class="about-brand">Kaguya</span>
            <span class="about-version">v{APP_VERSION}</span>
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

  /* Settings - List Layout */
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

  .settings-header .header-actions {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .header-btn {
    width: 36px;
    height: 36px;
    border-radius: 8px;
    background: var(--bg-surface);
    border: 1px solid var(--border-subtle);
    color: var(--text-muted);
    cursor: pointer;
    display: grid;
    place-items: center;
    transition: all 0.2s ease;
  }

  .header-btn:hover {
    background: var(--bg-elevated);
    color: var(--text-secondary);
    border-color: var(--border-default);
  }

  .global-save-btn {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 8px 14px;
    background: linear-gradient(135deg, var(--accent-cyan) 0%, #0891b2 100%);
    border: none;
    border-radius: 6px;
    color: var(--bg-deep);
    font-family: inherit;
    font-size: 0.8rem;
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

  /* Settings List */
  .import-error {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 12px 16px;
    background: rgba(251, 113, 133, 0.1);
    border: 1px solid var(--accent-rose);
    border-radius: 8px;
    color: var(--accent-rose);
    font-size: 0.85rem;
    opacity: 0;
    transform: translateY(-8px);
    transition: all 0.3s ease;
  }

  .import-error.visible {
    opacity: 1;
    transform: translateY(0);
  }

  :global(.error-icon) {
    font-size: 1.1rem;
  }

  .settings-list {
    display: flex;
    flex-direction: column;
    gap: 16px;
    position: relative;
    z-index: 1;
  }

  .settings-section {
    background: var(--bg-surface);
    border: 1px solid var(--border-subtle);
    border-radius: 12px;
    padding: 16px 20px;
    opacity: 0;
    transform: translateY(12px);
    transition: all 0.35s cubic-bezier(0.4, 0, 0.2, 1);
  }

  .settings-section.visible {
    opacity: 1;
    transform: translateY(0);
  }

  .section-header {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-bottom: 14px;
    padding-bottom: 10px;
    border-bottom: 1px solid var(--border-subtle);
  }

  :global(.section-icon) {
    font-size: 1.1rem;
    color: var(--accent-cyan);
  }

  .section-title {
    font-size: 0.9rem;
    font-weight: 600;
    color: var(--text-primary);
    letter-spacing: -0.01em;
  }

  .setting-item {
    padding: 10px 0;
  }

  .setting-item + .setting-item {
    border-top: 1px solid var(--border-subtle);
  }

  .setting-info {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .setting-label {
    font-size: 0.75rem;
    font-weight: 500;
    color: var(--text-secondary);
  }

  .setting-value {
    font-size: 0.8rem;
    color: var(--text-muted);
    font-family: "JetBrains Mono", monospace;
    word-break: break-all;
    white-space: pre-wrap;
  }

  .password-field {
    position: relative;
    display: flex;
    align-items: center;
  }

  .password-field .setting-input {
    padding-right: 40px;
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
    padding: 4px;
    display: grid;
    place-items: center;
    border-radius: 4px;
    transition: all 0.2s ease;
  }

  .toggle-password:hover {
    color: var(--text-secondary);
  }

  .toggle-password :global(svg) {
    font-size: 1rem;
  }

  .setting-input {
    width: 100%;
    padding: 10px 12px;
    border-radius: 6px;
    background: var(--bg-elevated);
    border: 1px solid var(--border-subtle);
    color: var(--text-primary);
    font-family: inherit;
    font-size: 0.85rem;
    outline: none;
    transition: all 0.2s ease;
  }

  .setting-input::placeholder {
    color: var(--text-muted);
  }

  .setting-input:focus {
    border-color: var(--accent-cyan);
  }

  .action-buttons {
    display: flex;
    gap: 10px;
    flex-wrap: wrap;
  }

  .action-btn-reset {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 10px 16px;
    background: transparent;
    border: 1px solid var(--accent-rose);
    border-radius: 6px;
    color: var(--accent-rose);
    font-family: inherit;
    font-size: 0.85rem;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .action-btn-reset:hover {
    background: rgba(251, 113, 133, 0.1);
  }

  :global(.action-btn-icon) {
    font-size: 1rem;
  }

  .about-section {
    background: transparent;
    border: 1px solid transparent;
    display: flex;
    justify-content: center;
    padding: 20px;
  }

  .about-minimal {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .about-brand {
    font-size: 0.9rem;
    font-weight: 600;
    color: var(--text-secondary);
  }

  .about-version {
    font-size: 0.75rem;
    color: var(--text-muted);
    font-family: "JetBrains Mono", monospace;
  }

  :global(.save-icon) {
    font-size: 0.9rem;
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
