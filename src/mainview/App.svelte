<script lang="ts">
  import { onMount } from "svelte";
  import { APP_VERSION } from "../shared/version.ts";
  import { Electroview } from "electrobun/view";
  import type { MangaEntry, MangaDiff, PendingSave } from "../shared/types.ts";
  import Settings from "./Settings.svelte";
  import Library from "./Library.svelte";
  import MangaDetail from "./MangaDetail.svelte";
  import PhBooks from "~icons/ph/books";
  import PhBooksFill from "~icons/ph/books-fill";
  import PhGear from "~icons/ph/gear";
  import PhGearFill from "~icons/ph/gear-fill";
  import PhCheckCircleFill from "~icons/ph/check-circle-fill";
  import PhXCircleFill from "~icons/ph/x-circle-fill";
  import PhInfoFill from "~icons/ph/info-fill";
  import PhSun from "~icons/ph/sun";
  import PhMoon from "~icons/ph/moon";

  let rpc = $state<any>(null);
  let toast = $state<{ kind: "success" | "error" | "info"; message: string } | null>(null);

  let dark = $state(false);

  let selectedManga = $state<MangaEntry | null>(null);
  let pendingSaves = $state<Map<number, PendingSave>>(new Map());

  function handleMangaSaved(id: number, diff: MangaDiff) {
    const entry = selectedManga;
    const title = entry?.id === id ? entry.manga.title : String(id);
    pendingSaves = new Map([...pendingSaves, [id, { title, diff }]]);
  }

  function handlePushComplete() {
    pendingSaves = new Map();
  }

  function applyTheme(isDark: boolean) {
    document.documentElement.classList.toggle("light", !isDark);
    document.documentElement.style.colorScheme = isDark ? "dark" : "light";
  }

  function toggleTheme() {
    dark = !dark;
    applyTheme(dark);
    rpc?.request.setTheme({ theme: dark ? "dark" : "light" });
  }

  let activeNav = $state("Library");
  const navItems = [
    { name: "Library", icon: PhBooks, iconActive: PhBooksFill },
    { name: "Settings", icon: PhGear, iconActive: PhGearFill },
  ];

  let settingsComponent: any;

  function handleSelectManga(entry: MangaEntry) {
    selectedManga = entry;
  }

  function handleBackToLibrary() {
    selectedManga = null;
  }

  onMount(async () => {
    const _rpc = Electroview.defineRPC({
      maxRequestTime: 120_000,
      handlers: {
        requests: {},
        messages: {},
      },
    });

    new Electroview({ rpc: _rpc });

    const { theme } = await _rpc.request.getTheme();
    dark = theme === "dark";
    applyTheme(dark);

    rpc = _rpc;
  });

</script>

<svelte:head>
  <title>Kaguya</title>
  <meta name="description" content="Manga library manager" />
</svelte:head>

