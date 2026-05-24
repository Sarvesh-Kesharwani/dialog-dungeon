import React from "react";
import ReactDOM from "react-dom/client";
import {
  BarChart3,
  BookOpen,
  Bot,
  Check,
  ChevronDown,
  Clapperboard,
  Flame,
  Home,
  MessageCircle,
  Pencil,
  Play,
  RotateCcw,
  Save,
  Send,
  Settings,
  SlidersHorizontal,
  Sparkles,
  Star,
  Trash2,
  Trophy,
  Video,
  X
} from "lucide-react";
import "./styles.css";

type MistakeType = "Vocabulary" | "Phrase" | "Proverb" | "Article" | "Grammar";

type SceneResult = {
  movie: string;
  scene: string;
  title: string;
  paragraph: string;
  sceneBeats: string[];
  toneWords: string[];
  webContextUsed: boolean;
};

type Mistake = {
  id: string;
  type: MistakeType;
  label: string;
  userText: string;
  suggestion: string;
  why: string;
  memoryCue: string;
  movie: string;
  scene: string;
  sourceParagraph: string;
  userTranslation: string;
  createdAt: string;
  favorite?: boolean;
};

type ReviewResult = {
  overall: string;
  improvedTranslation: string;
  mistakes: Omit<Mistake, "movie" | "scene" | "sourceParagraph" | "userTranslation" | "createdAt">[];
};

const movies = [
  "3 Idiots (2009)",
  "Taare Zameen Par (2007)",
  "Dangal (2016)",
  "Lagaan (2001)",
  "The Pursuit of Happyness"
];

const scenes = [
  "Ranchoddas Speech",
  "Ishaan's Painting",
  "Training Montage",
  "Climax Decision",
  "Father-Son Talk"
];

const tabs: MistakeType[] = ["Vocabulary", "Phrase", "Proverb", "Article", "Grammar"];

const tabLabels: Record<MistakeType, string> = {
  Vocabulary: "Vocabulary",
  Phrase: "Phrases",
  Proverb: "Proverbs",
  Article: "Articles",
  Grammar: "Grammar"
};

const typeColors: Record<MistakeType, string> = {
  Vocabulary: "green",
  Phrase: "purple",
  Proverb: "amber",
  Article: "blue",
  Grammar: "violet"
};

const seedMistakes: Mistake[] = [
  {
    id: "seed-1",
    type: "Article",
    label: "Missing article",
    userText: "He tells Farhan that life is not a race.",
    suggestion: "He tells Farhan that life is not a race.",
    why: "Use article 'a' before 'race' (a race).",
    memoryCue: "a race",
    movie: "3 Idiots (2009)",
    scene: "Ranchoddas Speech",
    sourceParagraph: "Rancho Farhan ko samjhata hai ki life race nahi hai.",
    userTranslation: "He tells Farhan that life is not race.",
    createdAt: "Today, 10:35 AM"
  },
  {
    id: "seed-2",
    type: "Vocabulary",
    label: "Plural word choice",
    userText: "We should follow our passion and do what we love.",
    suggestion: "We should follow our passions and do what we love.",
    why: "Use plural 'passions' to sound more natural.",
    memoryCue: "passions",
    movie: "3 Idiots (2009)",
    scene: "Ranchoddas Speech",
    sourceParagraph: "Apni khushi aur passion ko follow karo.",
    userTranslation: "We should follow our passion.",
    createdAt: "Today, 10:35 AM",
    favorite: true
  },
  {
    id: "seed-3",
    type: "Vocabulary",
    label: "Word Choice",
    userText: "Then we can be happy and successful.",
    suggestion: "Then we can be happy and successful.",
    why: "Better word choice for stronger impact.",
    memoryCue: "successful",
    movie: "3 Idiots (2009)",
    scene: "Ranchoddas Speech",
    sourceParagraph: "Tabhi tum sach mein successful aur khush rahoge.",
    userTranslation: "Then we can be happy and successful.",
    createdAt: "Today, 10:35 AM"
  },
  {
    id: "seed-4",
    type: "Phrase",
    label: "Natural phrase",
    userText: "Ishaan was very sad because nobody understood him.",
    suggestion: "Ishaan was very upset because no one understood him.",
    why: "Use 'no one' instead of 'nobody' in this sentence.",
    memoryCue: "no one understood",
    movie: "Taare Zameen Par (2007)",
    scene: "Ishaan's Painting",
    sourceParagraph: "Ishaan dukhi tha kyunki koi usko samajh nahi raha tha.",
    userTranslation: "Ishaan was very sad because nobody understood him.",
    createdAt: "Yesterday, 8:20 PM"
  }
];

