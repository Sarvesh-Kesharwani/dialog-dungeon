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