<div class="app-root">
  <header class="topbar">
    <div class="topbar-inner">
      <div class="topbar-left">
        <div class="brand">
          <div class="brand-mark">K</div>
          <span class="brand-name">Kaguya</span>
        </div>
      </div>

      <nav class="topbar-nav">
        {#each navItems as item}
          <button
            class="nav-link"
            class:active={activeNav === item.name}
            type="button"
            onclick={() => { activeNav = item.name; selectedManga = null; }}
          >
            {#if activeNav === item.name}
              <item.iconActive class="nav-link-icon" />
            {:else}
              <item.icon class="nav-link-icon" />
            {/if}
            {item.name}
          </button>
        {/each}
      </nav>

      <div class="topbar-right">
        <button class="theme-toggle" type="button" onclick={toggleTheme} title={dark ? "Light mode" : "Dark mode"}>
          {#if dark}
            <PhSun class="theme-toggle-icon" />
          {:else}
            <PhMoon class="theme-toggle-icon" />
          {/if}
        </button>
        <span class="version-tag">v{APP_VERSION}</span>
      </div>
    </div>
  </header>

  {#if toast}
    <div class={`toast toast-${toast.kind}`} role="status" aria-live="polite">
      {#if toast.kind === "success"}
        <PhCheckCircleFill class="toast-icon" />
      {:else if toast.kind === "error"}
        <PhXCircleFill class="toast-icon" />
      {:else}
        <PhInfoFill class="toast-icon" />
      {/if}
      <span>{toast.message}</span>
    </div>
  {/if}

  <main class="main-content">
    {#if activeNav === "Library"}
      {#if selectedManga && rpc}
        <MangaDetail {rpc} entry={selectedManga} onBack={handleBackToLibrary} onSaved={handleMangaSaved} />
      {:else if rpc}
        <Library {rpc} onSelectManga={handleSelectManga} {pendingSaves} onPushComplete={handlePushComplete} />
      {/if}
    {/if}

    {#if activeNav === "Settings"}
      <Settings bind:this={settingsComponent} {rpc} mounted={true} />
    {/if}
  </main>
</div>

<style>
  :global(*) {
    margin: 0;
    padding: 0;
    box-sizing: border-box;
  }

  :global(body) {
    background: var(--bg-base);
    color: var(--text-primary);
    font-family: "DM Sans", Arial, sans-serif;
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
    min-height: 100vh;
  }

  /* ── Warp-inspired Warm Dark Design System ── */
  :global(:root) {
    /* Canvas — warm near-black, not cold */
    --bg-base: #1a1917;
    --bg-surface: #222120;
    --bg-elevated: #2c2b29;
    --bg-hover: #2a2927;
    --bg-overlay: rgba(255, 255, 255, 0.04);
    --topbar-bg: rgba(26, 25, 23, 0.92);

    /* Borders — semi-transparent, ghostly containment */
    --border-subtle: rgba(226, 226, 226, 0.08);
    --border-default: rgba(226, 226, 226, 0.14);
    --border-strong: rgba(226, 226, 226, 0.22);
    --border-mist: rgba(226, 226, 226, 0.35);

    /* Text — warm parchment hierarchy */
    --text-primary: #faf9f6;
    --text-secondary: #afaeac;
    --text-muted: #868584;
    --text-faint: #555452;

    /* Interactive — earth gray, restrained */
    --btn-bg: #353534;
    --btn-bg-hover: #3e3d3b;
    --btn-text: #afaeac;

    /* Semantic — muted, warm */
    --accent-green: #5a8a5e;
    --accent-green-light: rgba(90, 138, 94, 0.12);
    --accent-amber: #9a7a3a;
    --accent-amber-light: rgba(154, 122, 58, 0.12);
    --accent-rose: #9a3a3a;
    --accent-rose-light: rgba(154, 58, 58, 0.10);
    --focus-ring: rgba(250, 249, 246, 0.35);

    /* Radius — restrained, not bubbly */
    --radius-xs: 4px;
    --radius-sm: 6px;
    --radius-md: 10px;
    --radius-lg: 14px;
    --radius-pill: 50px;

    /* Shadows — flat, border-based depth */
    --shadow-sm: 0 0 0 1px var(--border-default);
    --shadow-md:
      0 0 0 1px var(--border-default),
      0 4px 24px rgba(0, 0, 0, 0.3);
    --shadow-lg:
      0 0 0 1px var(--border-mist),
      0 8px 40px rgba(0, 0, 0, 0.5);

    /* Typography */
    --display: "Newsreader", Georgia, serif;
    --sans: "DM Sans", Arial, sans-serif;
    --mono: "IBM Plex Mono", ui-monospace, monospace;
  }

  /* Light mode override — keep dark as default, light is the variant */
  :global(:root.light) {
    --bg-base: #f5f4f0;
    --bg-surface: #faf9f6;
    --bg-elevated: #eeece6;
    --bg-hover: #f0ede6;
    --bg-overlay: rgba(0, 0, 0, 0.03);
    --topbar-bg: rgba(245, 244, 240, 0.92);

    --border-subtle: rgba(0, 0, 0, 0.06);
    --border-default: rgba(0, 0, 0, 0.10);
    --border-strong: rgba(0, 0, 0, 0.16);
    --border-mist: rgba(0, 0, 0, 0.22);

    --text-primary: #1a1917;
    --text-secondary: #5a5956;
    --text-muted: #8a8884;
    --text-faint: #b0aea8;

    --btn-bg: #2e2d2b;
    --btn-bg-hover: #3a3937;
    --btn-text: #faf9f6;

    --accent-green: #3d6e41;
    --accent-green-light: rgba(61, 110, 65, 0.10);
    --accent-amber: #7a5e28;
    --accent-amber-light: rgba(122, 94, 40, 0.10);
    --accent-rose: #7a2e2e;
    --accent-rose-light: rgba(122, 46, 46, 0.08);
    --focus-ring: rgba(26, 25, 23, 0.25);

    --shadow-sm: 0 0 0 1px var(--border-default);
    --shadow-md:
      0 0 0 1px var(--border-default),
      0 4px 16px rgba(0, 0, 0, 0.08);
    --shadow-lg:
      0 0 0 1px var(--border-strong),
      0 8px 32px rgba(0, 0, 0, 0.12);
  }

  .app-root {
    min-height: 100vh;
    display: flex;
    flex-direction: column;
  }

  /* ── Top navigation bar ── */
  .topbar {
    position: sticky;
    top: 0;
    z-index: 30;
    background: var(--topbar-bg);
    backdrop-filter: blur(20px) saturate(1.4);
    border-bottom: 1px solid var(--border-subtle);
  }

  .topbar-inner {
    max-width: 1280px;
    margin: 0 auto;
    padding: 0 36px;
    height: 52px;
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  .topbar-left {
    display: flex;
    align-items: center;
  }

  .brand {
    display: flex;
    align-items: center;
    gap: 10px;
  }

  .brand-mark {
    width: 28px;
    height: 28px;
    border-radius: var(--radius-sm);
    background: var(--btn-bg);
    border: 1px solid var(--border-mist);
    color: var(--text-primary);
    font-weight: 400;
    font-size: 0.95rem;
    font-family: var(--display);
    display: grid;
    place-items: center;
    letter-spacing: -0.02em;
  }

  .brand-name {
    font-weight: 400;
    font-size: 1rem;
    font-family: var(--display);
    color: var(--text-primary);
    letter-spacing: -0.02em;
    line-height: 1.1;
  }

  .topbar-nav {
    display: flex;
    gap: 2px;
  }

  .nav-link {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 6px 14px;
    border: none;
    background: transparent;
    color: var(--text-muted);
    font-family: var(--mono);
    font-size: 0.72rem;
    font-weight: 400;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    cursor: pointer;
    border-radius: var(--radius-sm);
    transition-property: background, color, scale;
    transition-duration: 0.15s;
    transition-timing-function: ease;
    position: relative;
  }

  .nav-link:active {
    scale: 0.96;
  }

  .nav-link:focus-visible {
    outline: 1px solid var(--border-mist);
    outline-offset: 2px;
  }

  .nav-link:hover {
    background: var(--bg-elevated);
    color: var(--text-secondary);
  }

  .nav-link.active {
    color: var(--text-primary);
    background: var(--bg-elevated);
  }

  :global(.nav-link-icon) {
    font-size: 1rem;
  }

  .topbar-right {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .theme-toggle {
    width: 40px;
    height: 40px;
    border-radius: var(--radius-sm);
    background: transparent;
    border: none;
    color: var(--text-muted);
    cursor: pointer;
    display: grid;
    place-items: center;
    transition-property: background, color, scale;
    transition-duration: 0.15s;
    transition-timing-function: ease;
  }

  .theme-toggle:hover {
    background: var(--bg-elevated);
    color: var(--text-secondary);
  }

  .theme-toggle:active {
    scale: 0.96;
  }

  .theme-toggle:focus-visible {
    outline: 1px solid var(--border-mist);
    outline-offset: 2px;
  }

  :global(.theme-toggle-icon) {
    font-size: 1rem;
  }

  .version-tag {
    font-family: var(--mono);
    font-size: 0.65rem;
    color: var(--text-faint);
    padding: 3px 8px;
    background: var(--bg-elevated);
    border-radius: var(--radius-xs);
    border: 1px solid var(--border-subtle);
    font-variant-numeric: tabular-nums;
    letter-spacing: 0.04em;
  }

  /* Main content */
  .main-content {
    flex: 1;
    max-width: 1280px;
    width: 100%;
    margin: 0 auto;
    padding: 40px 36px;
  }

  /* Toast */
  .toast {
    position: fixed;
    top: 64px;
    right: 24px;
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 11px 16px;
    border-radius: var(--radius-md);
    background: var(--bg-elevated);
    border: 1px solid var(--border-mist);
    box-shadow: var(--shadow-md);
    color: var(--text-primary);
    font-size: 0.82rem;
    font-weight: 400;
    z-index: 40;
    animation: toast-in 0.2s ease-out;
  }

  @keyframes toast-in {
    from { opacity: 0; transform: translateY(-6px) scale(0.98); }
    to { opacity: 1; transform: translateY(0) scale(1); }
  }

  .toast-success {
    border-color: rgba(90, 138, 94, 0.4);
  }

  .toast-error {
    border-color: rgba(154, 58, 58, 0.4);
  }

  .toast-info {
    border-color: var(--border-mist);
  }

  :global(.toast-icon) {
    font-size: 1rem;
  }

  .toast-success :global(.toast-icon) {
    color: var(--accent-green);
  }

  .toast-error :global(.toast-icon) {
    color: var(--accent-rose);
  }

  .toast-info :global(.toast-icon) {
    color: var(--text-secondary);
  }

  /* Selection */
  :global(::selection) {
    background: rgba(250, 249, 246, 0.15);
    color: var(--text-primary);
  }

  /* Scrollbar */
  :global(*) {
    scrollbar-width: thin;
    scrollbar-color: var(--border-strong) transparent;
  }

  :global(*::-webkit-scrollbar) {
    width: 5px;
  }

  :global(*::-webkit-scrollbar-track) {
    background: transparent;
  }

  :global(*::-webkit-scrollbar-thumb) {
    background: var(--border-strong);
    border-radius: 999px;
  }

  :global(*::-webkit-scrollbar-thumb:hover) {
    background: var(--text-faint);
  }

  @media (max-width: 768px) {
    .topbar-inner {
      padding: 0 20px;
    }

    .main-content {
      padding: 24px 20px;
    }

    .brand-name {
      display: none;
    }
  }
</style>
