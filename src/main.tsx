import React from "react";
import ReactDOM from "react-dom/client";
import {
  BarChart3,
  BookOpen,
  CheckCircle2,
  ChevronRight,
  ClipboardEdit,
  Dumbbell,
  Film,
  Flame,
  FolderPlus,
  Home,
  Languages,
  Link,
  ListFilter,
  Loader2,
  Maximize2,
  Pause,
  Play,
  Plus,
  Save,
  Send,
  Settings,
  SlidersHorizontal,
  Sparkles,
  Star,
  Trash2,
  Trophy,
  Video
} from "lucide-react";
import "./styles.css";

type Page = "home" | "watch" | "practice" | "graph" | "settings";

type TranscriptSegment = {
  id: string;
  startTime: number;
  endTime?: number;
  text: string;
  custom?: boolean;
};

type Folder = {
  id: string;
  name: string;
  parentId?: string;
  source?: "local" | "youlearn";
};

type SpaceVideo = {
  id: string;
  title: string;
  contentUrl: string;
  thumbnailUrl?: string;
  duration: number;
  transcript: TranscriptSegment[];
  folderId?: string;
  folderName?: string;
  sourceType?: string;
  watchedAt?: string;
  lastPosition?: number;
};

type SavedDialogue = {
  id: string;
  videoId: string;
  videoTitle: string;
  videoUrl?: string;
  startTime: number;
  text: string;
  promptResult?: string;
  hinglish?: string;
  english?: string;
  bucket: number;
  correctCount: number;
  missCount: number;
  lastPracticed?: string;
  createdAt: string;
};

type DialogueFilterResult = {
  id: string;
  videoId: string;
  videoTitle: string;
  videoUrl?: string;
  prompt: string;
  transcriptSignature: string;
  includedIds: string[];
  filteredDialogues: TranscriptSegment[];
  reason?: string;
  createdAt: string;
  updatedAt: string;
};

type DailyScore = {
  date: string;
  attempted: number;
  totalScore: number;
};

type AiProvider = "youlearn" | "deepseek";

type AppState = {
  videos: SpaceVideo[];
  savedDialogues: SavedDialogue[];
  dialogueFilters: DialogueFilterResult[];
  scores: DailyScore[];
  folders: Folder[];
  prompt: string;
  dialogueFilterPrompt?: string;
  aiProvider?: AiProvider;
  updatedAt: string;
};

const defaultPrompt =
  "Explain this movie dialogue in Hinglish, then give a natural English version. Keep it short and learner friendly.";
const defaultDialogueFilterPrompt =
  "Include only dialogues that are useful for English learning: meaningful spoken lines, idioms, emotional intent, legal/social phrases, or natural conversation. Exclude filler, repeated fragments, single-word reactions, names, timestamps, and transcription noise.";
const defaultAiProvider: AiProvider = "youlearn";

const defaultFolders: Folder[] = [{ id: "root", name: "All Dialogues", source: "local" }];
const lastVideoKey = "dialogdungeon-last-video-id";

const fallbackVideos: SpaceVideo[] = [
  {
    id: "demo-3idiots",
    title: "3 Idiots - Ranchoddas Speech",
    contentUrl: "",
    thumbnailUrl: "",
    duration: 132,
    folderId: "root",
    transcript: [
      { id: "d1", startTime: 0, endTime: 8, text: "Life is not a race, Farhan." },
      { id: "d2", startTime: 8, endTime: 18, text: "Do what your heart understands, not what fear demands." },
      { id: "d3", startTime: 18, endTime: 31, text: "If you follow your passion, success will follow you." },
      { id: "d4", startTime: 31, endTime: 45, text: "Your dream deserves courage, not permission." }
    ]
  }
];

function readJson<T>(key: string, fallback: T): T {
  const stored = localStorage.getItem(key);
  if (!stored) return fallback;
  try {
    return JSON.parse(stored) as T;
  } catch {
    return fallback;
  }
}

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

function extractSpaceId(value: string) {
  const match = value.match(/space\/([a-zA-Z0-9_-]+)/) ?? value.match(/^([a-zA-Z0-9_-]{8,})$/);
  return match?.[1] ?? "";
}

function getClientId() {
  const key = "dialogdungeon-client-id";
  const existing = localStorage.getItem(key);
  if (existing) return existing;
  const id = `dd-${crypto.randomUUID()}`;
  localStorage.setItem(key, id);
  return id;
}

function normalizeAiProvider(value: unknown): AiProvider {
  return value === "deepseek" ? "deepseek" : defaultAiProvider;
}

function getLastWatchVideoId(videos: SpaceVideo[]) {
  const storedId = localStorage.getItem(lastVideoKey);
  if (storedId && videos.some((video) => video.id === storedId)) return storedId;
  return (
    videos
      .filter((video) => video.watchedAt || video.lastPosition)
      .sort((a, b) => String(b.watchedAt || "").localeCompare(String(a.watchedAt || "")))[0]?.id ?? ""
  );
}

