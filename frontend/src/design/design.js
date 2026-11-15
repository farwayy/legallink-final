/**
 * LegalLink — design file
 * ---------------------------------------------------------------------------
 * Every colour, gradient, font, radius, shadow and piece of landing-page
 * content lives here. Components never hard-code these values: they read
 * them from this file (directly, or through the CSS variables that
 * `cssVars()` puts on the page wrapper).
 *
 * To restyle the site, change a value here and it updates everywhere.
 */

/* ───────────────────────────── Colours ───────────────────────────── */

export const palette = {
  forest950: "#06110C",
  forest900: "#0A1A13",
  forest800: "#0F261C",
  forest700: "#163428",
  forest600: "#1F4535",
  forest500: "#2C5A46",
  forest400: "#3E705A",
  gold: "#D4AF37",
  goldDeep: "#A87B12",
  goldSoft: "#F5E6BE",
  white: "#FFFFFF",
  success: "#22C55E",
};

/** Theme tokens. Keys become CSS variables named `--lx-<key>`. */
export const themes = {
  light: {
    page: "#FFFFFF",
    soft: "#F1F4F0",
    surface: "#FFFFFF",
    border: "#E1E7E2",
    ink: "#0D2219",
    text: "#1E3328",
    muted: "#53645B",
    accent: palette.forest600,
    accentText: palette.goldDeep,
    gold: palette.gold,
    tint: "rgba(31, 69, 53, 0.08)",

    heroFrom: "#3A6652",
    heroTo: "#0C231A",
    cardFrom: "#335F4B",
    cardTo: "#0F2A1F",
    band: palette.forest950,
    heroCard: "#FFFFFF",
    shadow: "0 30px 60px -24px rgba(8, 30, 20, 0.45)",
    shadowSoft: "0 14px 34px -16px rgba(8, 30, 20, 0.28)",
  },
  dark: {
    page: "#07110D",
    soft: "#0B1612",
    surface: "#0E1A15",
    border: "#1C2E26",
    ink: "#EEF3EF",
    text: "#D3DED8",
    muted: "#93A69C",
    accent: palette.gold,
    accentText: palette.gold,
    gold: palette.gold,
    tint: "rgba(212, 175, 55, 0.12)",

    heroFrom: "#1D3D30",
    heroTo: "#050E0A",
    cardFrom: "#24493A",
    cardTo: "#0A1D15",
    band: "#030806",
    heroCard: "#0E1A15",
    shadow: "0 30px 60px -24px rgba(0, 0, 0, 0.7)",
    shadowSoft: "0 14px 34px -16px rgba(0, 0, 0, 0.6)",
  },
};

/* ──────────────────────── Type, shape, motion ─────────────────────── */

export const fonts = {
  serif: "'Playfair Display', Georgia, serif",
  sans: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
  signature: "'Bodoni Moda', 'Playfair Display', Georgia, serif",
};

export const type = {
  display: "clamp(2.6rem, 4.6vw, 4rem)",
  h2: "clamp(2.1rem, 3.6vw, 3.2rem)",
  h3: "1.35rem",
  body: "1rem",
  small: "0.875rem",
  kicker: "0.75rem",
};

export const radius = { sm: "10px", md: "14px", lg: "20px", xl: "26px", pill: "9999px" };

export const layout = { maxWidth: "1200px", sectionY: "110px", gutter: "24px" };

export const motion = {
  ease: "cubic-bezier(0.16, 1, 0.3, 1)",
  fast: "0.2s",
  base: "0.35s",
  slow: "0.7s",
  marqueeSeconds: 38,
};

/** Builds the CSS variables for the current theme (put on the page wrapper). */
export const cssVars = (isDark) => {
  const t = isDark ? themes.dark : themes.light;
  const vars = {};
  Object.entries(t).forEach(([k, v]) => {
    vars[`--lx-${k}`] = v;
  });
  vars["--lx-hero-gradient"] = `linear-gradient(120deg, ${t.heroFrom} 0%, ${t.heroTo} 100%)`;
  vars["--lx-card-gradient"] = `linear-gradient(135deg, ${t.cardFrom} 0%, ${t.cardTo} 100%)`;
  vars["--lx-serif"] = fonts.serif;
  vars["--lx-sans"] = fonts.sans;
  vars["--lx-signature"] = fonts.signature;
  vars["--lx-display"] = type.display;
  vars["--lx-h2"] = type.h2;
  vars["--lx-h3"] = type.h3;
  vars["--lx-radius-sm"] = radius.sm;
  vars["--lx-radius-md"] = radius.md;
  vars["--lx-radius-lg"] = radius.lg;
  vars["--lx-radius-xl"] = radius.xl;
  vars["--lx-max"] = layout.maxWidth;
  vars["--lx-section-y"] = layout.sectionY;
  vars["--lx-ease"] = motion.ease;
  vars["--lx-marquee"] = `${motion.marqueeSeconds}s`;
  return vars;
};

