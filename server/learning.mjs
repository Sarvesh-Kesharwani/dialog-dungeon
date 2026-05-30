export async function getScenePayload(body = {}) {
  const { movie, scene, language = "Hinglish" } = body;

  if (!movie || !scene) {
    return { status: 400, body: { error: "movie and scene are required" } };
  }

  try {
    const webContext = await fetchSceneContext(movie, scene);
    const prompt = [
      "You are a Hindi/Hinglish English-learning tutor.",
      "Use public web context when useful. Do not invent exact dialogues.",
      `Movie: ${movie}`,
      `Scene: ${scene}`,
      `Output language: ${language}`,
      `Web context: ${webContext || "No reliable web context found."}`,
      "Return JSON only with keys: title, paragraph, sceneBeats, toneWords.",
      "paragraph should explain the scene in natural Hindi or Hinglish for a learner to translate into English."
    ].join("\n");

    const data = await callDeepSeekJson(prompt, 900);
    return {
      status: 200,
      body: normalizeScene(data, movie, scene, language, webContext)
    };
  } catch (error) {
    console.error("Scene generation failed", error);
    return { status: 200, body: fallbackScene(movie, scene, language) };
  }
}

export async function getReviewPayload(body = {}) {
  const { movie, scene, sourceParagraph, userTranslation } = body;

  if (!movie || !scene || !sourceParagraph || !userTranslation) {
    return {
      status: 400,
      body: {
        error: "movie, scene, sourceParagraph, and userTranslation are required"
      }
    };
  }

  try {
    const prompt = [
      "You are an English coach for Hindi/Hinglish speakers.",
      "Review the user's English translation of a movie-scene paragraph.",
      `Movie: ${movie}`,
      `Scene: ${scene}`,
      `Hindi/Hinglish source paragraph: ${sourceParagraph}`,
      `User English translation: ${userTranslation}`,
      "Find precise learnable issues. Save context with every issue.",
      "Return JSON only:",
      "{",
      '  "overall": "short supportive review",',
      '  "improvedTranslation": "better natural English version",',
      '  "mistakes": [',
      "    {",
      '      "type": "Vocabulary|Phrase|Proverb|Article|Grammar",',
      '      "label": "short issue title",',
      '      "userText": "exact user fragment",',
      '      "suggestion": "better wording",',
      '      "why": "short Hindi/Hinglish explanation",',
      '      "memoryCue": "tiny revision cue"',
      "    }",
      "  ]",
      "}"
    ].join("\n");

    const data = await callDeepSeekJson(prompt, 1200);
    return {
      status: 200,
      body: normalizeReview(data, movie, scene, sourceParagraph, userTranslation)
    };
  } catch (error) {
    console.error("Review failed", error);
    return {
      status: 200,
      body: fallbackReview(movie, scene, sourceParagraph, userTranslation)
    };
  }
}

export async function getYoulearnSpacePayload(query = {}) {
  const spaceId = String(query.spaceId || "").trim();
  if (!/^[A-Za-z0-9_-]{8,}$/.test(spaceId)) {
    return { status: 400, body: { error: "Valid YouLearn space id is required" } };
  }

  try {
    const response = await fetch(`https://api.youlearn.ai/space/anonymous/${spaceId}`, {
      headers: {
        Accept: "application/json",
        "User-Agent": "DialogDungeon/0.2 local learning app"
      }
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`YouLearn space ${response.status}: ${text.slice(0, 300)}`);
    }

    const payload = await response.json();
    const rawContents = Array.isArray(payload?.contents) ? payload.contents : [];
    const folderLookup = buildYoulearnFolderLookup(payload?.space_content_maps);
    const videoItems = rawContents.filter((item) => item?.content_url || item?.url);
    const contents = await Promise.all(
      videoItems.map((item) => normalizeYoulearnVideo({ ...item, ...folderLookup.get(String(item?.content_id || item?._id || item?.id)) }))
    );

    return {
      status: 200,
      body: {
        space: {
          id: String(payload?.space?._id || payload?.space?.id || spaceId),
          title: String(payload?.space?.title || payload?.space?.name || "YouLearn Space")
        },
        folders: Array.from(new Map(Array.from(folderLookup.values()).map((folder) => [folder.folderId, folder])).values()),
        contents
      }
    };
  } catch (error) {
    console.error("YouLearn import failed", error);
    return { status: 502, body: { error: error instanceof Error ? error.message : "YouLearn import failed" } };
  }
}

