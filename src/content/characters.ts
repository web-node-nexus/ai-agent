export type CharacterGender = "male" | "female";

export interface MarketingCharacter {
  slug: string;
  name: string;
  gender: CharacterGender;
  age: number;
  city: string;
  bio: string;
  tags: string[];
  sampleLines: string[];
  coverUrl: string;
  refUrls: string[];
  sortOrder: number;
}

export const CHARACTERS: MarketingCharacter[] = [
  {
    slug: "aanya",
    name: "Aanya",
    gender: "female",
    age: 24,
    city: "Delhi",
    bio: "Bubbly product designer who sketches café menus for fun and always has a new playlist.",
    tags: ["design", "cafés", "playlists"],
    sampleLines: [
      "Coffee first, or design critique?",
      "Today's mood: soft lighting and bad jokes.",
      "Tell me — what did you make today?",
    ],
    coverUrl: "/characters/aanya/cover.jpg",
    refUrls: [
      "/characters/aanya/ref1.jpg",
      "/characters/aanya/ref2.jpg",
      "/characters/aanya/ref3.jpg",
    ],
    sortOrder: 1,
  },
  {
    slug: "riya",
    name: "Riya",
    gender: "female",
    age: 25,
    city: "Mumbai",
    bio: "Calm book lover who reads on local trains and quotes poetry without making it awkward.",
    tags: ["books", "poetry", "trains"],
    sampleLines: [
      "Train window + one good chapter — perfect evening.",
      "What book are you on right now?",
      "Hmm, that line of yours… bookmark-worthy.",
    ],
    coverUrl: "/characters/riya/cover.jpg",
    refUrls: ["/characters/riya/ref1.jpg", "/characters/riya/ref2.jpg"],
    sortOrder: 2,
  },
  {
    slug: "meher",
    name: "Meher",
    gender: "female",
    age: 26,
    city: "Jaipur",
    bio: "Fitness and travel enthusiast who plans sunrise runs and pink-city getaways.",
    tags: ["fitness", "travel", "sunrise"],
    sampleLines: [
      "5am run or late-night chai — pick your adventure.",
      "Jaipur sunsets hit different.",
      "Stretch break? Come on, 2 minutes.",
    ],
    coverUrl: "/characters/meher/cover.jpg",
    refUrls: [
      "/characters/meher/ref1.jpg",
      "/characters/meher/ref2.jpg",
      "/characters/meher/ref3.jpg",
    ],
    sortOrder: 3,
  },
  {
    slug: "naina",
    name: "Naina",
    gender: "female",
    age: 23,
    city: "Pune",
    bio: "Musician who hums between sentences and turns ordinary days into soft soundtracks.",
    tags: ["music", "guitar", "monsoon"],
    sampleLines: [
      "Wait — that sentence had a melody.",
      "Monsoon + open window = free concert.",
      "So, what's today's soundtrack?",
    ],
    coverUrl: "/characters/naina/cover.jpg",
    refUrls: ["/characters/naina/ref1.jpg", "/characters/naina/ref2.jpg"],
    sortOrder: 4,
  },
  {
    slug: "arjun",
    name: "Arjun",
    gender: "male",
    age: 27,
    city: "Bangalore",
    bio: "Witty techie who debugs code by day and overthinks filter coffee ratios by night.",
    tags: ["tech", "coffee", "startups"],
    sampleLines: [
      "Bug fixed. Coffee? Priorities clear.",
      "Bangalore traffic taught me patience — and memes.",
      "Tell me, what did you ship today?",
    ],
    coverUrl: "/characters/arjun/cover.jpg",
    refUrls: [
      "/characters/arjun/ref1.jpg",
      "/characters/arjun/ref2.jpg",
      "/characters/arjun/ref3.jpg",
    ],
    sortOrder: 5,
  },
  {
    slug: "kabir",
    name: "Kabir",
    gender: "male",
    age: 26,
    city: "Mumbai",
    bio: "Guitar-and-chai guy who finds poetry in late-night local rides.",
    tags: ["guitar", "chai", "nights"],
    sampleLines: [
      "Chai went cold — that means we talk first.",
      "One chord, one thought. Listening?",
      "Mumbai nights hit soft when the guitar is out.",
    ],
    coverUrl: "/characters/kabir/cover.jpg",
    refUrls: ["/characters/kabir/ref1.jpg", "/characters/kabir/ref2.jpg"],
    sortOrder: 6,
  },
  {
    slug: "vihaan",
    name: "Vihaan",
    gender: "male",
    age: 25,
    city: "Chandigarh",
    bio: "Gym and cricket regular who celebrates small wins louder than centuries.",
    tags: ["gym", "cricket", "discipline"],
    sampleLines: [
      "Sets done. Pride unlocked.",
      "Match or nets — your call?",
      "Small win today — celebrate properly.",
    ],
    coverUrl: "/characters/vihaan/cover.jpg",
    refUrls: [
      "/characters/vihaan/ref1.jpg",
      "/characters/vihaan/ref2.jpg",
      "/characters/vihaan/ref3.jpg",
    ],
    sortOrder: 7,
  },
  {
    slug: "rohan",
    name: "Rohan",
    gender: "male",
    age: 28,
    city: "Lucknow",
    bio: "Shayari and old songs — polite charm with a soft Lucknowi pause.",
    tags: ["shayari", "old songs", "tehzeeb"],
    sampleLines: [
      "One couplet, then chai — deal?",
      "Do you still play old songs?",
      "There's a grace in the way you speak.",
    ],
    coverUrl: "/characters/rohan/cover.jpg",
    refUrls: ["/characters/rohan/ref1.jpg", "/characters/rohan/ref2.jpg"],
    sortOrder: 8,
  },
];

export const FEATURED_SLUGS = ["aanya", "riya", "arjun", "kabir"] as const;

export function getCharacter(slug: string) {
  return CHARACTERS.find((c) => c.slug === slug);
}

export function getFeaturedCharacters() {
  const list = FEATURED_SLUGS.map((slug) => getCharacter(slug)!).filter(
    Boolean
  );
  // Fresh order on each page load / refresh
  for (let i = list.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const tmp = list[i]!;
    list[i] = list[j]!;
    list[j] = tmp;
  }
  return list;
}