/* ───────────────────────────── Images ───────────────────────────── */

export const images = {
  logo: "/images/legallink-logo.png",
  hero: "/images/hero-lawyer.webp",
  about: "/images/about-meeting.jpg",
  aboutSide: "/images/ll15.jpg",
  process: "/images/process-team.jpg",
  portal: "/images/ll11.jpg",
  clients: ["/images/client-2.jpg", "/images/client-1.jpg"],
  // Background pictures for review cards when the reviewer has no profile photo
  reviewScenes: ["/images/ll17.jpg", "/images/ll2.jpg", "/images/ll16.jpg"],
};

/* ───────────────────────────── Content ───────────────────────────── */

/** The AI legal assistant. Change the name here and it updates everywhere. */
export const assistant = {
  name: "Mizan",
  urdu: "میزان",
  tagline: "Your legal guide",
  meaning: "Mizan means the scales of justice",
  languages: "English & Roman Urdu",
};

export const contact = {
  whatsapp: "https://wa.me/923494274418",
  email: "info@legallink.pk",
  hours: "Mon–Sat · 9:00 AM – 6:00 PM",
};

export const navLinks = [
  { label: "Home", to: "/" },
  { label: "Find Advocates", to: "/lawyers" },
  { label: "Legal Aid (NGOs)", to: "/ngos" },
  { label: "Templates", to: "/documents" },
  { label: "Ask Mizan", to: "/chatbot" },
];

export const hero = {
  accent: "Trusted",
  title: ["Legal Help,", "Verified Advocates", "Across Pakistan"],
  text:
    "LegalLink connects you with Bar Council–verified advocates, pro bono NGO clinics and a 24/7 AI legal assistant — clear, private and built for swift justice.",
  primary: { label: "Find an Advocate", to: "/lawyers" },
  secondary: { label: "Ask Mizan, our AI", to: "/chatbot" },
  badges: [
    { icon: "shield", title: "Bar Council verified", text: "Every advocate checked" },
    { icon: "heart", title: "Pro bono legal aid", text: "Accredited NGO partners" },
  ],
};

export const practiceTicker = [
  "Corporate Law",
  "Criminal Defense",
  "Family Law",
  "Property & Succession",
  "Cyber Crime",
  "Labour & Employment",
  "Immigration",
  "Civil Litigation",
];

export const stats = [
  { value: "500", suffix: "+", label: "Verified advocates" },
  { value: "12k", suffix: "+", label: "Consultations completed" },
  { value: "98", suffix: "%", label: "Client satisfaction" },
  { value: "40", suffix: "+", label: "NGO legal aid partners" },
];

export const about = {
  kicker: "Why LegalLink",
  accent: "About",
  title: "the Platform",
  text:
    "Built for Pakistani citizens who deserve transparent, affordable access to justice — from the first question to the final judgment.",
  cardText:
    "Whether it's a property dispute, a bail petition or a family matter, LegalLink helps you find the right advocate, track every hearing and keep all your case documents in one secure place.",
  cardCta: { label: "Request Legal Advice", to: "/signup" },
  points: [
    "Advocates verified against Bar Council records",
    "Free legal aid through accredited NGOs",
    "Hearing dates, documents and updates in one place",
  ],
};

export const steps = [
  {
    num: "01",
    accent: "Describe",
    title: "Your Case",
    text: "Tell the AI assistant what happened or submit a structured inquiry with your FIR, contract or notice.",
    image: "/images/ll12.jpg",
  },
  {
    num: "02",
    accent: "Get",
    title: "Matched",
    text: "We match you with a verified advocate or NGO clinic that specialises in your matter.",
    image: "/images/process-team.jpg",
  },
  {
    num: "03",
    accent: "Action",
    title: "& Advocacy",
    text: "Your advocate files, appears in court and keeps hearing dates and documents updated for you.",
    image: "/images/ll10.jpg",
  },
  {
    num: "04",
    accent: "Continuous",
    title: "Legal Support",
    text: "Message your counsel securely, follow every stage and rate the outcome once resolved.",
    image: "/images/ll16.jpg",
  },
];