export async function getDialogueTransformPayload(body = {}) {
  const { dialogue, prompt, mode = "Hinglish" } = body;
  if (!dialogue) {
    return { status: 400, body: { error: "dialogue is required" } };
  }

  try {
    const data = await callDeepSeekJson(
      [
        "You are a movie-dialogue language tutor for Hindi/Hinglish speakers.",
        `Mode: ${mode}`,
        `User prompt/rule: ${prompt || "Translate and explain naturally."}`,
        `Dialogue: ${dialogue}`,
        "Return JSON only with keys: result, english, hinglish, notes.",
        "Keep result short, useful, and learner-friendly."
      ].join("\n"),
      800
    );

    return {
      status: 200,
      body: {
        result: String(data?.result || data?.hinglish || data?.english || ""),
        english: String(data?.english || ""),
        hinglish: String(data?.hinglish || ""),
        notes: String(data?.notes || "")
      }
    };
  } catch (error) {
    console.error("Dialogue transform failed", error);
    return { status: 200, body: fallbackDialogueTransform(dialogue, mode) };
  }
}

export async function getDialogueFilterPayload(body = {}) {
  const prompt = String(body.prompt || "").trim();
  const transcript = normalizeFilterTranscript(body.transcript);

  if (!transcript.length) {
    return { status: 400, body: { error: "transcript is required" } };
  }

  try {
    const data = await callDeepSeekJson(
      [
        "You are filtering movie transcript lines for an English-learning app.",
        "Only include lines that satisfy the user's filter prompt.",
        `Filter prompt: ${prompt || "Include meaningful dialogue lines. Exclude filler/noise."}`,
        "Transcript lines:",
        JSON.stringify(transcript.map(({ id, startTime, text }) => ({ id, startTime, text })).slice(0, 220)),
        "Return JSON only with keys: includedIds, reason.",
        "includedIds must be an array of ids copied exactly from the transcript. Do not return text."
      ].join("\n"),
      1200
    );

    const validIds = new Set(transcript.map((segment) => segment.id));
    const includedIds = Array.isArray(data?.includedIds)
      ? data.includedIds.map(String).filter((id) => validIds.has(id))
      : [];

    return {
      status: 200,
      body: {
        includedIds,
        reason: String(data?.reason || "")
      }
    };
  } catch (error) {
    console.error("Dialogue filter failed", error);
    return {
      status: 200,
      body: fallbackDialogueFilter(transcript, prompt)
    };
  }
}