function App() {
  const [page, setPage] = React.useState<Page>("watch");
  const [navCollapsed, setNavCollapsed] = React.useState(true);
  const [clientId] = React.useState(getClientId);
  const [videos, setVideos] = React.useState<SpaceVideo[]>(() => readJson("dialogdungeon-videos", fallbackVideos));
  const [folders, setFolders] = React.useState<Folder[]>(() => readJson("dialogdungeon-folders", defaultFolders));
  const [savedDialogues, setSavedDialogues] = React.useState<SavedDialogue[]>(() =>
    readJson("dialogdungeon-dialogues", [])
  );
  const [dialogueFilters, setDialogueFilters] = React.useState<DialogueFilterResult[]>(() =>
    readJson("dialogdungeon-dialogue-filters", [])
  );
  const [scores, setScores] = React.useState<DailyScore[]>(() => readJson("dialogdungeon-scores", []));
  const [prompt, setPrompt] = React.useState(() => localStorage.getItem("dialogdungeon-prompt") || defaultPrompt);
  const [dialogueFilterPrompt, setDialogueFilterPrompt] = React.useState(
    () => localStorage.getItem("dialogdungeon-dialogue-filter-prompt") || defaultDialogueFilterPrompt
  );
  const [aiProvider, setAiProvider] = React.useState<AiProvider>(() => normalizeAiProvider(localStorage.getItem("dialogdungeon-ai-provider")));
  const [syncStatus, setSyncStatus] = React.useState("Local");
  const cloudLoaded = React.useRef(false);

  React.useEffect(() => {
    localStorage.setItem("dialogdungeon-videos", JSON.stringify(videos));
    localStorage.setItem("dialogdungeon-folders", JSON.stringify(folders));
    localStorage.setItem("dialogdungeon-dialogues", JSON.stringify(savedDialogues));
    localStorage.setItem("dialogdungeon-dialogue-filters", JSON.stringify(dialogueFilters));
    localStorage.setItem("dialogdungeon-scores", JSON.stringify(scores));
    localStorage.setItem("dialogdungeon-prompt", prompt);
    localStorage.setItem("dialogdungeon-dialogue-filter-prompt", dialogueFilterPrompt);
    localStorage.setItem("dialogdungeon-ai-provider", aiProvider);
  }, [videos, folders, savedDialogues, dialogueFilters, scores, prompt, dialogueFilterPrompt, aiProvider]);

  React.useEffect(() => {
    let cancelled = false;
    fetch(`/api/sync?clientId=${encodeURIComponent(clientId)}`)
      .then((response) => response.json())
      .then((data) => {
        if (cancelled) return;
        if (data?.state) {
          const cloud = data.state as Partial<AppState>;
          setVideos((current) => mergeVideos(current, cloud.videos ?? []));
          setFolders((current) => mergeFolders(current, cloud.folders ?? []));
          setSavedDialogues((current) => mergeById(current, cloud.savedDialogues ?? []));
          setDialogueFilters((current) => mergeDialogueFilters(current, cloud.dialogueFilters ?? []));
          setScores((current) => mergeScores(current, cloud.scores ?? []));
          if (cloud.prompt) setPrompt(cloud.prompt);
          if (cloud.dialogueFilterPrompt) setDialogueFilterPrompt(cloud.dialogueFilterPrompt);
          if (cloud.aiProvider) setAiProvider(normalizeAiProvider(cloud.aiProvider));
        }
        setSyncStatus(data?.source === "supabase" ? "Synced" : "Local");
        cloudLoaded.current = true;
      })
      .catch(() => {
        if (!cancelled) {
          setSyncStatus("Local");
          cloudLoaded.current = true;
        }
      });
    return () => {
      cancelled = true;
    };
  }, [clientId]);

  React.useEffect(() => {
    if (!cloudLoaded.current) return;
    const timeout = window.setTimeout(() => {
      const state: AppState = {
        videos,
        folders,
        savedDialogues,
        dialogueFilters,
        scores,
        prompt,
        dialogueFilterPrompt,
        aiProvider,
        updatedAt: new Date().toISOString()
      };
      fetch("/api/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientId, state })
      })
        .then((response) => response.json())
        .then((data) => setSyncStatus(data?.ok ? "Synced" : "Local"))
        .catch(() => setSyncStatus("Local"));
    }, 800);
    return () => window.clearTimeout(timeout);
  }, [aiProvider, clientId, videos, folders, savedDialogues, dialogueFilters, scores, prompt, dialogueFilterPrompt]);

  function saveDialogue(video: SpaceVideo, segment: TranscriptSegment) {
    const exists = savedDialogues.some(
      (item) => item.videoId === video.id && item.startTime === segment.startTime && item.text === segment.text
    );
    if (exists) return;
    setSavedDialogues((current) => [
      {
        id: `${Date.now()}-${segment.id}`,
        videoId: video.id,
        videoTitle: video.title,
        videoUrl: video.contentUrl,
        startTime: segment.startTime,
        text: segment.text,
        bucket: 1,
        correctCount: 0,
        missCount: 0,
        createdAt: new Date().toISOString()
      },
      ...current
    ]);
  }

  function updateDialogue(updated: SavedDialogue) {
    setSavedDialogues((current) => current.map((item) => (item.id === updated.id ? updated : item)));
  }

  function deleteDialogue(id: string) {
    setSavedDialogues((current) => current.filter((item) => item.id !== id));
  }

  function recordPractice(score: number, dialogue: SavedDialogue) {
    const date = todayKey();
    setScores((current) => {
      const existing = current.find((item) => item.date === date);
      if (!existing) return [{ date, attempted: 1, totalScore: score }, ...current];
      return current.map((item) =>
        item.date === date
          ? { ...item, attempted: item.attempted + 1, totalScore: item.totalScore + score }
          : item
      );
    });

    const passed = score >= 80;
    updateDialogue({
      ...dialogue,
      bucket: passed ? Math.min(dialogue.bucket + 1, 5) : Math.max(dialogue.bucket - 1, 1),
      correctCount: dialogue.correctCount + (passed ? 1 : 0),
      missCount: dialogue.missCount + (passed ? 0 : 1),
      lastPracticed: date
    });
  }

  const todayScore = scores.find((item) => item.date === todayKey());
  const stats = buildStats(videos, savedDialogues, scores, folders);

  return (
    <main className={`duo-app ${navCollapsed ? "nav-collapsed" : ""}`}>
      <SideNav page={page} onPage={setPage} collapsed={navCollapsed} onToggleCollapsed={() => setNavCollapsed((value) => !value)} />
      <section className={`duo-main ${page === "settings" ? "has-header" : ""}`}>
        {page === "settings" ? <TopHeader stats={stats} syncStatus={syncStatus} /> : null}
        <section className="page-shell">
          {page === "home" ? (
            <HomePage videos={videos} savedDialogues={savedDialogues} todayScore={todayScore} onPage={setPage} />
          ) : null}
          {page === "watch" ? (
            <WatchPage
              videos={videos}
              folders={folders}
              setVideos={setVideos}
              setFolders={setFolders}
              savedDialogues={savedDialogues}
              dialogueFilters={dialogueFilters}
              setDialogueFilters={setDialogueFilters}
              dialogueFilterPrompt={dialogueFilterPrompt}
              setDialogueFilterPrompt={setDialogueFilterPrompt}
              onSaveDialogue={saveDialogue}
              aiProvider={aiProvider}
            />
          ) : null}
          {page === "practice" ? (
            <PracticePage savedDialogues={savedDialogues} onRecord={recordPractice} videos={videos} prompt={prompt} aiProvider={aiProvider} />
          ) : null}
          {page === "graph" ? (
            <GraphPage
              videos={videos}
              savedDialogues={savedDialogues}
              scores={scores}
              onUpdateDialogue={updateDialogue}
              onDeleteDialogue={deleteDialogue}
              aiProvider={aiProvider}
            />
          ) : null}
          {page === "settings" ? (
            <SettingsPage
              videos={videos}
              setVideos={setVideos}
              setFolders={setFolders}
              savedDialogues={savedDialogues}
              prompt={prompt}
              setPrompt={setPrompt}
              onUpdateDialogue={updateDialogue}
              aiProvider={aiProvider}
              setAiProvider={setAiProvider}
            />
          ) : null}
        </section>
      </section>
    </main>
  );
}

function SideNav({
  page,
  onPage,
  collapsed,
  onToggleCollapsed
}: {
  page: Page;
  onPage: (page: Page) => void;
  collapsed: boolean;
  onToggleCollapsed: () => void;
}) {
  const items: { page: Page; label: string; icon: React.ReactNode }[] = [
    { page: "home", label: "Home", icon: <Home size={21} /> },
    { page: "watch", label: "Watch", icon: <Video size={21} /> },
    { page: "practice", label: "Practice", icon: <Dumbbell size={21} /> },
    { page: "graph", label: "Library", icon: <BarChart3 size={21} /> },
    { page: "settings", label: "Settings", icon: <Settings size={21} /> }
  ];

  return (
    <aside className={`side-nav ${collapsed ? "collapsed" : ""}`}>
      <div className="duo-brand">
        <img className="brand-logo" src="/dialog-dungeon-logo.svg" alt="" aria-hidden="true" />
        <div>
          <strong>DialogDungeon</strong>
          <span>Duolingo mode</span>
        </div>
        <button className="collapse-nav" onClick={onToggleCollapsed} title={collapsed ? "Expand menu" : "Collapse menu"}>
          <ChevronRight size={17} />
        </button>
      </div>
      <nav>
        {items.map((item) => (
          <button key={item.page} className={page === item.page ? "active" : ""} onClick={() => onPage(item.page)} title={item.label}>
            {item.icon}
            <span>{item.label}</span>
          </button>
        ))}
      </nav>
    </aside>
  );
}