export const practiceAreas = [
  { icon: "scale", title: "Civil Law", text: "Contracts, property matters and civil litigation with professional guidance.", to: "/lawyers" },
  { icon: "gavel", title: "Criminal Defense", text: "Bail hearings, trials and appeals — your fundamental rights protected.", to: "/lawyers" },
  { icon: "heart", title: "Family Law", text: "Khula, custody, guardianship and maintenance handled with care.", to: "/lawyers" },
  { icon: "home", title: "Property & Succession", text: "Partition suits, succession certificates and inheritance claims.", to: "/lawyers" },
  { icon: "briefcase", title: "Corporate Law", text: "SECP registration, shareholder agreements and compliance.", to: "/lawyers" },
  { icon: "lock", title: "Cyber Crime", text: "Online blackmail, banking fraud and PECA complaints before the FIA.", to: "/lawyers" },
  { icon: "file", title: "Labour & Employment", text: "Wrongful termination, dues recovery and workplace harassment.", to: "/lawyers" },
  { icon: "globe", title: "Immigration", text: "Visa documentation, appeals and overseas Pakistani matters.", to: "/lawyers" },
];

export const ways = {
  kicker: "Three ways to get help",
  accent: "Justice,",
  title: "the Way You Need It",
  seal: "JUSTICE EQUALIZED",
  items: [
    { num: "i.", title: "Hire a verified advocate", text: "Compare profiles, ratings and practice areas, then send your case directly.", to: "/lawyers" },
    { num: "ii.", title: "Request free legal aid", text: "Can't afford counsel? Apply to an accredited NGO clinic for pro bono representation.", to: "/ngos" },
    { num: "iii.", title: "Ask Mizan, our AI legal assistant", text: "Understand your rights and next steps in plain language, any time of day.", to: "/chatbot" },
  ],
  badges: [
    { icon: "shield", title: "Bar Council Verified", text: "High Court advocates", pos: "top-left" },
    { icon: "live", title: "Live consultation", text: "Lawyers online now", pos: "bottom-right" },
    { icon: "heart", title: "Pro bono legal aid", text: "Accredited NGO partners", pos: "bottom-left" },
  ],
};

/** Shown until real reviews load from /api/reviews/featured (or if none exist). */
export const fallbackReviews = [
  {
    id: "f1",
    author: "Hamza Rafique",
    detail: "Property partition · Lahore High Court",
    rating: 5,
    comment:
      "Our inheritance dispute had been pending for three years. My advocate structured the partition claim with solid documentary proof and the decree came in our favour. Clear, honest counsel throughout.",
    photo: null,
  },
  {
    id: "f2",
    author: "Usman Ali Khan",
    detail: "Gratuity recovered through mediation",
    rating: 5,
    comment:
      "My terminal dues were withheld after a downsizing. The advocate issued a legal notice and recovered the full settlement through mediation, without years of litigation.",
    photo: "/images/client-2.jpg",
  },
  {
    id: "f3",
    author: "Ayesha Noor",
    detail: "Pro bono protective injunction",
    rating: 5,
    comment:
      "Through an NGO clinic on LegalLink I got a protective injunction and a maintenance order from the Family Court. I'm grateful for the care and integrity I was shown.",
    photo: "/images/client-1.jpg",
  },
];

export const cta = {
  kicker: "Begin today",
  accent: "Ready",
  title: "to Get Legal Help?",
  primary: { label: "Create Free Account", to: "/signup" },
  secondary: { label: "WhatsApp Helpline", href: contact.whatsapp },
};

export const footer = {
  blurb: "Verified advocates, pro bono legal aid and AI guidance for every citizen of Pakistan.",
  columns: [
    {
      title: "Quick Links",
      links: [
        { label: "Find Advocates", to: "/lawyers" },
        { label: "Legal Aid (NGOs)", to: "/ngos" },
        { label: "Templates", to: "/documents" },
        { label: "AI Assistant", to: "/chatbot" },
        { label: "About", to: "/about" },
      ],
    },
    {
      title: "Join LegalLink",
      links: [
        { label: "Create citizen account", to: "/signup" },
        { label: "Register as an advocate", to: "/lawyer/signup" },
        { label: "Register an NGO", to: "/ngo/signup" },
        { label: "Careers", to: "/career" },
        { label: "Our mission", to: "/mission" },
      ],
    },
  ],
  legal: "Privacy policy · Terms of service",
};