export async function getDialogueLifeExamplesPayload(body = {}) {
  const dialogue = String(body.dialogue || "").trim();
  const userLifeContext = String(body.userLifeContext || "").trim();
  const notionContextUrl = String(body.notionContextUrl || "").trim();

  if (!dialogue) {
    return { status: 400, body: { error: "dialogue is required" } };
  }

  // Fetch Notion page content if a URL is provided
  let notionContext = "";
  if (notionContextUrl) {
    notionContext = await fetchNotionPageText(notionContextUrl);
  }

  const combinedContext = [
    userLifeContext,
    notionContext ? `Notion page about user: ${notionContext}` : ""
  ].filter(Boolean).join("\n\n");

  try {
    const data = await callDeepSeekJson(
      [
        "You are an English-learning coach for a Hindi/Hinglish speaker.",
        "Your goal: help the user understand how to USE a movie phrase in their OWN real life.",
        "",
        "STEP 1 — Deconstruct the phrase:",
        `  Phrase: "${dialogue}"`,
        "  Identify the underlying pattern/structure (e.g. 'ease off the X' = reduce/stop doing X gradually).",
        "  Ignore the specific subject (booze, drugs, etc.) — focus on the transferable pattern.",
        "",
        "STEP 2 — Map to user's actual life:",
        `  User context: ${combinedContext || "No personal context provided. Use general daily life activities like work, study, phone use, social media, sleep, etc."}`,
        "  Pick 3 real situations from the user's life where the SAME pattern applies.",
        "  Substitute the original subject with something from the user's actual life.",
        "  Example: 'ease off the booze' → 'ease off the doomscrolling a little' or 'ease off the late-night coding sessions'.",
        "",
        "STEP 3 — Write 3 short example sentences:",
        "  Each sentence should be a natural English sentence the user could actually say.",
        "  Format: just the sentence itself, no explanation.",
        "  Keep each sentence under 12 words.",
        "",
        "Return JSON only with key: examples.",
        "examples must be an array of exactly 3 strings (the sentences from STEP 3)."
      ].join("\n"),
      900
    );
    const examples = Array.isArray(data?.examples)
      ? data.examples.map(String).filter(Boolean).slice(0, 3)
      : [];

    return {
      status: 200,
      body: {
        examples: examples.length ? examples : fallbackLifeExamples(dialogue),
        source: "deepseek"
      }
    };
  } catch (error) {
    console.error("Life examples failed", error);
    return {
      status: 200,
      body: {
        examples: fallbackLifeExamples(dialogue),
        source: "fallback"
      }
    };
  }
}

export async function getYoulearnChatPayload(body = {}) {
  const { dialogue, videoTitle, contentId, videoId, spaceId, startTime, transcript = [], provider } = body;
  const selectedDialogue = String(dialogue || "").trim();
  const selectedContentId = String(contentId || videoId || "").trim();
  const selectedSpaceId = String(spaceId || process.env.YOULEARN_SPACE_ID || "").trim();
  const deepseekMode = normalizeProvider(provider) === "deepseek";

  if (!selectedDialogue) {
    return { status: 400, body: { error: "dialogue is required" } };
  }

  try {
    const query = [
      "Use the current YouLearn video/content context.",
      "Translate this dialogue into natural Hinglish for a Hindi speaker learning English.",
      "Also give one short meaning note. Keep answer concise.",
      videoTitle ? `Video: ${videoTitle}` : "",
      Number.isFinite(Number(startTime)) ? `Timestamp: ${formatClock(Number(startTime))}` : "",
      `Dialogue: ${selectedDialogue}`,
      buildTranscriptContext(transcript, Number(startTime))
    ]
      .filter(Boolean)
      .join("\n");

    const answer = deepseekMode
      ? await askDeepSeekText(query)
      : await askYoulearnChat({
          query,
          contentId: selectedContentId,
          spaceId: selectedSpaceId
        });

    return {
      status: 200,
      body: {
        result: answer,
        hinglish: answer,
        notes: deepseekMode ? "Fetched from DeepSeek mode." : "Fetched from YouLearn chat.",
        source: deepseekMode ? "deepseek" : "youlearn"
      }
    };
  } catch (error) {
    console.error(deepseekMode ? "DeepSeek dialogue failed" : "YouLearn chat failed", error);
    return {
      status: 502,
      body: {
        error: error instanceof Error ? error.message : deepseekMode ? "DeepSeek dialogue failed" : "YouLearn chat failed",
        source: deepseekMode ? "deepseek" : "youlearn"
      }
    };
  }
}

export async function getPracticeGradePayload(body = {}) {
  const { dialogue, answer, prompt } = body;
  if (!dialogue || !answer) {
    return { status: 400, body: { error: "dialogue and answer are required" } };
  }

  try {
    const data = await callDeepSeekJson(
      [
        "You are an English translation examiner for Hindi/Hinglish speakers.",
        `Tutor prompt/context: ${prompt || "Grade for natural English meaning."}`,
        `Source dialogue/context: ${dialogue}`,
        `Learner English answer: ${answer}`,
        "Score meaning accuracy, grammar, naturalness, and word choice.",
        "Return JSON only with keys: score, feedback, expected.",
        "score must be integer 0-100. feedback must be short Hinglish."
      ].join("\n"),
      700
    );

    return {
      status: 200,
      body: {
        score: clampScore(data?.score),
        feedback: String(data?.feedback || "Checked."),
        expected: String(data?.expected || dialogue)
      }
    };
  } catch (error) {
    console.error("Practice grade failed", error);
    return { status: 200, body: fallbackPracticeGrade(dialogue, answer) };
  }
}