function App() {
  const [page, setPage] = React.useState<"home" | "graph">("home");
  const [movie, setMovie] = React.useState(movies[0]);
  const [scene, setScene] = React.useState(scenes[0]);
  const [language, setLanguage] = React.useState<"Hinglish" | "Hindi">("Hinglish");
  const [sceneResult, setSceneResult] = React.useState<SceneResult | null>({
    movie: movies[0],
    scene: scenes[0],
    title: "3 Idiots: Ranchoddas Speech",
    paragraph:
      "Is scene mein Rancho apne dost Farhan ko motivate karta hai jab wo apne sapno ko lekar confuse hota hai. Rancho kehta hai ki life race nahi hai, balki apni khushi aur passion ko samajhna important hai. Wo Farhan ko batata hai ki agar tumhe kisi cheez mein interest hai, toh usse dil se karo, tabhi tum sach mein successful aur khush rahoge.",
    sceneBeats: ["friendship", "motivation", "career choice", "self-belief"],
    toneWords: ["warm", "honest", "hopeful"],
    webContextUsed: false
  });
  const [translation, setTranslation] = React.useState(
    "He tells Farhan that life is not a race. We should follow our passion and do what we love. Then we can be happy and successful."
  );
  const [review, setReview] = React.useState<ReviewResult | null>(null);
  const [activeTab, setActiveTab] = React.useState<MistakeType>("Vocabulary");
  const [mistakes, setMistakes] = React.useState<Mistake[]>(() => {
    const stored = localStorage.getItem("dialogdungeon-mistakes");
    if (!stored) return seedMistakes;
    try {
      return JSON.parse(stored) as Mistake[];
    } catch {
      return seedMistakes;
    }
  });
  const [loadingScene, setLoadingScene] = React.useState(false);
  const [loadingReview, setLoadingReview] = React.useState(false);

  React.useEffect(() => {
    localStorage.setItem("dialogdungeon-mistakes", JSON.stringify(mistakes));
  }, [mistakes]);

  const stats = React.useMemo(() => {
    const byType = tabs.map((type) => ({
      type,
      count: mistakes.filter((item) => item.type === type).length
    }));
    return {
      total: mistakes.length,
      byType,
      score: 165420,
      goal: 28,
      movies: new Set(mistakes.map((item) => item.movie)).size
    };
  }, [mistakes]);

  async function fetchScene() {
    setLoadingScene(true);
    setReview(null);
    try {
      const response = await fetch("/api/scene", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ movie, scene, language })
      });
      const data = (await response.json()) as SceneResult;
      setSceneResult(data);
      setTranslation("");
    } finally {
      setLoadingScene(false);
    }
  }

  async function reviewTranslation() {
    if (!sceneResult || !translation.trim()) return;
    setLoadingReview(true);
    try {
      const response = await fetch("/api/review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          movie,
          scene,
          sourceParagraph: sceneResult.paragraph,
          userTranslation: translation
        })
      });
      const data = (await response.json()) as ReviewResult;
      setReview(data);
      const saved = data.mistakes.map((item) => ({
        ...item,
        movie,
        scene,
        sourceParagraph: sceneResult.paragraph,
        userTranslation: translation,
        createdAt: new Date().toLocaleString(undefined, {
          month: "short",
          day: "numeric",
          hour: "numeric",
          minute: "2-digit"
        })
      }));
      setMistakes((current) => [...saved, ...current]);
      setActiveTab(saved[0]?.type ?? "Vocabulary");
    } finally {
      setLoadingReview(false);
    }
  }

  function updateMistake(updated: Mistake) {
    setMistakes((current) => current.map((item) => (item.id === updated.id ? updated : item)));
  }

  function deleteMistake(id: string) {
    setMistakes((current) => current.filter((item) => item.id !== id));
  }

  function toggleFavorite(id: string) {
    setMistakes((current) =>
      current.map((item) => (item.id === id ? { ...item, favorite: !item.favorite } : item))
    );
  }

  return (
    <main className="app-shell">
      <TopBar page={page} onPageChange={setPage} stats={stats} />
      {page === "home" ? (
        <section className="workspace" aria-label="DialogDungeon learning workspace">
          <ChatPanel
            movie={movie}
            scene={scene}
            language={language}
            sceneResult={sceneResult}
            translation={translation}
            review={review}
            loadingScene={loadingScene}
            loadingReview={loadingReview}
            onMovieChange={setMovie}
            onSceneChange={setScene}
            onLanguageChange={setLanguage}
            onFetchScene={fetchScene}
            onTranslationChange={setTranslation}
            onReviewTranslation={reviewTranslation}
          />
          <LearningPanel
            activeTab={activeTab}
            onTabChange={setActiveTab}
            mistakes={mistakes}
            stats={stats}
            onUpdateMistake={updateMistake}
            onDeleteMistake={deleteMistake}
            onToggleFavorite={toggleFavorite}
          />
        </section>
      ) : (
        <GraphView stats={stats} mistakes={mistakes} onBack={() => setPage("home")} />
      )}
    </main>
  );
}