function TopHeader({ stats, syncStatus }: { stats: ReturnType<typeof buildStats>; syncStatus: string }) {
  return (
    <header className="top-header">
      <Metric icon={<Flame />} label="Streak" value={`${stats.streak} days`} />
      <Metric icon={<BookOpen />} label="Saved" value={stats.saved} />
      <Metric icon={<Film />} label="Watched" value={stats.watched} />
      <Metric icon={<FolderPlus />} label="Folders" value={stats.folders} />
      <Metric icon={<Trophy />} label="Avg Score" value={`${stats.avg}%`} />
      <Metric icon={<CheckCircle2 />} label="Sync" value={syncStatus} />
    </header>
  );
}

function Metric({ icon, label, value }: { icon: React.ReactNode; label: string; value: string | number }) {
  return (
    <div className="metric">
      {icon}
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function HomePage({
  videos,
  savedDialogues,
  todayScore,
  onPage
}: {
  videos: SpaceVideo[];
  savedDialogues: SavedDialogue[];
  todayScore?: DailyScore;
  onPage: (page: Page) => void;
}) {
  const avg = todayScore ? Math.round(todayScore.totalScore / Math.max(1, todayScore.attempted)) : 0;
  return (
    <div className="home-grid">
      <section className="hero-panel">
        <div>
          <p>Movie dialogue gym</p>
          <h1>Watch. Save. Translate. Level up.</h1>
          <span>Import YouLearn spaces, save hard dialogues, and drill five lines daily with spaced repetition.</span>
          <div className="hero-actions">
            <button onClick={() => onPage("watch")}>
              <Play size={18} /> Start watching
            </button>
            <button className="ghost" onClick={() => onPage("practice")}>
              <Dumbbell size={18} /> Today&apos;s test
            </button>
          </div>
        </div>
        <div className="duo-mascot">
          <strong>5</strong>
          <span>daily dialogues</span>
        </div>
      </section>

      <div className="stats-row">
        <StatTile icon={<Film />} label="Videos" value={videos.length} />
        <StatTile icon={<BookOpen />} label="Saved Dialogues" value={savedDialogues.length} />
        <StatTile icon={<Trophy />} label="Today Avg" value={`${avg}%`} />
      </div>

      <section className="lesson-path">
        {[1, 2, 3, 4, 5].map((step) => (
          <button key={step} className={step <= Math.min(5, savedDialogues.length) ? "done" : ""}>
            {step <= Math.min(5, savedDialogues.length) ? <CheckCircle2 /> : <Star />}
            <span>Set {step}</span>
          </button>
        ))}
      </section>

      <section className="right-rail">
        <h2>Hardest queue</h2>
        {savedDialogues
          .slice()
          .sort((a, b) => a.bucket - b.bucket || b.missCount - a.missCount)
          .slice(0, 5)
          .map((dialogue) => (
            <div className="queue-card" key={dialogue.id}>
              <strong>{dialogue.text}</strong>
              <span>Set {dialogue.bucket} / misses {dialogue.missCount}</span>
            </div>
          ))}
      </section>
    </div>
  );
}

function StatTile({ icon, label, value }: { icon: React.ReactNode; label: string; value: string | number }) {
  return (
    <div className="stat-tile">
      {icon}
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function WatchPage({
  videos,
  folders,
  setVideos,
  setFolders,
  savedDialogues,
  dialogueFilters,
  setDialogueFilters,
  dialogueFilterPrompt,
  setDialogueFilterPrompt,
  onSaveDialogue,
  aiProvider
}: {
  videos: SpaceVideo[];
  folders: Folder[];
  setVideos: React.Dispatch<React.SetStateAction<SpaceVideo[]>>;
  setFolders: React.Dispatch<React.SetStateAction<Folder[]>>;
  savedDialogues: SavedDialogue[];
  dialogueFilters: DialogueFilterResult[];
  setDialogueFilters: React.Dispatch<React.SetStateAction<DialogueFilterResult[]>>;
  dialogueFilterPrompt: string;
  setDialogueFilterPrompt: (prompt: string) => void;
  onSaveDialogue: (video: SpaceVideo, segment: TranscriptSegment) => void;
  aiProvider: AiProvider;
}) {
  const [activeVideoId, setActiveVideoId] = React.useState(() => getLastWatchVideoId(videos));
  const [explorerOpen, setExplorerOpen] = React.useState(() => !getLastWatchVideoId(videos));
  const [selectedFolder, setSelectedFolder] = React.useState("all");
  const [currentTime, setCurrentTime] = React.useState(0);
  const [playbackStatus, setPlaybackStatus] = React.useState("");
  const [isPaused, setIsPaused] = React.useState(true);
  const [isFullscreen, setIsFullscreen] = React.useState(false);
  const [dialogueTranslation, setDialogueTranslation] = React.useState<{ segmentId: string; text: string } | null>(null);
  const [translationLoading, setTranslationLoading] = React.useState(false);
  const [filteredDialogueIds, setFilteredDialogueIds] = React.useState<Set<string> | null>(null);
  const [filterLoading, setFilterLoading] = React.useState(false);
  const [filterStatus, setFilterStatus] = React.useState("");
  const playerFrameRef = React.useRef<HTMLDivElement | null>(null);
  const videoRef = React.useRef<HTMLVideoElement | null>(null);
  const lineRefs = React.useRef<Record<string, HTMLButtonElement | null>>({});

  const filteredVideos =
    selectedFolder === "all" ? videos : videos.filter((video) => (video.folderId || "root") === selectedFolder);
  const activeVideo = videos.find((video) => video.id === activeVideoId);
  const activeSegment =
    activeVideo?.transcript
      .slice()
      .reverse()
      .find((segment) => segment.startTime <= currentTime) ?? activeVideo?.transcript[0];
  const isYouTube = activeVideo ? isYouTubeUrl(activeVideo.contentUrl) : false;
  const transcriptSignature = activeVideo ? buildTranscriptSignature(activeVideo.transcript) : "";
  const filterCacheId = activeVideo ? buildDialogueFilterId(activeVideo.id, transcriptSignature, dialogueFilterPrompt) : "";
  const visibleTranscript = activeVideo
    ? filteredDialogueIds
      ? activeVideo.transcript.filter((segment) => filteredDialogueIds.has(segment.id))
      : activeVideo.transcript
    : [];
  const isDialogueFilterActive = Boolean(filteredDialogueIds);
  const showExplorer = !activeVideo || explorerOpen;

  React.useEffect(() => {
    if (activeVideoId && !videos.some((video) => video.id === activeVideoId)) {
      localStorage.removeItem(lastVideoKey);
      setActiveVideoId("");
      return;
    }
    if (!activeVideoId) setActiveVideoId(getLastWatchVideoId(videos));
  }, [activeVideoId, videos]);

  React.useEffect(() => {
    if (activeSegment?.id) {
      lineRefs.current[activeSegment.id]?.scrollIntoView({ block: "center", behavior: "smooth" });
    }
  }, [activeSegment?.id]);

  React.useEffect(() => {
    if (!activeVideo) return;
    localStorage.setItem(lastVideoKey, activeVideo.id);
    setCurrentTime(activeVideo.lastPosition ?? 0);
    if (videoRef.current) {
      videoRef.current.muted = false;
      videoRef.current.defaultMuted = false;
      videoRef.current.volume = 1;
    }
    setPlaybackStatus("");
    setIsPaused(true);
    setDialogueTranslation(null);
    setFilteredDialogueIds(null);
    setFilterStatus("");
  }, [activeVideo?.id]);

  React.useEffect(() => {
    setDialogueTranslation(null);
  }, [activeSegment?.id]);

  React.useEffect(() => {
    function syncFullscreenState() {
      setIsFullscreen(document.fullscreenElement === playerFrameRef.current);
    }

    document.addEventListener("fullscreenchange", syncFullscreenState);
    return () => document.removeEventListener("fullscreenchange", syncFullscreenState);
  }, []);

  React.useEffect(() => {
    function toggleWithSpace(event: KeyboardEvent) {
      if (event.code !== "Space" || isYouTube || !activeVideo?.contentUrl) return;
      const target = event.target as HTMLElement | null;
      if (target?.closest("input, textarea, select, button, video, [contenteditable='true']")) return;
      event.preventDefault();
      toggleVideoPlayback();
    }

    window.addEventListener("keydown", toggleWithSpace);
    return () => window.removeEventListener("keydown", toggleWithSpace);
  }, [activeVideo?.contentUrl, isYouTube]);

  function renameVideo(video: SpaceVideo) {
    const next = window.prompt("Rename video", video.title)?.trim();
    if (!next) return;
    setVideos((current) => current.map((item) => (item.id === video.id ? { ...item, title: next } : item)));
  }

  function removeVideo(video: SpaceVideo) {
    setVideos((current) => current.filter((item) => item.id !== video.id));
    if (activeVideoId === video.id) setActiveVideoId(videos.find((item) => item.id !== video.id)?.id ?? "");
  }

  function createFolder() {
    const name = window.prompt("Folder name")?.trim();
    if (!name) return;
    setFolders((current) => [...current, { id: `folder-${Date.now()}`, name, source: "local" }]);
  }

  function seekTo(segment: TranscriptSegment) {
    setCurrentTime(segment.startTime);
    if (videoRef.current) {
      videoRef.current.currentTime = segment.startTime;
      videoRef.current.muted = false;
      videoRef.current.defaultMuted = false;
      videoRef.current.volume = 1;
      videoRef.current.play().catch(() => undefined);
    }
  }

  function markWatched(time: number) {
    if (!activeVideo) return;
    setCurrentTime(time);
    setVideos((current) =>
      current.map((video) =>
        video.id === activeVideo.id
          ? { ...video, lastPosition: time, watchedAt: time > 5 ? new Date().toISOString() : video.watchedAt }
          : video
      )
    );
  }

  async function toggleVideoPlayback() {
    if (!videoRef.current) return;
    const player = videoRef.current;
    player.muted = false;
    player.defaultMuted = false;
    player.volume = 1;
    try {
      if (player.paused || player.ended) {
        await player.play();
      } else {
        player.pause();
      }
    } catch (error) {
      setPlaybackStatus(error instanceof Error ? error.message : "Use the video controls to start playback.");
    }
  }

  async function toggleFullscreen() {
    const frame = playerFrameRef.current;
    if (!frame) return;
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
      } else {
        await frame.requestFullscreen();
      }
    } catch (error) {
      setPlaybackStatus(error instanceof Error ? error.message : "Fullscreen is not available.");
    }
  }

  async function translatePausedDialogue() {
    if (!activeSegment || translationLoading) return;
    if (dialogueTranslation?.segmentId === activeSegment.id) return;
    setTranslationLoading(true);
    try {
      const response = await fetch("/api/dialogue-transform", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          dialogue: activeSegment.text,
          mode: "Hinglish",
          prompt: "Give the Hinglish meaning of this dialogue in one short learner-friendly line.",
          provider: aiProvider
        })
      });
      const data = await response.json();
      setDialogueTranslation({
        segmentId: activeSegment.id,
        text: data.hinglish || data.result || toHinglishHint(activeSegment.text)
      });
    } catch {
      setDialogueTranslation({
        segmentId: activeSegment.id,
        text: toHinglishHint(activeSegment.text)
      });
    } finally {
      setTranslationLoading(false);
    }
  }

  async function toggleDialogueFilter() {
    if (!activeVideo) return;
    if (filteredDialogueIds) {
      setFilteredDialogueIds(null);
      setFilterStatus("");
      return;
    }

    setFilterLoading(true);
    setFilterStatus("Filtering dialogues...");
    try {
      const cachedFilter = dialogueFilters.find((filter) => filter.id === filterCacheId);
      if (cachedFilter) {
        setFilteredDialogueIds(new Set(cachedFilter.includedIds));
        setFilterStatus(`Loaded saved filter: ${cachedFilter.includedIds.length} line${cachedFilter.includedIds.length === 1 ? "" : "s"}.`);
        return;
      }

      const response = await fetch("/api/dialogue-filter", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: dialogueFilterPrompt,
          transcript: activeVideo.transcript,
          provider: aiProvider
        })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data?.error || "Dialogue filter failed");
      const includedIds = Array.isArray(data.includedIds) ? data.includedIds.map(String) : [];
      const now = new Date().toISOString();
      const filterResult: DialogueFilterResult = {
        id: filterCacheId,
        videoId: activeVideo.id,
        videoTitle: activeVideo.title,
        videoUrl: activeVideo.contentUrl,
        prompt: dialogueFilterPrompt,
        transcriptSignature,
        includedIds,
        filteredDialogues: activeVideo.transcript.filter((segment) => includedIds.includes(segment.id)),
        reason: typeof data.reason === "string" ? data.reason : "",
        createdAt: now,
        updatedAt: now
      };
      setDialogueFilters((current) => mergeDialogueFilters(current, [filterResult]));
      setFilteredDialogueIds(new Set(includedIds));
      setFilterStatus(`Saved filter: showing ${includedIds.length} line${includedIds.length === 1 ? "" : "s"}.`);
    } catch (error) {
      setFilterStatus(error instanceof Error ? error.message : "Dialogue filter failed.");
    } finally {
      setFilterLoading(false);
    }
  }

  function changeDialogueFilterPrompt() {
    const next = window.prompt("Filter prompt", dialogueFilterPrompt)?.trim();
    if (!next) return;
    setDialogueFilterPrompt(next);
    setFilteredDialogueIds(null);
    setFilterStatus("Prompt updated. Run the filter again.");
  }

  return (
    <div className={`watch-grid ${showExplorer ? "" : "video-selected"}`}>
      {showExplorer ? (
      <section className="video-list">
        <div className="section-head compact">
          <h2>Folders</h2>
          <button className="mini-action" onClick={createFolder}>
            <FolderPlus size={15} />
          </button>
        </div>
        <div className="folder-tabs">
          <button className={selectedFolder === "all" ? "active" : ""} onClick={() => setSelectedFolder("all")}>
            All <span>{videos.length}</span>
          </button>
          {folders.map((folder) => (
            <button
              key={folder.id}
              className={selectedFolder === folder.id ? "active" : ""}
              onClick={() => setSelectedFolder(folder.id)}
            >
              {folder.name} <span>{videos.filter((video) => (video.folderId || "root") === folder.id).length}</span>
            </button>
          ))}
        </div>
        <h2>Videos</h2>
        <div className="video-stack">
          {filteredVideos.map((video) => (
            <div key={video.id} className={`video-row ${video.id === activeVideoId ? "active" : ""}`}>
              <button
                onClick={() => {
                  setActiveVideoId(video.id);
                  setExplorerOpen(false);
                }}
              >
                <div className="thumb">{video.thumbnailUrl ? <img src={video.thumbnailUrl} alt="" /> : <Film />}</div>
                <span>{video.title}</span>
                <small>{video.sourceType === "youtube" ? "YouTube" : `${Math.round(video.duration || 0)}s`}</small>
              </button>
              <div className="video-actions">
                <button onClick={() => renameVideo(video)} title="Rename video">
                  <ClipboardEdit size={14} />
                </button>
                <button className="danger" onClick={() => removeVideo(video)} title="Remove locally">
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>
      ) : null}

      {activeVideo ? (
        <>
      <section className="player-card">
        <div className={`player-frame ${isPaused ? "is-paused" : ""}`} ref={playerFrameRef}>
          {activeVideo.contentUrl ? (
            isYouTube ? (
              <iframe
                title={activeVideo.title}
                src={youtubeEmbedUrl(activeVideo.contentUrl)}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            ) : (
              <video
                ref={videoRef}
                src={activeVideo.contentUrl}
                controls
                playsInline
                preload="metadata"
                poster={activeVideo.thumbnailUrl}
                onLoadedMetadata={(event) => {
                  if (activeVideo.lastPosition) event.currentTarget.currentTime = activeVideo.lastPosition;
                  event.currentTarget.volume = 1;
                  event.currentTarget.muted = false;
                  event.currentTarget.defaultMuted = false;
                  setIsPaused(event.currentTarget.paused);
                }}
                onCanPlay={() => setPlaybackStatus("Ready with sound.")}
                onPlay={(event) => {
                  event.currentTarget.muted = false;
                  event.currentTarget.defaultMuted = false;
                  event.currentTarget.volume = 1;
                  setIsPaused(false);
                  setPlaybackStatus("Playing with sound on.");
                }}
                onPause={() => setIsPaused(true)}
                onEnded={() => setIsPaused(true)}
                onError={(event) => {
                  const message = event.currentTarget.error?.message || "Video failed to load.";
                  setPlaybackStatus(message);
                }}
                onTimeUpdate={(event) => markWatched(event.currentTarget.currentTime)}
              />
            )
          ) : (
            <div className="video-placeholder">
              <Play size={42} />
              <strong>{activeVideo.title}</strong>
              <span>Import a YouLearn space for playable video.</span>
            </div>
          )}
          {activeSegment ? (
            <div className="video-dialogue-overlay">
              {isPaused && !isYouTube ? (
                <button
                  className="paused-dialogue-button"
                  onClick={(event) => {
                    event.stopPropagation();
                    translatePausedDialogue();
                  }}
                  disabled={translationLoading}
                >
                  <span className="dialogue-original">{activeSegment.text}</span>
                  {dialogueTranslation?.segmentId === activeSegment.id ? (
                    <span className="dialogue-translation">{dialogueTranslation.text}</span>
                  ) : (
                    <small>{translationLoading ? "Translating..." : "Click for Hinglish meaning"}</small>
                  )}
                </button>
              ) : (
                <p>{activeSegment.text}</p>
              )}
            </div>
          ) : null}
          <div className="player-overlay-actions">
            {!isYouTube && activeVideo.contentUrl ? (
              <button onClick={toggleVideoPlayback} title={isPaused ? "Play video" : "Pause video"} aria-label={isPaused ? "Play video" : "Pause video"}>
                {isPaused ? <Play size={16} /> : <Pause size={16} />}
              </button>
            ) : null}
            <button onClick={toggleFullscreen} title={isFullscreen ? "Exit fullscreen" : "Fullscreen"} aria-label={isFullscreen ? "Exit fullscreen" : "Fullscreen"}>
              <Maximize2 size={16} />
            </button>
          </div>
        </div>
        <div className="subtitle-card">
          <button className="ghost" onClick={() => setExplorerOpen(true)}>
            <Video size={16} /> All Videos
          </button>
          <button onClick={() => activeSegment && onSaveDialogue(activeVideo, activeSegment)}>
            <Save size={16} /> Save Dialogue
          </button>
        </div>
        {playbackStatus ? <span className="playback-status">{playbackStatus}</span> : null}
      </section>

      <section className="transcript-card">
        <div className="section-head dialogue-head">
          <h2>Dialogues</h2>
          <div className="dialogue-tools">
            <button
              className={isDialogueFilterActive ? "active" : ""}
              onClick={toggleDialogueFilter}
              disabled={filterLoading || !activeVideo.transcript.length}
              title={isDialogueFilterActive ? "Show all dialogues" : "Show only prompt-filtered dialogues"}
              aria-label={isDialogueFilterActive ? "Show all dialogues" : "Show only prompt-filtered dialogues"}
            >
              {filterLoading ? <Loader2 className="spin" size={15} /> : <ListFilter size={15} />}
            </button>
            <button onClick={changeDialogueFilterPrompt} title="Change filter prompt" aria-label="Change filter prompt">
              <SlidersHorizontal size={15} />
            </button>
          </div>
          <span>{visibleTranscript.length} line{visibleTranscript.length === 1 ? "" : "s"}</span>
        </div>
        {filterStatus ? <small className="dialogue-filter-status">{filterStatus}</small> : null}
        <div className="transcript-list">
          {visibleTranscript.map((segment) => (
            <button
              key={segment.id}
              ref={(element) => {
                lineRefs.current[segment.id] = element;
              }}
              className={segment.id === activeSegment?.id ? "active" : ""}
              onClick={() => {
                seekTo(segment);
                onSaveDialogue(activeVideo, segment);
              }}
            >
              <small>{formatTime(segment.startTime)}</small>
              <span>{segment.text}</span>
            </button>
          ))}
          {!visibleTranscript.length ? (
            <div className="empty-dialogue-filter">
              <ListFilter size={24} />
              <span>No lines matched this prompt.</span>
            </div>
          ) : null}
        </div>
        <div className="saved-mini">
          <strong>{savedDialogues.filter((item) => item.videoId === activeVideo.id).length}</strong>
          <span>saved from this video</span>
        </div>
      </section>
        </>
      ) : (
        <section className="watch-empty-state">
          <Video size={42} />
          <h2>Select a video</h2>
          <p>Choose one from the list to open the player and dialogues.</p>
        </section>
      )}
    </div>
  );
}

function SettingsPage({
  videos,
  setVideos,
  setFolders,
  savedDialogues,
  prompt,
  setPrompt,
  onUpdateDialogue,
  aiProvider,
  setAiProvider
}: {
  videos: SpaceVideo[];
  setVideos: React.Dispatch<React.SetStateAction<SpaceVideo[]>>;
  setFolders: React.Dispatch<React.SetStateAction<Folder[]>>;
  savedDialogues: SavedDialogue[];
  prompt: string;
  setPrompt: (prompt: string) => void;
  onUpdateDialogue: (dialogue: SavedDialogue) => void;
  aiProvider: AiProvider;
  setAiProvider: (provider: AiProvider) => void;
}) {
  const [spaceUrl, setSpaceUrl] = React.useState("https://app.youlearn.ai/space/c9241bc0721046c8");
  const [loading, setLoading] = React.useState(false);
  const [selectedVideoId, setSelectedVideoId] = React.useState(videos[0]?.id ?? "");
  const [selectedDialogueId, setSelectedDialogueId] = React.useState(savedDialogues[0]?.id ?? "");
  const [processingId, setProcessingId] = React.useState("");
  const [status, setStatus] = React.useState("");

  async function importSpace() {
    const spaceId = extractSpaceId(spaceUrl);
    if (!spaceId) {
      setStatus("Paste a valid YouLearn space link.");
      return;
    }
    setLoading(true);
    setStatus("Importing videos and transcripts...");
    try {
      const response = await fetch(`/api/youlearn-space?spaceId=${encodeURIComponent(spaceId)}`);
      const data = await response.json();
      if (!response.ok) throw new Error(data?.error || "Import failed");
      const importedFolders = normalizeImportedFolders(spaceId, data.folders ?? []);
      const importedVideos = normalizeImportedVideos(spaceId, data.contents ?? []);
      setFolders((current) => mergeFolders(current, importedFolders));
      setVideos((current) =>
        current.every((video) => video.id.startsWith("demo-")) ? importedVideos : mergeVideos(current, importedVideos)
      );
      setSelectedVideoId(importedVideos[0]?.id ?? selectedVideoId);
      setStatus(`Imported ${importedVideos.length} video(s). Duplicates skipped locally.`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Import failed.");
    } finally {
      setLoading(false);
    }
  }

  async function applySrt(file: File) {
    const text = await file.text();
    const segments = parseSrt(text);
    if (!segments.length) {
      setStatus("No SRT cues found.");
      return;
    }
    setVideos((current) =>
      current.map((video) => (video.id === selectedVideoId ? { ...video, transcript: segments } : video))
    );
    setStatus(`Applied ${segments.length} SRT cues.`);
  }

  async function processDialogue(dialogue: SavedDialogue, mode: "Hinglish" | "English") {
    setProcessingId(dialogue.id);
    try {
      const response = await fetch("/api/dialogue-transform", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dialogue: dialogue.text, prompt, mode, provider: aiProvider })
      });
      const data = await response.json();
      onUpdateDialogue({
        ...dialogue,
        promptResult: data.result || data.translation || "Processed.",
        hinglish: mode === "Hinglish" ? data.hinglish || data.result : dialogue.hinglish,
        english: mode === "English" ? data.english || data.result : dialogue.english
      });
    } finally {
      setProcessingId("");
    }
  }

  return (
    <div className="settings-grid">
      <section className="settings-card settings-import">
        <div>
          <h1>Import</h1>
          <p>Add public YouLearn spaces. Imported clips stay after reload and sync to Supabase.</p>
        </div>
        <div className="import-row">
          <Link size={18} />
          <input value={spaceUrl} onChange={(event) => setSpaceUrl(event.target.value)} />
          <button onClick={importSpace} disabled={loading}>
            {loading ? <Loader2 className="spin" size={18} /> : <Plus size={18} />}
            Import
          </button>
        </div>
        <span className="status-line">{status}</span>
      </section>
      <section className="settings-card">
        <h1>Settings</h1>
        <p>SRT transcript overrides, prompt tools, and AI provider controls live here.</p>
        <div className="ai-mode-card">
          <span>AI mode</span>
          <div className="ai-mode-toggle" role="group" aria-label="AI mode">
            <button className={aiProvider === "youlearn" ? "active" : ""} onClick={() => setAiProvider("youlearn")}>
              YouLearn
            </button>
            <button className={aiProvider === "deepseek" ? "active" : ""} onClick={() => setAiProvider("deepseek")}>
              DeepSeek
            </button>
          </div>
          <small>
            {aiProvider === "deepseek"
              ? "All AI actions use DeepSeek where available."
              : "Library AI uses YouLearn chat; other tutor checks use DeepSeek."}
          </small>
        </div>
      </section>
      <section className="settings-card">
        <h2>Custom transcript</h2>
        <select value={selectedVideoId} onChange={(event) => setSelectedVideoId(event.target.value)}>
          {videos.map((video) => (
            <option key={video.id} value={video.id}>
              {video.title}
            </option>
          ))}
        </select>
        <label className="file-drop">
          <ClipboardEdit size={20} />
          <span>Pick `.srt` file</span>
          <input type="file" accept=".srt" onChange={(event) => event.target.files?.[0] && applySrt(event.target.files[0])} />
        </label>
        <small>{status}</small>
      </section>
      <section className="settings-card">
        <h2>Dialogue prompt</h2>
        <textarea value={prompt} onChange={(event) => setPrompt(event.target.value)} />
        <select value={selectedDialogueId} onChange={(event) => setSelectedDialogueId(event.target.value)}>
          <option value="">Select saved dialogue</option>
          {savedDialogues.map((dialogue) => (
            <option key={dialogue.id} value={dialogue.id}>
              {dialogue.text.slice(0, 80)}
            </option>
          ))}
        </select>
        <div className="prompt-actions">
          <button
            onClick={() => {
              const dialogue = savedDialogues.find((item) => item.id === selectedDialogueId) ?? savedDialogues[0];
              if (dialogue) processDialogue(dialogue, "Hinglish");
            }}
            disabled={!savedDialogues.length || Boolean(processingId)}
          >
            {processingId ? <Loader2 className="spin" size={16} /> : <Sparkles size={16} />}
            Hinglish
          </button>
          <button
            className="blue-btn"
            onClick={() => {
              const dialogue = savedDialogues.find((item) => item.id === selectedDialogueId) ?? savedDialogues[0];
              if (dialogue) processDialogue(dialogue, "English");
            }}
            disabled={!savedDialogues.length || Boolean(processingId)}
          >
            <Languages size={16} />
            English
          </button>
        </div>
      </section>
    </div>
  );
}