export async function getSyncPayload(query = {}) {
  const clientId = normalizeClientId(query.clientId);
  if (!clientId) return { status: 400, body: { error: "clientId is required" } };

  const config = supabaseConfig();
  if (!config) return { status: 200, body: { state: null, updatedAt: null, source: "local-only" } };

  try {
    const response = await fetch(
      `${config.url}/rest/v1/app_state?client_id=eq.${encodeURIComponent(clientId)}&select=state,updated_at`,
      { headers: supabaseHeaders(config.key, clientId), cache: "no-store" }
    );
    if (!response.ok) throw new Error(await response.text());
    const rows = await response.json();
    return {
      status: 200,
      body: {
        state: rows?.[0]?.state ?? null,
        updatedAt: rows?.[0]?.updated_at ?? null,
        source: "supabase"
      }
    };
  } catch (error) {
    console.error("Sync load failed", error);
    return { status: 200, body: { state: null, updatedAt: null, source: "local-only" } };
  }
}

export async function saveSyncPayload(body = {}) {
  const clientId = normalizeClientId(body.clientId);
  if (!clientId || !body.state || typeof body.state !== "object") {
    return { status: 400, body: { error: "clientId and state are required" } };
  }

  const config = supabaseConfig();
  if (!config) return { status: 200, body: { ok: false, source: "local-only" } };

  try {
    const updatedAt = new Date().toISOString();
    const response = await fetch(`${config.url}/rest/v1/app_state?on_conflict=client_id`, {
      method: "POST",
      headers: {
        ...supabaseHeaders(config.key, clientId),
        "Content-Type": "application/json",
        "Content-Profile": "dialog_dungeon",
        Prefer: "resolution=merge-duplicates,return=representation"
      },
      body: JSON.stringify({ client_id: clientId, state: body.state, updated_at: updatedAt })
    });
    if (!response.ok) throw new Error(await response.text());
    return { status: 200, body: { ok: true, updatedAt, source: "supabase" } };
  } catch (error) {
    console.error("Sync save failed", error);
    return { status: 200, body: { ok: false, source: "local-only" } };
  }
}

async function callDeepSeekJson(prompt, maxTokens) {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) {
    throw new Error("DEEPSEEK_API_KEY missing");
  }

  const response = await fetch("https://api.deepseek.com/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: process.env.DEEPSEEK_MODEL || "deepseek-v4-flash",
      messages: [{ role: "user", content: prompt }],
      response_format: { type: "json_object" },
      temperature: 0.4,
      max_tokens: maxTokens
    })
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`DeepSeek ${response.status}: ${text.slice(0, 500)}`);
  }

  const payload = await response.json();
  const content = payload?.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error("DeepSeek returned empty content");
  }
  return JSON.parse(content);
}

async function askDeepSeekText(prompt) {
  const data = await callDeepSeekJson(
    [
      prompt,
      "Return JSON only with keys: result, hinglish, notes.",
      "result should be the final concise answer."
    ].join("\n"),
    900
  );
  return String(data?.hinglish || data?.result || data?.notes || "").trim();
}

function normalizeProvider(value) {
  return value === "deepseek" ? "deepseek" : "youlearn";
}

async function askYoulearnChat({ query, contentId, spaceId }) {
  const cookie = process.env.YOULEARN_AUTH_COOKIE || process.env.YOULEARN_COOKIE || "";
  const userId = process.env.YOULEARN_USER_ID || "anonymous";
  const conversationId = await createYoulearnConversation({ userId, contentId, spaceId, cookie });
  const response = await fetch("https://api.youlearn.ai/generation/chat", {
    method: "POST",
    headers: youlearnChatHeaders(cookie),
    body: JSON.stringify({
      user_id: userId,
      space_id: spaceId || undefined,
      conversation_id: conversationId,
      content_id: contentId || undefined,
      query,
      agent: false,
      web_search: false,
      use_advanced_search: false
    })
  });

  if (!response.ok) {
    const text = await response.text();
    if (response.status === 401) {
      throw new Error("YouLearn chat needs signed-in session. Add YOULEARN_AUTH_COOKIE and YOULEARN_USER_ID, or allow fallback first.");
    }
    throw new Error(`YouLearn chat ${response.status}: ${text.slice(0, 500)}`);
  }

  return readYoulearnChatStream(await response.text());
}