function TopBar({
  page,
  onPageChange,
  stats
}: {
  page: "home" | "graph";
  onPageChange: (page: "home" | "graph") => void;
  stats: { total: number; score: number; goal: number };
}) {
  return (
    <header className="topbar">
      <div className="brand">
        <img className="brand-logo" src="/dialog-dungeon-logo.svg" alt="DialogDungeon" />
        <h1>
          Dialog<span>Dungeon</span>
        </h1>
      </div>

      <nav className="nav-tabs" aria-label="Primary">
        <button className={page === "home" ? "active" : ""} onClick={() => onPageChange("home")}>
          <Home size={22} />
          Home
        </button>
        <button className={page === "graph" ? "active" : ""} onClick={() => onPageChange("graph")}>
          <BarChart3 size={22} />
          Vocab Graph
        </button>
      </nav>

      <div className="top-stats">
        <StatCard
          icon={<Trophy size={25} />}
          label="Learning Score"
          value={stats.score.toLocaleString()}
          meta="+ 12.5%"
          tone="gold"
        />
        <StatCard
          icon={<Star size={27} />}
          label="Today's Goal"
          value={`${stats.goal}`}
          suffix="/ 35 min"
          tone="star"
          progress
        />
        <StatCard icon={<Flame size={25} />} label="Streak" value="7" suffix="days" tone="flame" />
        <div className="profile-avatar" aria-label="Learner avatar">
          <span />
        </div>
      </div>
    </header>
  );
}

function StatCard({
  icon,
  label,
  value,
  suffix,
  meta,
  tone,
  progress
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  suffix?: string;
  meta?: string;
  tone: string;
  progress?: boolean;
}) {
  return (
    <div className={`stat-card ${tone}`}>
      <div className="stat-icon">{icon}</div>
      <div>
        <span>{label}</span>
        <strong>
          {value} {suffix ? <small>{suffix}</small> : null}
        </strong>
      </div>
      {meta ? <em>{meta}</em> : null}
      {progress ? <i /> : null}
    </div>
  );
}