function PracticePage({
  savedDialogues,
  onRecord,
  videos,
  prompt,
  aiProvider
}: {
  savedDialogues: SavedDialogue[];
  onRecord: (score: number, dialogue: SavedDialogue) => void;
  videos: SpaceVideo[];
  prompt: string;
  aiProvider: AiProvider;
}) {
  const [testSet, setTestSet] = React.useState<SavedDialogue[]>(() => buildDailySet(savedDialogues));
  const [index, setIndex] = React.useState(0);
  const [answer, setAnswer] = React.useState("");
  const [result, setResult] = React.useState<{ score: number; feedback: string; expected: string } | null>(null);
  const [loading, setLoading] = React.useState(false);
  const active = testSet[index];
  const video = videos.find((item) => item.id === active?.videoId);
  const dialogueIdKey = savedDialogues.map((dialogue) => dialogue.id).join("|");

  React.useEffect(() => {
    setTestSet(buildDailySet(savedDialogues));
    setIndex(0);
    setResult(null);
    setAnswer("");
  }, [dialogueIdKey]);

  async function submit() {
    if (!active || !answer.trim()) return;
    setLoading(true);
    try {
      const response = await fetch("/api/practice-grade", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dialogue: active.text, answer, prompt, provider: aiProvider })
      });
      const data = await response.json();
      const score = Number(data.score ?? 0);
      setResult({
        score,
        feedback: data.feedback || "Checked.",
        expected: data.expected || active.promptResult || active.text
      });
      onRecord(score, active);
    } finally {
      setLoading(false);
    }
  }

  if (!active) {
    return (
      <section className="empty-practice">
        <div className="duo-mascot small" />
        <h1>No saved dialogues yet</h1>
        <p>Go to Watch, save a few dialogues, then start the daily 5-line test.</p>
      </section>
    );
  }

  return (
    <div className="practice-grid">
      <section className="practice-card">
        <div className="section-head">
          <div>
            <h1>Daily Dialogue Test</h1>
            <p>Question {index + 1} of {testSet.length}</p>
          </div>
          <div className="xp-pill">Set {active.bucket}</div>
        </div>
        <div className="clip-box">
          {video?.contentUrl && !isYouTubeUrl(video.contentUrl) ? <video src={video.contentUrl} controls /> : <Film size={52} />}
          <div className="hinglish-subtitle">{active.hinglish || active.promptResult || toHinglishHint(active.text)}</div>
        </div>
        <textarea value={answer} onChange={(event) => setAnswer(event.target.value)} placeholder="Type the English version..." />
        <button className="big-green" onClick={submit} disabled={loading || !answer.trim()}>
          {loading ? <Loader2 className="spin" /> : <Send />}
          Check answer
        </button>
      </section>

      <section className="score-card">
        <h2>Score</h2>
        {result ? (
          <>
            <div className={`score-circle ${result.score >= 80 ? "pass" : "retry"}`}>{result.score}%</div>
            <p>{result.feedback}</p>
            <strong>Expected</strong>
            <span>{result.expected}</span>
            <button
              onClick={() => {
                setIndex((current) => Math.min(current + 1, testSet.length - 1));
                setAnswer("");
                setResult(null);
              }}
            >
              Next <ChevronRight size={18} />
            </button>
          </>
        ) : (
          <p>Submit translation. Correct lines move to lower-priority sets.</p>
        )}
      </section>
    </div>
  );
}