async function createYoulearnConversation({ userId, contentId, spaceId, cookie }) {
  const response = await fetch("https://api.youlearn.ai/generation/chat/conversations", {
    method: "POST",
    headers: youlearnChatHeaders(cookie),
    body: JSON.stringify({
      user_id: userId,
      content_id: contentId || undefined,
      space_id: spaceId || undefined
    })
  });

  if (!response.ok) {
    const text = await response.text();
    if (response.status === 401) {
      throw new Error("YouLearn chat needs signed-in session. Add YOULEARN_AUTH_COOKIE and YOULEARN_USER_ID, or allow fallback first.");
    }
    throw new Error(`YouLearn conversation ${response.status}: ${text.slice(0, 500)}`);
  }

  const payload = await response.json();
  const conversationId =
    payload?.conversation?._id ||
    payload?.conversation?.id ||
    payload?._id ||
    payload?.id ||
    payload?.conversation_id;

  if (!conversationId) {
    throw new Error("YouLearn did not return a conversation id.");
  }

  return String(conversationId);
}

function youlearnChatHeaders(cookie) {
  return {
    Accept: "application/json, text/plain, */*",
    "Content-Type": "application/json",
    Origin: "https://app.youlearn.ai",
    Referer: "https://app.youlearn.ai/",
    "x-platform": "web",
    "User-Agent": "DialogDungeon/0.2 local learning app",
    ...(cookie ? { Cookie: cookie } : {})
  };
}

function readYoulearnChatStream(text) {
  const chunks = [];
  for (const part of splitJsonStream(text)) {
    if (!part || part.type === "error") continue;
    const value = String(part.delta || part.content || part.message || "");
    if (value && value !== "done") chunks.push(value);
  }
  const answer = chunks.join("").trim();
  if (!answer) throw new Error("YouLearn returned empty chat response.");
  return answer;
}

function splitJsonStream(text) {
  const normalized = String(text || "").trim();
  if (!normalized) return [];
  try {
    return [JSON.parse(normalized)];
  } catch {
    return normalized
      .replace(/}\s*{/g, "}\n{")
      .split(/\n+/)
      .map((line) => {
        try {
          return JSON.parse(line);
        } catch {
          return null;
        }
      })
      .filter(Boolean);
  }
}

function buildTranscriptContext(transcript, startTime) {
  if (!Array.isArray(transcript) || !transcript.length) return "";
  const time = Number.isFinite(startTime) ? startTime : 0;
  const context = transcript
    .filter((segment) => Math.abs(Number(segment?.startTime || 0) - time) <= 45)
    .slice(0, 8)
    .map((segment) => String(segment?.text || "").trim())
    .filter(Boolean)
    .join(" ");
  return context ? `Nearby transcript context: ${context}` : "";
}

function formatClock(seconds) {
  const total = Math.max(0, Math.floor(seconds));
  const mins = Math.floor(total / 60);
  const secs = total % 60;
  return `${mins}:${String(secs).padStart(2, "0")}`;
}

async function normalizeYoulearnVideo(item) {
  const id = String(item?.content_id || item?._id || item?.id || `video-${Date.now()}-${Math.random()}`);
  const transcript = await fetchYoulearnTranscript(id);
  const duration = Number(item?.length || item?.duration || item?.metadata?.duration || 0);

  return {
    id,
    title: String(item?.title || item?.name || "Untitled video"),
    contentUrl: String(item?.content_url || item?.url || ""),
    thumbnailUrl: String(item?.thumbnail_url || item?.thumbnail || ""),
    duration: Number.isFinite(duration) ? duration : 0,
    sourceType: String(item?.type || "video"),
    folderId: String(item?.folderId || ""),
    folderName: String(item?.folderName || ""),
    importSource: "youlearn",
    transcript
  };
}

