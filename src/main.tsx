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
  Home,
  Languages,
  Link,
  Loader2,
  Play,
  Plus,
  Save,
  Send,
  Sparkles,
  Star,
  Trash2,
  Trophy,
  Video
} from "lucide-react";
import "./styles.css";

type Page = "home" | "watch" | "practice" | "graph";

type TranscriptSegment = {
  id: string;
  startTime: number;
  text: string;
  custom?: boolean;
};

type SpaceVideo = {
  id: string;
  title: string;
  contentUrl: string;
  thumbnailUrl?: string;
  duration: number;
  transcript: TranscriptSegment[];
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

type DailyScore = {
  date: string;
  attempted: number;
  totalScore: number;
};

const defaultPrompt =
  "Explain this movie dialogue in Hinglish, then give a natural English version. Keep it short and learner friendly.";

const fallbackVideos: SpaceVideo[] = [
  {
    id: "demo-3idiots",
    title: "3 Idiots - Ranchoddas Speech",
    contentUrl: "",
    thumbnailUrl: "",
    duration: 132,
    transcript: [
      { id: "d1", startTime: 0, text: "Life is not a race, Farhan." },
      { id: "d2", startTime: 8, text: "Do what your heart understands, not what fear demands." },
      { id: "d3", startTime: 18, text: "If you follow your passion, success will follow you." },
      { id: "d4", startTime: 31, text: "Your dream deserves courage, not permission." }
    ]
  },
  {
    id: "demo-taare",
    title: "Taare Zameen Par - Teacher Understands Ishaan",
    contentUrl: "",
    thumbnailUrl: "",
    duration: 98,
    transcript: [
      { id: "t1", startTime: 0, text: "Every child has a different rhythm." },
      { id: "t2", startTime: 9, text: "He is not lazy; he is trying to survive a world that does not see him." },
      { id: "t3", startTime: 22, text: "Sometimes a little patience becomes a bridge." }
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

function App() {
  const [page, setPage] = React.useState<Page>("home");
  const [videos, setVideos] = React.useState<SpaceVideo[]>(() =>
    readJson("dialogdungeon-videos", fallbackVideos)
  );
  const [savedDialogues, setSavedDialogues] = React.useState<SavedDialogue[]>(() =>
    readJson("dialogdungeon-dialogues", [])
  );
  const [scores, setScores] = React.useState<DailyScore[]>(() => readJson("dialogdungeon-scores", []));
  const [prompt, setPrompt] = React.useState(() => localStorage.getItem("dialogdungeon-prompt") || defaultPrompt);

  React.useEffect(() => localStorage.setItem("dialogdungeon-videos", JSON.stringify(videos)), [videos]);
  React.useEffect(
    () => localStorage.setItem("dialogdungeon-dialogues", JSON.stringify(savedDialogues)),
    [savedDialogues]
  );
  React.useEffect(() => localStorage.setItem("dialogdungeon-scores", JSON.stringify(scores)), [scores]);
  React.useEffect(() => localStorage.setItem("dialogdungeon-prompt", prompt), [prompt]);

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

  return (
    <main className="duo-app">
      <SideNav page={page} onPage={setPage} savedCount={savedDialogues.length} />
      <section className="duo-main">
        {page === "home" ? (
          <HomePage
            videos={videos}
            savedDialogues={savedDialogues}
            todayScore={todayScore}
            onPage={setPage}
          />
        ) : null}
        {page === "watch" ? (
          <WatchPage
            videos={videos}
            setVideos={setVideos}
            savedDialogues={savedDialogues}
            onSaveDialogue={saveDialogue}
            prompt={prompt}
            setPrompt={setPrompt}
            onUpdateDialogue={updateDialogue}
          />
        ) : null}
        {page === "practice" ? (
          <PracticePage
            savedDialogues={savedDialogues}
            onRecord={recordPractice}
            videos={videos}
            prompt={prompt}
          />
        ) : null}
        {page === "graph" ? (
          <GraphPage
            savedDialogues={savedDialogues}
            scores={scores}
            onUpdateDialogue={updateDialogue}
            onDeleteDialogue={deleteDialogue}
          />
        ) : null}
      </section>
    </main>
  );
}

function SideNav({ page, onPage, savedCount }: { page: Page; onPage: (page: Page) => void; savedCount: number }) {
  const items: { page: Page; label: string; icon: React.ReactNode }[] = [
    { page: "home", label: "Home", icon: <Home size={21} /> },
    { page: "watch", label: "Watch", icon: <Video size={21} /> },
    { page: "practice", label: "Practice", icon: <Dumbbell size={21} /> },
    { page: "graph", label: "Library", icon: <BarChart3 size={21} /> }
  ];

  return (
    <aside className="side-nav">
      <div className="duo-brand">
        <div className="owl">D</div>
        <div>
          <strong>DialogDungeon</strong>
          <span>Duolingo mode</span>
        </div>
      </div>
      <nav>
        {items.map((item) => (
          <button
            key={item.page}
            className={page === item.page ? "active" : ""}
            onClick={() => onPage(item.page)}
          >
            {item.icon}
            {item.label}
          </button>
        ))}
      </nav>
      <div className="streak-card">
        <Flame size={24} />
        <strong>{savedCount}</strong>
        <span>saved lines</span>
      </div>
    </aside>
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
          <span>
            Import YouLearn spaces, save hard dialogues, and drill five lines daily with spaced
            repetition.
          </span>
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
          <div className="face" />
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
  setVideos,
  savedDialogues,
  onSaveDialogue,
  prompt,
  setPrompt,
  onUpdateDialogue
}: {
  videos: SpaceVideo[];
  setVideos: React.Dispatch<React.SetStateAction<SpaceVideo[]>>;
  savedDialogues: SavedDialogue[];
  onSaveDialogue: (video: SpaceVideo, segment: TranscriptSegment) => void;
  prompt: string;
  setPrompt: (prompt: string) => void;
  onUpdateDialogue: (dialogue: SavedDialogue) => void;
}) {
  const [spaceUrl, setSpaceUrl] = React.useState("https://app.youlearn.ai/space/c9241bc0721046c8");
  const [activeVideoId, setActiveVideoId] = React.useState(videos[0]?.id ?? "");
  const [currentTime, setCurrentTime] = React.useState(0);
  const [loading, setLoading] = React.useState(false);
  const [status, setStatus] = React.useState("");
  const [customTranscript, setCustomTranscript] = React.useState("");
  const [selectedDialogueId, setSelectedDialogueId] = React.useState(savedDialogues[0]?.id ?? "");
  const [processingId, setProcessingId] = React.useState("");

  const activeVideo = videos.find((video) => video.id === activeVideoId) ?? videos[0] ?? fallbackVideos[0];
  const activeSegment =
    activeVideo.transcript
      .slice()
      .reverse()
      .find((segment) => segment.startTime <= currentTime) ?? activeVideo.transcript[0];

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
      const imported = Array.isArray(data.contents) && data.contents.length ? data.contents : fallbackVideos;
      setVideos(imported);
      setActiveVideoId(imported[0]?.id ?? "");
      setStatus(`Imported ${imported.length} video(s).`);
    } catch (error) {
      setVideos(fallbackVideos);
      setActiveVideoId(fallbackVideos[0].id);
      setStatus(error instanceof Error ? `${error.message}. Demo videos loaded.` : "Demo videos loaded.");
    } finally {
      setLoading(false);
    }
  }

  function applyCustomTranscript() {
    const segments = customTranscript
      .split(/\r?\n/)
      .map((line, index) => {
        const match = line.match(/^(?:(\d+(?:\.\d+)?)\s*[-:]\s*)?(.*)$/);
        return {
          id: `custom-${Date.now()}-${index}`,
          startTime: Number(match?.[1] ?? index * 6),
          text: (match?.[2] ?? line).trim(),
          custom: true
        };
      })
      .filter((segment) => segment.text);
    if (!segments.length) return;
    setVideos((current) =>
      current.map((video) => (video.id === activeVideo.id ? { ...video, transcript: segments } : video))
    );
    setStatus("Custom transcript applied.");
  }

  async function processDialogue(dialogue: SavedDialogue, mode: "Hinglish" | "English") {
    setProcessingId(dialogue.id);
    try {
      const response = await fetch("/api/dialogue-transform", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dialogue: dialogue.text, prompt, mode })
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
    <div className="watch-grid">
      <section className="space-import">
        <div>
          <h1>Watch</h1>
          <p>Add a public YouLearn space, play movie videos, and save exact dialogues.</p>
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

      <section className="video-list">
        <h2>Space videos</h2>
        {videos.map((video) => (
          <button
            key={video.id}
            className={video.id === activeVideo.id ? "active" : ""}
            onClick={() => setActiveVideoId(video.id)}
          >
            <div className="thumb">{video.thumbnailUrl ? <img src={video.thumbnailUrl} alt="" /> : <Film />}</div>
            <span>{video.title}</span>
            <small>{Math.round(video.duration || 0)}s</small>
          </button>
        ))}
      </section>

      <section className="player-card">
        {activeVideo.contentUrl ? (
          <video
            src={activeVideo.contentUrl}
            controls
            poster={activeVideo.thumbnailUrl}
            onTimeUpdate={(event) => setCurrentTime(event.currentTarget.currentTime)}
          />
        ) : (
          <div className="video-placeholder">
            <Play size={42} />
            <strong>{activeVideo.title}</strong>
            <span>Demo clip shell. Import a YouLearn space for playable video.</span>
          </div>
        )}
        <div className="subtitle-card">
          <Languages size={22} />
          <p>{activeSegment?.text ?? "Transcript line appears here while video plays."}</p>
          <button onClick={() => activeSegment && onSaveDialogue(activeVideo, activeSegment)}>
            <Save size={16} /> Save Dialogue
          </button>
        </div>
      </section>

      <section className="transcript-card">
        <div className="section-head">
          <h2>Dialogues</h2>
          <span>{activeVideo.transcript.length} lines</span>
        </div>
        <div className="transcript-list">
          {activeVideo.transcript.map((segment) => (
            <button
              key={segment.id}
              className={segment.id === activeSegment?.id ? "active" : ""}
              onClick={() => {
                setCurrentTime(segment.startTime);
                onSaveDialogue(activeVideo, segment);
              }}
            >
              <small>{formatTime(segment.startTime)}</small>
              <span>{segment.text}</span>
            </button>
          ))}
        </div>
      </section>

      <section className="custom-card">
        <h2>Custom transcript</h2>
        <textarea
          value={customTranscript}
          onChange={(event) => setCustomTranscript(event.target.value)}
          placeholder="0 - Dialogue one&#10;8 - Dialogue two&#10;15 - Dialogue three"
        />
        <button onClick={applyCustomTranscript}>
          <ClipboardEdit size={16} /> Use custom transcript
        </button>
      </section>

      <section className="prompt-card">
        <h2>Dialogue prompt</h2>
        <textarea value={prompt} onChange={(event) => setPrompt(event.target.value)} />
        <select value={selectedDialogueId} onChange={(event) => setSelectedDialogueId(event.target.value)}>
          <option value="">Select saved dialogue</option>
          {savedDialogues.map((dialogue) => (
            <option key={dialogue.id} value={dialogue.id}>
              {dialogue.text.slice(0, 70)}
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
  prompt
}: {
  savedDialogues: SavedDialogue[];
  onRecord: (score: number, dialogue: SavedDialogue) => void;
  videos: SpaceVideo[];
  prompt: string;
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
        body: JSON.stringify({ dialogue: active.text, answer, prompt })
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
        <div className="duo-mascot small">
          <div className="face" />
        </div>
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
          {video?.contentUrl ? <video src={video.contentUrl} controls /> : <Film size={52} />}
          <div className="hinglish-subtitle">{active.hinglish || active.promptResult || toHinglishHint(active.text)}</div>
        </div>
        <textarea
          value={answer}
          onChange={(event) => setAnswer(event.target.value)}
          placeholder="Type the English version..."
        />
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
          <p>Submit your translation to get scored. Correct lines move down to lower priority sets.</p>
        )}
      </section>
    </div>
  );
}

function GraphPage({
  savedDialogues,
  scores,
  onUpdateDialogue,
  onDeleteDialogue
}: {
  savedDialogues: SavedDialogue[];
  scores: DailyScore[];
  onUpdateDialogue: (dialogue: SavedDialogue) => void;
  onDeleteDialogue: (id: string) => void;
}) {
  const [editingId, setEditingId] = React.useState("");
  const [draftText, setDraftText] = React.useState("");
  const buckets = [1, 2, 3, 4, 5].map((bucket) => ({
    bucket,
    count: savedDialogues.filter((item) => item.bucket === bucket).length
  }));
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
            <div className="saved-dialogue-row" key={dialogue.id}>
              <div>
                <small>{dialogue.videoTitle} - Set {dialogue.bucket}</small>
                {editingId === dialogue.id ? (
                  <input value={draftText} onChange={(event) => setDraftText(event.target.value)} />
                ) : (
                  <strong>{dialogue.text}</strong>
                )}
                {dialogue.hinglish || dialogue.english ? (
                  <span>{dialogue.hinglish || dialogue.english}</span>
                ) : null}
              </div>
              <div className="row-actions">
                {editingId === dialogue.id ? (
                  <button
                    onClick={() => {
                      onUpdateDialogue({ ...dialogue, text: draftText.trim() || dialogue.text });
                      setEditingId("");
                    }}
                  >
                    <Save size={16} />
                  </button>
                ) : (
                  <button
                    onClick={() => {
                      setEditingId(dialogue.id);
                      setDraftText(dialogue.text);
                    }}
                  >
                    <ClipboardEdit size={16} />
                  </button>
                )}
                <button className="danger" onClick={() => onDeleteDialogue(dialogue.id)}>
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>
      <section className="progress-card">
        <h2>Daily scores</h2>
        {scores.slice(0, 8).map((score) => (
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

function formatTime(seconds: number) {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${String(secs).padStart(2, "0")}`;
}

function toHinglishHint(text: string) {
  return `Hinglish hint: "${text}" ko natural English mein likho.`;
}

ReactDOM.createRoot(document.getElementById("root")!).render(<App />);