function ChatPanel(props: {
  movie: string;
  scene: string;
  language: "Hinglish" | "Hindi";
  sceneResult: SceneResult | null;
  translation: string;
  review: ReviewResult | null;
  loadingScene: boolean;
  loadingReview: boolean;
  onMovieChange: (movie: string) => void;
  onSceneChange: (scene: string) => void;
  onLanguageChange: (language: "Hinglish" | "Hindi") => void;
  onFetchScene: () => void;
  onTranslationChange: (value: string) => void;
  onReviewTranslation: () => void;
}) {
  return (
    <section className="panel chat-panel">
      <div className="setup-card">
        <h2>1. Choose Movie &amp; Scene</h2>
        <div className="select-grid">
          <label className="select-shell">
            <Clapperboard size={32} />
            <span>Movie</span>
            <select value={props.movie} onChange={(event) => props.onMovieChange(event.target.value)}>
              {movies.map((item) => (
                <option key={item}>{item}</option>
              ))}
            </select>
            <ChevronDown size={18} />
          </label>
          <label className="select-shell">
            <Video size={32} />
            <span>Scene</span>
            <select value={props.scene} onChange={(event) => props.onSceneChange(event.target.value)}>
              {scenes.map((item) => (
                <option key={item}>{item}</option>
              ))}
            </select>
            <ChevronDown size={18} />
          </label>
        </div>

        <h2>2. Choose Language for Explanation</h2>
        <div className="language-row">
          {(["Hindi", "Hinglish"] as const).map((item) => (
            <button
              key={item}
              className={props.language === item ? "active" : ""}
              onClick={() => props.onLanguageChange(item)}
            >
              {item}
              {props.language === item ? <Check size={18} /> : null}
            </button>
          ))}
          <button className="fetch-scene" onClick={props.onFetchScene} disabled={props.loadingScene}>
            <Play size={18} />
            {props.loadingScene ? "Fetching" : "Fetch Scene"}
          </button>
        </div>
      </div>

      <div className="chat-stream">
        <SceneBubble role="assistant" icon="learner" text={props.sceneResult?.paragraph ?? ""} time="10:32 AM" />
        {props.translation ? (
          <SceneBubble role="user" icon="learner" text={props.translation} time="10:35 AM" />
        ) : null}
        <SceneBubble
          role="assistant"
          icon="bot"
          text={
            props.review
              ? `${props.review.overall} I saved the issues on the right.`
              : "Great! Translation review ready."
          }
          time="10:35 AM"
        />
      </div>

      <div className="composer">
        <textarea
          value={props.translation}
          onChange={(event) => props.onTranslationChange(event.target.value)}
          placeholder="Type your English translation here..."
          disabled={!props.sceneResult}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              props.onReviewTranslation();
            }
          }}
        />
        <button
          className="send-btn"
          onClick={props.onReviewTranslation}
          disabled={!props.sceneResult || !props.translation.trim() || props.loadingReview}
          aria-label="Review translation"
        >
          <Send size={24} />
        </button>
      </div>
    </section>
  );
}

function SceneBubble({
  role,
  icon,
  text,
  time
}: {
  role: "assistant" | "user";
  icon: "learner" | "bot";
  text: string;
  time: string;
}) {
  return (
    <article className={`scene-bubble ${role}`}>
      <div className={`bubble-avatar ${icon}`}>
        {icon === "bot" ? <Bot size={24} /> : <span />}
      </div>
      <div className="bubble-card">
        <p>{text}</p>
        <time>{time}</time>
      </div>
    </article>
  );
}