function GraphPage({
  videos,
  savedDialogues,
  scores,
  onUpdateDialogue,
  onDeleteDialogue,
  aiProvider
}: {
  videos: SpaceVideo[];
  savedDialogues: SavedDialogue[];
  scores: DailyScore[];
  onUpdateDialogue: (dialogue: SavedDialogue) => void;
  onDeleteDialogue: (id: string) => void;
  aiProvider: AiProvider;
}) {
  const [editingId, setEditingId] = React.useState("");
  const [draftText, setDraftText] = React.useState("");
  const [selectedId, setSelectedId] = React.useState(savedDialogues[0]?.id ?? "");
  const [chatLoadingId, setChatLoadingId] = React.useState("");
  const [libraryStatus, setLibraryStatus] = React.useState("");
  const previewRef = React.useRef<HTMLVideoElement | null>(null);
  const buckets = [1, 2, 3, 4, 5].map((bucket) => ({
    bucket,
    count: savedDialogues.filter((item) => item.bucket === bucket).length
  }));
  const selectedDialogue = savedDialogues.find((dialogue) => dialogue.id === selectedId) ?? savedDialogues[0];
  const sourceVideo = selectedDialogue ? videos.find((video) => video.id === selectedDialogue.videoId) : undefined;
  const previewUrl = selectedDialogue?.videoUrl || sourceVideo?.contentUrl || "";
  const sourceSegmentIndex =
    sourceVideo?.transcript.findIndex(
      (segment) => segment.startTime === selectedDialogue?.startTime || segment.text === selectedDialogue?.text
    ) ?? -1;
  const sourceSegment = sourceSegmentIndex >= 0 ? sourceVideo?.transcript[sourceSegmentIndex] : undefined;
  const clipStart = selectedDialogue?.startTime ?? 0;
  const clipEnd =
    sourceSegment?.endTime ??
    (sourceSegmentIndex >= 0 ? sourceVideo?.transcript[sourceSegmentIndex + 1]?.startTime : undefined) ??
    clipStart + 12;

  React.useEffect(() => {
    if (!selectedId && savedDialogues[0]) setSelectedId(savedDialogues[0].id);
  }, [selectedId, savedDialogues]);

  React.useEffect(() => {
    if (!previewRef.current || !previewUrl || isYouTubeUrl(previewUrl)) return;
    previewRef.current.currentTime = clipStart;
    previewRef.current.muted = false;
    previewRef.current.defaultMuted = false;
    previewRef.current.volume = 1;
  }, [clipStart, previewUrl]);

  async function fetchHinglish(dialogue: SavedDialogue) {
    const video = videos.find((item) => item.id === dialogue.videoId);
    setSelectedId(dialogue.id);
    setChatLoadingId(dialogue.id);
    setLibraryStatus(aiProvider === "deepseek" ? "Asking DeepSeek..." : "Asking YouLearn chat...");
    try {
      const response = await fetch("/api/youlearn-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          dialogue: dialogue.text,
          videoTitle: dialogue.videoTitle,
          videoId: dialogue.videoId,
          contentId: dialogue.videoId,
          spaceId: extractYoulearnSpaceId(video?.folderId),
          startTime: dialogue.startTime,
          transcript: video?.transcript ?? [],
          provider: aiProvider
        })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data?.error || "YouLearn chat failed");
      onUpdateDialogue({
        ...dialogue,
        promptResult: data.result || data.hinglish || "Fetched from YouLearn.",
        hinglish: data.hinglish || data.result || dialogue.hinglish
      });
      setLibraryStatus(aiProvider === "deepseek" ? "Hinglish fetched from DeepSeek." : "Hinglish fetched from YouLearn.");
    } catch (error) {
      setLibraryStatus(error instanceof Error ? error.message : "YouLearn chat failed.");
    } finally {
      setChatLoadingId("");
    }
  }

  return (
    <div className="progress-grid">
      <section className="progress-card">
        <h1>Dialogue library</h1>
        <div className="bucket-row">
          {buckets.map((item) => (
            <div key={item.bucket} className="bucket-card">
              <strong>{item.count}</strong>
              <span>Set {item.bucket}</span>
            </div>
          ))}
        </div>
        <div className="saved-dialogue-list">
          {savedDialogues.map((dialogue) => (
            <div
              role="button"
              tabIndex={0}
              className={`saved-dialogue-row ${dialogue.id === selectedDialogue?.id ? "active" : ""}`}
              key={dialogue.id}
              onClick={() => setSelectedId(dialogue.id)}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") setSelectedId(dialogue.id);
              }}
            >
              <div>
                <small>{dialogue.videoTitle} - Set {dialogue.bucket}</small>
                {editingId === dialogue.id ? (
                  <input value={draftText} onChange={(event) => setDraftText(event.target.value)} />
                ) : (
                  <strong>{dialogue.text}</strong>
                )}
                {dialogue.hinglish || dialogue.english ? <span>{dialogue.hinglish || dialogue.english}</span> : null}
              </div>
              <div className="row-actions">
                <button
                  className="ai-action"
                  title="Fetch Hinglish from YouLearn"
                  aria-label="Fetch Hinglish from YouLearn"
                  disabled={chatLoadingId === dialogue.id}
                  onClick={(event) => {
                    event.stopPropagation();
                    fetchHinglish(dialogue);
                  }}
                >
                  {chatLoadingId === dialogue.id ? <Loader2 className="spin" size={14} /> : <Languages size={14} />}
                </button>
                {editingId === dialogue.id ? (
                  <button
                    onClick={(event) => {
                      event.stopPropagation();
                      onUpdateDialogue({ ...dialogue, text: draftText.trim() || dialogue.text });
                      setEditingId("");
                    }}
                  >
                    <Save size={16} />
                  </button>
                ) : (
                  <button
                    onClick={(event) => {
                      event.stopPropagation();
                      setEditingId(dialogue.id);
                      setDraftText(dialogue.text);
                    }}
                  >
                    <ClipboardEdit size={16} />
                  </button>
                )}
                <button
                  className="danger"
                  onClick={(event) => {
                    event.stopPropagation();
                    onDeleteDialogue(dialogue.id);
                  }}
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          ))}
        </div>
        {libraryStatus ? <span className="library-status">{libraryStatus}</span> : null}
      </section>
      <section className="progress-card">
        <h2>Source clip</h2>
        <div className="library-preview">
          {previewUrl ? (
            isYouTubeUrl(previewUrl) ? (
              <iframe
                title={selectedDialogue?.videoTitle ?? "Source clip"}
                src={youtubeEmbedUrl(previewUrl, clipStart, clipEnd)}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            ) : (
              <video
                ref={previewRef}
                src={previewUrl}
                controls
                playsInline
                preload="metadata"
                onLoadedMetadata={(event) => {
                  event.currentTarget.currentTime = clipStart;
                  event.currentTarget.muted = false;
                  event.currentTarget.defaultMuted = false;
                  event.currentTarget.volume = 1;
                }}
                onTimeUpdate={(event) => {
                  if (event.currentTarget.currentTime >= clipEnd) event.currentTarget.pause();
                }}
              />
            )
          ) : (
            <div className="video-placeholder">
              <Film size={42} />
              <span>Select a saved dialogue with a source video.</span>
            </div>
          )}
        </div>
        {selectedDialogue ? (
          <div className="preview-dialogue">
            <small>
              {formatTime(clipStart)} - {formatTime(clipEnd)}
            </small>
            <strong>{selectedDialogue.text}</strong>
          </div>
        ) : null}
        <h2>Daily scores</h2>
        {scores.slice(0, 12).map((score) => (
          <div className="score-row" key={score.date}>
            <span>{score.date}</span>
            <strong>{Math.round(score.totalScore / Math.max(1, score.attempted))}%</strong>
            <small>{score.attempted} attempts</small>
          </div>
        ))}
      </section>
    </div>
  );
}

