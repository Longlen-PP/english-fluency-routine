// Edit this file to customize the routine. No build step needed — just edit and refresh.

const CATEGORIES = {
  english:  { label: "English Practice", color: "#3B82F6" },
  exercise: { label: "Exercise",          color: "#22C55E" },
  study:    { label: "AI / Data Reading", color: "#14B8A6" },
  rest:     { label: "Rest / Sleep",      color: "#8B5CF6" },
  personal: { label: "Personal / Meals",  color: "#F97316" },
  misc:     { label: "Other",             color: "#EC4899" },
};

// `id` must be unique across BOTH schedules (used as the localStorage checklist key).
const SCHEDULES = {
  "mon-thu": {
    label: "Mon – Thu",
    blocks: [
      { id: "mt-1",  time: "7:00 – 7:30",   title: "Wake up, drop off girlfriend", category: "personal" },
      { id: "mt-2",  time: "7:30 – 9:00",   title: "Morning nap", category: "rest" },
      { id: "mt-3",  time: "9:00 – 9:30",   title: "Light exercise", category: "exercise" },
      { id: "mt-4",  time: "9:30 – 10:00",  title: "Shower", category: "personal" },
      { id: "mt-5",  time: "10:00 – 11:00", title: "Listening + Shadowing", category: "english",
        detail: "10:00–10:25 Listen to 3–4 short BBC/VOA clips (2–5 min each) · 10:25–10:50 Shadow your favorite clip · 10:50–11:00 Summarize what you heard out loud, in your own words" },
      { id: "mt-6",  time: "11:00 – 12:00", title: "Read: AI & Data", category: "study" },
      { id: "mt-7",  time: "12:00 – 13:00", title: "Lunch", category: "personal" },
      { id: "mt-8",  time: "13:00 – 14:00", title: "Read: AI & Data", category: "study" },
      { id: "mt-9",  time: "14:00 – 15:00", title: "Speaking practice (1000-sentence book)", category: "english",
        detail: "14:00–14:20 Pick 5–10 new sentences, repeat aloud · 14:20–14:40 Adapt each sentence to your own life · 14:40–15:00 Chain sentences into a short story, record and save it" },
      { id: "mt-10", time: "15:00 – 16:00", title: "Mental rest", category: "rest" },
      { id: "mt-11", time: "16:00 – 17:00", title: "Passive listening", category: "english",
        detail: "Watch/listen to English content you actually enjoy, English subtitles on — no need to catch every word, just let your ear adjust to the rhythm" },
      { id: "mt-12", time: "17:00 – 18:00", title: "Exercise at the field", category: "exercise" },
      { id: "mt-13", time: "18:00 – 20:00", title: "Pick up girlfriend, dinner", category: "personal" },
      { id: "mt-14", time: "20:00 – 21:00", title: "Shower", category: "personal" },
      { id: "mt-15", time: "21:00 – 21:30", title: "Light podcast", category: "english",
        detail: "Relax and listen before bed — no shadowing, no notes" },
      { id: "mt-16", time: "21:30 – 00:00", title: "Football practice", category: "misc" },
      { id: "mt-17", time: "00:00 – 01:00", title: "Wind down / gaming", category: "rest" },
      { id: "mt-18", time: "01:00 – 7:00",  title: "Sleep", category: "rest" },
    ],
  },
  "fri-sun": {
    label: "Fri – Sun",
    note: "Identical to Mon–Thu except one block:",
    blocks: [
      { id: "fs-1",  time: "7:00 – 7:30",   title: "Wake up, drop off girlfriend", category: "personal" },
      { id: "fs-2",  time: "7:30 – 9:00",   title: "Morning nap", category: "rest" },
      { id: "fs-3",  time: "9:00 – 9:30",   title: "Light exercise", category: "exercise" },
      { id: "fs-4",  time: "9:30 – 10:00",  title: "Shower", category: "personal" },
      { id: "fs-5",  time: "10:00 – 11:00", title: "Listening + Shadowing", category: "english",
        detail: "10:00–10:25 Listen to 3–4 short BBC/VOA clips (2–5 min each) · 10:25–10:50 Shadow your favorite clip · 10:50–11:00 Summarize what you heard out loud, in your own words" },
      { id: "fs-6",  time: "11:00 – 12:00", title: "Read: AI & Data", category: "study" },
      { id: "fs-7",  time: "12:00 – 13:00", title: "Lunch", category: "personal" },
      { id: "fs-8",  time: "13:00 – 14:00", title: "Read: AI & Data", category: "study" },
      { id: "fs-9",  time: "14:00 – 15:00", title: "Speaking practice (1000-sentence book)", category: "english",
        detail: "14:00–14:20 Pick 5–10 new sentences, repeat aloud · 14:20–14:40 Adapt each sentence to your own life · 14:40–15:00 Chain sentences into a short story, record and save it" },
      { id: "fs-10", time: "15:00 – 16:00", title: "Mental rest", category: "rest" },
      { id: "fs-11", time: "16:00 – 17:00", title: "Passive listening", category: "english",
        detail: "Watch/listen to English content you actually enjoy, English subtitles on — no need to catch every word, just let your ear adjust to the rhythm" },
      { id: "fs-12", time: "17:00 – 18:00", title: "Exercise at the field", category: "exercise" },
      { id: "fs-13", time: "18:00 – 20:00", title: "Pick up girlfriend, dinner", category: "personal" },
      { id: "fs-14", time: "20:00 – 21:00", title: "Shower", category: "personal" },
      { id: "fs-15", time: "21:00 – 21:30", title: "Light podcast", category: "english",
        detail: "Relax and listen before bed — no shadowing, no notes" },
      { id: "fs-16", time: "21:30 – 00:00", title: "Study: making money with AI", category: "misc" },
      { id: "fs-17", time: "00:00 – 01:00", title: "Wind down / gaming", category: "rest" },
      { id: "fs-18", time: "01:00 – 7:00",  title: "Sleep", category: "rest" },
    ],
  },
};