async function fetchYoulearnTranscript(contentId) {
  if (!contentId) return [];

  try {
    const response = await fetch("https://api.youlearn.ai/content/transcript", {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        Referer: "https://app.youlearn.ai/",
        "x-platform": "web",
        "User-Agent": "DialogDungeon/0.2 local learning app"
      },
      body: JSON.stringify({ user_id: "anonymous", content_id: contentId })
    });

    if (!response.ok) return [];
    const payload = await response.json();
    const chunks = Array.isArray(payload) ? payload : Array.isArray(payload?.transcript) ? payload.transcript : [];

    return chunks
      .map((chunk, index) => ({
        id: `${contentId}-${index}`,
        startTime: Number(chunk?.source ?? chunk?.start ?? chunk?.startTime ?? index * 5),
        text: String(chunk?.page_content || chunk?.text || "").trim()
      }))
      .filter((chunk) => chunk.text)
      .sort((a, b) => a.startTime - b.startTime);
  } catch (error) {
    console.error("YouLearn transcript failed", error);
    return [];
  }
}

function clampScore(value) {
  const score = Number(value);
  if (!Number.isFinite(score)) return 0;
  return Math.max(0, Math.min(100, Math.round(score)));
}

function fallbackDialogueTransform(dialogue, mode) {
  const text = String(dialogue || "");
  const hinglish = `Hinglish: is dialogue ka matlab hai - "${text}" - scene mein emotion aur intent ko simple words mein samjho.`;
  const english = `Natural English: ${text}`;
  return {
    result: String(mode).toLowerCase().includes("english") ? english : hinglish,
    english,
    hinglish,
    notes: "Fallback used because DeepSeek is not configured."
  };
}

function fallbackLifeExamples(dialogue) {
  const text = String(dialogue || "this phrase");
  return [
    `Use it when a friend asks for your honest reaction and this phrase matches what you want to say: "${text}".`,
    `Use it at work or study when a similar situation comes up and you need a short, natural English line.`,
    `Use it in a daily conversation when you want to express the same feeling without making the sentence too formal.`
  ];
}

function normalizeFilterTranscript(value) {
  if (!Array.isArray(value)) return [];
  return value
    .map((segment, index) => ({
      id: String(segment?.id || `line-${index}`),
      startTime: Number(segment?.startTime || 0),
      text: String(segment?.text || "").trim()
    }))
    .filter((segment) => segment.id && segment.text);
}