function buildDailySet(dialogues: SavedDialogue[]) {
  return dialogues
    .slice()
    .sort((a, b) => a.bucket - b.bucket || b.missCount - a.missCount || a.correctCount - b.correctCount)
    .slice(0, 5);
}

function buildStats(videos: SpaceVideo[], saved: SavedDialogue[], scores: DailyScore[], folders: Folder[]) {
  const dates = new Set(scores.filter((score) => score.attempted > 0).map((score) => score.date));
  let streak = 0;
  const day = new Date();
  while (dates.has(day.toISOString().slice(0, 10))) {
    streak += 1;
    day.setDate(day.getDate() - 1);
  }
  const attempts = scores.reduce((sum, score) => sum + score.attempted, 0);
  const total = scores.reduce((sum, score) => sum + score.totalScore, 0);
  return {
    streak,
    saved: saved.length,
    watched: videos.filter((video) => video.watchedAt).length,
    folders: folders.length,
    avg: attempts ? Math.round(total / attempts) : 0
  };
}

function mergeVideos(current: SpaceVideo[], incoming: SpaceVideo[]) {
  const map = new Map(current.map((video) => [video.id, video]));
  for (const video of incoming) {
    const existing = map.get(video.id);
    map.set(video.id, existing ? { ...video, ...existing, transcript: existing.transcript?.length ? existing.transcript : video.transcript } : video);
  }
  return Array.from(map.values());
}