function LearningPanel({
  activeTab,
  onTabChange,
  mistakes,
  stats,
  onUpdateMistake,
  onDeleteMistake,
  onToggleFavorite
}: {
  activeTab: MistakeType;
  onTabChange: (tab: MistakeType) => void;
  mistakes: Mistake[];
  stats: { total: number; byType: { type: MistakeType; count: number }[] };
  onUpdateMistake: (item: Mistake) => void;
  onDeleteMistake: (id: string) => void;
  onToggleFavorite: (id: string) => void;
}) {
  const [movieFilter, setMovieFilter] = React.useState("All Movies");
  const [sortOrder, setSortOrder] = React.useState<"newest" | "oldest" | "favorites">("newest");
  const [showAll, setShowAll] = React.useState(false);
  const [editing, setEditing] = React.useState<Mistake | null>(null);
  const movieOptions = React.useMemo(
    () => ["All Movies", ...Array.from(new Set(mistakes.map((item) => item.movie)))],
    [mistakes]
  );

  const visible = React.useMemo(() => {
    const filtered = mistakes
      .filter((item) => showAll || item.type === activeTab)
      .filter((item) => movieFilter === "All Movies" || item.movie === movieFilter)
      .filter((item) => sortOrder !== "favorites" || item.favorite);

    return [...filtered]
      .sort((a, b) => {
        if (sortOrder === "oldest") return a.id.localeCompare(b.id);
        if (sortOrder === "favorites") return Number(b.favorite) - Number(a.favorite);
        return b.id.localeCompare(a.id);
      })
      .slice(0, 4);
  }, [activeTab, mistakes, movieFilter, showAll, sortOrder]);

  function resetView() {
    setShowAll(true);
    setMovieFilter("All Movies");
    setSortOrder("newest");
  }

  return (
    <section className="panel learning-panel">
      <div className="tab-row" role="tablist" aria-label="Learning categories">
        {tabs.map((tab) => (
          <button
            key={tab}
            role="tab"
            aria-selected={activeTab === tab}
            className={activeTab === tab ? "active" : ""}
            onClick={() => {
              setShowAll(false);
              onTabChange(tab);
            }}
          >
            <TabIcon type={tab} />
            {tabLabels[tab]}
          </button>
        ))}
      </div>

      <div className="list-toolbar">
        <p>Your saved mistakes and better ways to say things.</p>
        <div>
          <label className="toolbar-select">
            <SlidersHorizontal size={18} />
            <select
              aria-label="Filter movies"
              value={movieFilter}
              onChange={(event) => setMovieFilter(event.target.value)}
            >
              {movieOptions.map((movie) => (
                <option key={movie}>{movie}</option>
              ))}
            </select>
            <ChevronDown size={16} />
          </label>
          <label className="toolbar-select">
            <BarChart3 size={18} />
            <select
              aria-label="Sort mistakes"
              value={sortOrder}
              onChange={(event) => setSortOrder(event.target.value as "newest" | "oldest" | "favorites")}
            >
              <option value="newest">Newest First</option>
              <option value="oldest">Oldest First</option>
              <option value="favorites">Favorites</option>
            </select>
            <ChevronDown size={16} />
          </label>
        </div>
      </div>

      <div className="mistake-table">
        {visible.length ? (
          visible.map((item) => (
            <MistakeRow
              key={item.id}
              item={item}
              onEdit={() => setEditing(item)}
              onDelete={() => onDeleteMistake(item.id)}
              onToggleFavorite={() => onToggleFavorite(item.id)}
            />
          ))
        ) : (
          <div className="empty-table">
            <strong>No saved items here.</strong>
            <span>Use View All or review another translation.</span>
          </div>
        )}
      </div>

      <div className="summary-bar">
        <div className="summary-title">
          <Trophy size={25} />
          <span>Total Items Learned</span>
          <strong>{Math.max(stats.total, 128)}</strong>
        </div>
        {stats.byType.map((item, index) => (
          <div className={`summary-count ${typeColors[item.type]}`} key={item.type}>
            <span>{tabLabels[item.type]}</span>
            <strong>{[56, 34, 12, 14, 12][index] + item.count}</strong>
          </div>
        ))}
        <button className="view-all" onClick={resetView}>
          <RotateCcw size={14} /> View All
        </button>
      </div>

      {editing ? (
        <EditMistakeDialog
          item={editing}
          onClose={() => setEditing(null)}
          onSave={(updated) => {
            onUpdateMistake(updated);
            setEditing(null);
          }}
        />
      ) : null}
    </section>
  );
}

function TabIcon({ type }: { type: MistakeType }) {
  if (type === "Vocabulary") return <BookOpen size={20} />;
  if (type === "Phrase") return <MessageCircle size={20} />;
  if (type === "Proverb") return <Sparkles size={20} />;
  if (type === "Article") return <Clapperboard size={20} />;
  return <Settings size={20} />;
}

function MistakeRow({
  item,
  onEdit,
  onDelete,
  onToggleFavorite
}: {
  item: Mistake;
  onEdit: () => void;
  onDelete: () => void;
  onToggleFavorite: () => void;
}) {
  return (
    <article className="mistake-row">
      <PosterTile movie={item.movie} />
      <div className="movie-meta">
        <strong>{item.movie}</strong>
        <span>Scene: {item.scene}</span>
        <small>{item.createdAt}</small>
      </div>
      <div className="sentence-compare">
        <label>Your sentence</label>
        <p>{highlightTerm(item.userText, item.memoryCue, "bad")}</p>
        <label className="better">Better</label>
        <p>{highlightTerm(item.suggestion, item.memoryCue, "good")}</p>
      </div>
      <div className="row-note">
        <span className={`type-chip ${typeColors[item.type]}`}>{item.label || item.type}</span>
        <p>{item.why}</p>
        <div className="row-actions">
          <button onClick={onEdit}>
            <Pencil size={13} /> Edit
          </button>
          <button className="danger" onClick={onDelete}>
            <Trash2 size={13} /> Delete
          </button>
        </div>
      </div>
      <button
        className={`star-btn ${item.favorite ? "active" : ""}`}
        onClick={onToggleFavorite}
        aria-label={item.favorite ? "Remove favorite" : "Save favorite"}
      >
        <Star size={20} />
      </button>
    </article>
  );
}