function fallbackDialogueFilter(transcript, prompt) {
  const promptText = String(prompt || "").toLowerCase();
  const wantsShort = /\b(short|small|tiny|brief|one[-\s]?word)\b/.test(promptText);
  const wantsQuestion = /\b(question|questions|ask|asking)\b/.test(promptText);
  const wantsEmotion = /\b(emotion|emotional|angry|sad|happy|fear|sorry|please)\b/.test(promptText);
  const wantsLegal = /\b(legal|court|crime|police|case|bail|evidence|judge|law)\b/.test(promptText);
  const fillerWords = new Set(["ok", "okay", "yes", "no", "yeah", "hmm", "uh", "um", "please", "sorry"]);

  const includedIds = transcript
    .filter((segment) => {
      const text = segment.text.trim();
      const lower = text.toLowerCase();
      const words = lower.match(/[a-z0-9']+/g) || [];
      const uniqueWords = new Set(words);
      const hasSubstance = words.length >= 3 && uniqueWords.size >= Math.min(words.length, 3);
      if (wantsShort && words.length > 4) return false;
      if (wantsQuestion && !text.includes("?")) return false;
      if (wantsEmotion && !/(sorry|please|love|hate|afraid|angry|happy|sad|witnessed|hope|need)/i.test(text)) return false;
      if (wantsLegal && !/(case|rape|murder|stabbing|crime|bail|evidence|court|police|law|report|witness)/i.test(text)) return false;
      if (words.length <= 2 && words.every((word) => fillerWords.has(word))) return false;
      return hasSubstance || wantsShort || wantsQuestion || wantsEmotion || wantsLegal;
    })
    .map((segment) => segment.id);

  return {
    includedIds,
    reason: "Fallback filter used because AI filtering is not configured."
  };
}

function fallbackPracticeGrade(dialogue, answer) {
  const sourceTokens = tokenize(dialogue);
  const answerTokens = Array.from(tokenize(answer));
  const overlap = answerTokens.filter((token) => sourceTokens.has(token)).length;
  const score = Math.max(35, Math.min(92, Math.round((overlap / Math.max(1, sourceTokens.size)) * 100)));
  return {
    score,
    feedback: score >= 80 ? "Meaning match ho raha hai. Good natural attempt." : "Meaning thoda miss hua. Key words aur structure improve karo.",
    expected: String(dialogue)
  };
}

function tokenize(value) {
  return new Set(
    String(value || "")
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .filter((token) => token.length > 2)
  );
}

function buildYoulearnFolderLookup(spaceContentMaps) {
  const lookup = new Map();
  const folderNames = new Map();
  let folderNumber = 1;
  for (const item of Array.isArray(spaceContentMaps) ? spaceContentMaps : []) {
    const contentId = String(item?.content?.id || "");
    const folderId = String(item?.folder?.id || "");
    if (!contentId || !folderId) continue;
    if (!folderNames.has(folderId)) {
      folderNames.set(folderId, `YouLearn Folder ${folderNumber}`);
      folderNumber += 1;
    }
    lookup.set(contentId, {
      folderId,
      folderName: folderNames.get(folderId),
      youlearnIndex: Number(item?.idx || 0)
    });
  }
  return lookup;
}

function supabaseConfig() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) return null;
  return { url: url.replace(/\/$/, ""), key };
}

function supabaseHeaders(key, clientId) {
  return {
    apikey: key,
    Authorization: `Bearer ${key}`,
    "Accept-Profile": "dialog_dungeon",
    "x-ddungeon-client-id": clientId
  };
}

function normalizeClientId(value) {
  const clientId = String(value || "").trim();
  return /^[A-Za-z0-9_-]{12,80}$/.test(clientId) ? clientId : "";
}

async function fetchNotionPageText(url) {
  try {
    // Notion public pages are readable as HTML — fetch and strip tags
    const response = await fetch(url, {
      headers: {
        "User-Agent": "DialogDungeon/0.2 learning app",
        Accept: "text/html"
      },
      signal: AbortSignal.timeout(6000)
    });
    if (!response.ok) return "";
    const html = await response.text();
    // Strip script/style blocks, then all tags, then collapse whitespace
    const text = html
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/&nbsp;/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/\s{2,}/g, " ")
      .trim();
    // Return first 2000 chars to stay within token budget
    return text.slice(0, 2000);
  } catch {
    return "";
  }
}

async function fetchSceneContext(movie, scene) {
  const searchUrl = new URL("https://en.wikipedia.org/w/api.php");
  searchUrl.search = new URLSearchParams({
    action: "query",
    list: "search",
    srsearch: `${movie} ${scene}`,
    format: "json",
    origin: "*",
    srlimit: "1"
  }).toString();

  const searchResponse = await fetch(searchUrl, {
    headers: { "User-Agent": "DialogDungeon/0.1 local learning app" }
  });
  if (!searchResponse.ok) return "";
  const searchPayload = await searchResponse.json();
  const title = searchPayload?.query?.search?.[0]?.title;
  if (!title) return "";

  const summaryUrl = new URL(
    `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`
  );
  const summaryResponse = await fetch(summaryUrl, {
    headers: { "User-Agent": "DialogDungeon/0.1 local learning app" }
  });
  if (!summaryResponse.ok) return "";
  const summaryPayload = await summaryResponse.json();
  return [summaryPayload.title, summaryPayload.extract].filter(Boolean).join(": ");
}