function mergeFolders(current: Folder[], incoming: Folder[]) {
  return mergeById(current, incoming).length ? mergeById(current, incoming) : defaultFolders;
}

function mergeById<T extends { id: string }>(current: T[], incoming: T[]) {
  const map = new Map(current.map((item) => [item.id, item]));
  for (const item of incoming) map.set(item.id, { ...item, ...map.get(item.id) });
  return Array.from(map.values());
}

function mergeDialogueFilters(current: DialogueFilterResult[], incoming: DialogueFilterResult[]) {
  const map = new Map(current.map((filter) => [filter.id, filter]));
  for (const filter of incoming) {
    const existing = map.get(filter.id);
    if (!existing || String(filter.updatedAt || "") >= String(existing.updatedAt || "")) {
      map.set(filter.id, filter);
    }
  }
  return Array.from(map.values()).sort((a, b) => String(b.updatedAt || "").localeCompare(String(a.updatedAt || "")));
}

function mergeScores(current: DailyScore[], incoming: DailyScore[]) {
  const map = new Map(current.map((score) => [score.date, score]));
  for (const score of incoming) {
    const existing = map.get(score.date);
    map.set(score.date, existing ? { date: score.date, attempted: Math.max(existing.attempted, score.attempted), totalScore: Math.max(existing.totalScore, score.totalScore) } : score);
  }
  return Array.from(map.values()).sort((a, b) => b.date.localeCompare(a.date));
}