const RESOURCES = [
  {
    name: "BBC Learning English",
    url: "https://www.bbc.co.uk/learningenglish",
    usage: "Used 10:00–11:00 for Listening + Shadowing — clear pronunciation, scripts included, great for pronunciation practice.",
    icon: "🎧",
    color: "#3B82F6",
    free: true,
  },
  {
    name: "VOA Learning English",
    url: "https://learningenglish.voanews.com/",
    usage: "Alternate with BBC in the 10:00–11:00 slot — slower than normal speech, great for training your ear early on.",
    icon: "📻",
    color: "#0EA5E9",
    free: true,
  },
  {
    name: "English with Lucy (YouTube)",
    url: "https://www.youtube.com/@LearnEnglishWithLucy",
    usage: "Used 16:00–17:00 for passive listening — real everyday speech patterns, clear pronunciation.",
    icon: "▶️",
    color: "#EF4444",
    free: true,
  },
  {
    name: "Kru Dew's 1000-Sentence Book",
    url: "",
    usage: "Used 14:00–15:00 for speaking practice — pick sentences close to your real life first, don't just work through the book in order.",
    icon: "📖",
    color: "#F59E0B",
    free: false,
    ownedLabel: "Already owned",
  },
];

const PRIORITY_TIPS = [
  { rule: "Never skip:", text: "14:00–15:00 Speaking practice — the highest priority. Even 10–15 minutes beats skipping it entirely." },
  { rule: "Second priority:", text: "10:00–11:00 Listening + Shadowing — if you don't have the full hour, 15–20 minutes of shadowing alone is enough." },
  { rule: "Cut first:", text: "16:00–17:00 passive listening and 21:00–21:30 podcast — these are passive inputs, so skipping them affects fluency the least." },
];