function normalizeScene(data, movie, scene, language, webContext) {
  return {
    movie,
    scene,
    title: String(data?.title || `${movie}: ${scene}`),
    paragraph: String(data?.paragraph || fallbackScene(movie, scene, language).paragraph),
    sceneBeats: Array.isArray(data?.sceneBeats)
      ? data.sceneBeats.slice(0, 4).map(String)
      : fallbackScene(movie, scene, language).sceneBeats,
    toneWords: Array.isArray(data?.toneWords)
      ? data.toneWords.slice(0, 6).map(String)
      : ["tense", "emotional", "decisive"],
    webContextUsed: Boolean(webContext)
  };
}

function normalizeReview(data, movie, scene, sourceParagraph, userTranslation) {
  const mistakes = Array.isArray(data?.mistakes)
    ? data.mistakes
    : fallbackReview(movie, scene, sourceParagraph, userTranslation).mistakes;

  return {
    movie,
    scene,
    sourceParagraph,
    userTranslation,
    overall: String(data?.overall || "Good attempt. A few phrases can sound more natural."),
    improvedTranslation: String(data?.improvedTranslation || userTranslation),
    mistakes: mistakes.slice(0, 8).map((item, index) => ({
      id: `${Date.now()}-${index}`,
      type: normalizeType(item?.type),
      label: String(item?.label || "Better wording"),
      userText: String(item?.userText || ""),
      suggestion: String(item?.suggestion || ""),
      why: String(item?.why || ""),
      memoryCue: String(item?.memoryCue || "")
    }))
  };
}

function normalizeType(type) {
  const value = String(type || "Grammar").toLowerCase();
  if (value.includes("vocab")) return "Vocabulary";
  if (value.includes("phrase")) return "Phrase";
  if (value.includes("proverb")) return "Proverb";
  if (value.includes("article")) return "Article";
  return "Grammar";
}

function fallbackScene(movie, scene, language) {
  const paragraph =
    language === "Hindi"
      ? `${movie} ke "${scene}" scene mein character par pressure badhta hai. Usko turant faisla lena padta hai, lekin andar se woh confuse aur emotional hota hai. Scene ka main point yeh hai ki action se zyada uske expression aur choice se tension banती hai.`
      : `${movie} ke "${scene}" scene mein hero pe pressure build hota hai. Usko quick decision lena padta hai, but andar se woh confused aur emotional hota hai. Scene ka main point action nahi, uski choice aur expression se create hui tension hai.`;

  return {
    movie,
    scene,
    title: `${movie}: ${scene}`,
    paragraph,
    sceneBeats: ["pressure builds", "hard choice", "emotional pause", "decisive action"],
    toneWords: ["tense", "emotional", "decisive"],
    webContextUsed: false
  };
}

function fallbackReview(movie, scene, sourceParagraph, userTranslation) {
  return {
    movie,
    scene,
    sourceParagraph,
    userTranslation,
    overall: "Good attempt. Use tighter verbs, correct articles, and more natural scene phrases.",
    improvedTranslation:
      "In this scene, the hero is under pressure and has to make a quick decision. Even though he feels confused and emotional inside, the tension comes from his expression and the choice he makes.",
    mistakes: [
      {
        id: `${Date.now()}-0`,
        type: "Vocabulary",
        label: "Use stronger scene verbs",
        userText: "pressure is increasing",
        suggestion: "pressure builds",
        why: "Scene explain karte waqt 'builds' zyada natural lagta hai.",
        memoryCue: "pressure builds"
      },
      {
        id: `${Date.now()}-1`,
        type: "Article",
        label: "Add article before singular noun",
        userText: "take quick decision",
        suggestion: "make a quick decision",
        why: "English mein 'decision' ke saath usually 'make a decision' use hota hai.",
        memoryCue: "make a decision"
      },
      {
        id: `${Date.now()}-2`,
        type: "Phrase",
        label: "Natural contrast phrase",
        userText: "but inside he confused",
        suggestion: "even though he feels confused inside",
        why: "Contrast dikhane ke liye 'even though' smooth phrase hai.",
        memoryCue: "even though..."
      }
    ]
  };
}