function normalizeImportedFolders(spaceId: string, rawFolders: Array<{ folderId: string; folderName: string }>) {
  const folders = rawFolders.map((folder) => ({
    id: `yl-${spaceId}-${folder.folderId}`,
    name: folder.folderName || "YouLearn Folder",
    source: "youlearn" as const
  }));
  return folders.length ? folders : [{ id: `yl-${spaceId}-root`, name: "YouLearn Import", source: "youlearn" as const }];
}

function normalizeImportedVideos(spaceId: string, rawVideos: SpaceVideo[]) {
  return rawVideos.map((video) => ({
    ...video,
    id: video.id,
    folderId: video.folderId ? `yl-${spaceId}-${video.folderId}` : `yl-${spaceId}-root`,
    folderName: video.folderName || "YouLearn Import"
  }));
}

function extractYoulearnSpaceId(folderId?: string) {
  const match = String(folderId || "").match(/^yl-([A-Za-z0-9_]+)(?:-|$)/);
  return match?.[1] ?? "";
}

function parseSrt(input: string): TranscriptSegment[] {
  return input
    .replace(/\r/g, "")
    .split(/\n\n+/)
    .map((block, index) => {
      const lines = block.split("\n").filter(Boolean);
      const timeLine = lines.find((line) => line.includes("-->"));
      if (!timeLine) return null;
      const [startRaw, endRaw] = timeLine.split("-->").map((part) => part.trim());
      const text = lines.slice(lines.indexOf(timeLine) + 1).join(" ").trim();
      if (!text) return null;
      return {
        id: `srt-${Date.now()}-${index}`,
        startTime: srtTime(startRaw),
        endTime: srtTime(endRaw),
        text,
        custom: true
      };
    })
    .filter(Boolean) as TranscriptSegment[];
}

function srtTime(value: string) {
  const match = value.match(/(?:(\d+):)?(\d+):(\d+)[,.](\d+)/);
  if (!match) return 0;
  const hours = Number(match[1] || 0);
  const minutes = Number(match[2] || 0);
  const seconds = Number(match[3] || 0);
  const ms = Number(match[4] || 0);
  return hours * 3600 + minutes * 60 + seconds + ms / 1000;
}

function isYouTubeUrl(url: string) {
  return /(?:youtube\.com|youtu\.be)/i.test(url);
}

function youtubeEmbedUrl(url: string, startSeconds = 0, endSeconds?: number) {
  const id = url.match(/[?&]v=([^&]+)/)?.[1] || url.match(/youtu\.be\/([^?]+)/)?.[1] || url.split("/").pop() || "";
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const params = new URLSearchParams({
    rel: "0",
    mute: "0",
    playsinline: "1",
    enablejsapi: "1"
  });
  if (startSeconds > 0) params.set("start", String(Math.floor(startSeconds)));
  if (endSeconds && endSeconds > startSeconds) params.set("end", String(Math.ceil(endSeconds)));
  if (origin) params.set("origin", origin);
  return `https://www.youtube.com/embed/${encodeURIComponent(id)}?${params.toString()}`;
}

function formatTime(seconds: number) {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${String(secs).padStart(2, "0")}`;
}

function buildTranscriptSignature(transcript: TranscriptSegment[]) {
  const source = transcript.map((segment) => `${segment.id}:${segment.startTime}:${segment.text}`).join("|");
  return hashString(source || "empty");
}

function buildDialogueFilterId(videoId: string, transcriptSignature: string, prompt: string) {
  return `filter-${hashString([videoId, transcriptSignature, prompt.trim().toLowerCase()].join("|"))}`;
}

function hashString(value: string) {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) | 0;
  }
  return Math.abs(hash).toString(36);
}

function toHinglishHint(text: string) {
  return `Hinglish hint: "${text}" ko natural English mein likho.`;
}

ReactDOM.createRoot(document.getElementById("root")!).render(<App />);