function EditMistakeDialog({
  item,
  onSave,
  onClose
}: {
  item: Mistake;
  onSave: (item: Mistake) => void;
  onClose: () => void;
}) {
  const [draft, setDraft] = React.useState(item);

  function update<K extends keyof Mistake>(key: K, value: Mistake[K]) {
    setDraft((current) => ({ ...current, [key]: value }));
  }

  return (
    <div className="edit-backdrop" role="dialog" aria-modal="true" aria-label="Edit mistake">
      <form
        className="edit-card"
        onSubmit={(event) => {
          event.preventDefault();
          onSave(draft);
        }}
      >
        <div className="edit-head">
          <h3>Edit mistake</h3>
          <button type="button" onClick={onClose} aria-label="Close editor">
            <X size={18} />
          </button>
        </div>

        <label>
          Category
          <select value={draft.type} onChange={(event) => update("type", event.target.value as MistakeType)}>
            {tabs.map((tab) => (
              <option key={tab} value={tab}>
                {tabLabels[tab]}
              </option>
            ))}
          </select>
        </label>
        <label>
          Label
          <input value={draft.label} onChange={(event) => update("label", event.target.value)} />
        </label>
        <label>
          Your sentence
          <textarea value={draft.userText} onChange={(event) => update("userText", event.target.value)} />
        </label>
        <label>
          Better sentence
          <textarea value={draft.suggestion} onChange={(event) => update("suggestion", event.target.value)} />
        </label>
        <label>
          Why
          <textarea value={draft.why} onChange={(event) => update("why", event.target.value)} />
        </label>

        <div className="edit-actions">
          <button type="button" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="save-edit">
            <Save size={15} /> Save
          </button>
        </div>
      </form>
    </div>
  );
}

function highlightTerm(text: string, term: string, tone: "bad" | "good") {
  if (!term) return text;
  const index = text.toLowerCase().indexOf(term.toLowerCase());
  if (index < 0) return text;
  const before = text.slice(0, index);
  const match = text.slice(index, index + term.length);
  const after = text.slice(index + term.length);
  return (
    <>
      {before}
      <mark className={tone}>{match}</mark>
      {after}
    </>
  );
}

function PosterTile({ movie }: { movie: string }) {
  const isTaare = movie.includes("Taare");
  return (
    <div className={`poster-tile ${isTaare ? "taare" : ""}`}>
      <strong>{isTaare ? "Taare\nZameen\nPar" : "3 idiots"}</strong>
      <span />
    </div>
  );
}

function GraphView({
  stats,
  mistakes,
  onBack
}: {
  stats: { byType: { type: MistakeType; count: number }[]; total: number };
  mistakes: Mistake[];
  onBack: () => void;
}) {
  const max = Math.max(...stats.byType.map((item) => item.count), 1);

  return (
    <section className="graph-page">
      <div className="graph-head">
        <div>
          <p>Vocab Graph</p>
          <h2>Context memory map</h2>
        </div>
        <button onClick={onBack}>Back to Home</button>
      </div>

      <div className="graph-grid">
        <div className="graph-board">
          <div className="center-node">
            <img src="/dialog-dungeon-logo.svg" alt="" />
            <strong>{stats.total}</strong>
            <span>saved fixes</span>
          </div>
          {stats.byType.map((item, index) => (
            <div
              className={`graph-node node-${index}`}
              key={item.type}
              style={{ "--strength": String(0.35 + item.count / max) } as React.CSSProperties}
            >
              <span>{item.count}</span>
              {tabLabels[item.type]}
            </div>
          ))}
        </div>
        <div className="graph-list">
          {mistakes.slice(0, 8).map((item) => (
            <div className="graph-row" key={item.id}>
              <Star size={16} />
              <div>
                <strong>{item.suggestion || item.label}</strong>
                <span>
                  {item.movie} / {item.scene}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

ReactDOM.createRoot(document.getElementById("root")!).render(<App />);
