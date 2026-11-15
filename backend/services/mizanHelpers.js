/**
 * Helpers for Mizan, LegalLink's legal assistant:
 *  - instant replies for greetings and thanks (no AI call, no waiting)
 *  - a short cached list of advocates and NGOs for the AI's context
 *  - matching advocates and NGOs to show as cards under an answer
 */
const Lawyer = require('../models/Lawyer');
const NGO = require('../models/NGO');

// ── 1. Instant small talk ─────────────────────────────────────────────────────
const norm = (s) => String(s || '').toLowerCase().replace(/[^a-z؀-ۿ\s']/g, ' ').replace(/\s+/g, ' ').trim();

// Each entry has its own language: English words get an English reply,
// Roman Urdu words get a Roman Urdu reply.
const SMALL_TALK = [
  {
    re: /^(assalam ?o ?alaikum|assalamu ?alaikum|asalam ?o ?alaikum|aoa|salam|salaam|slam|as ?salam ?alaikum)( (mizan|g|ji|sir|bhai))?$/,
    reply: (name) => `Wa Alaikum Assalam${name ? ` ${name}` : ''}! Main Mizan hoon, LegalLink ka legal assistant. Apna masla batayein, main aap ko Pakistani qanoon ke mutabiq aap ke haqooq aur agla qadam samjhata hoon.`
  },
  {
    re: /^(السلام علیکم|سلام)$/,
    reply: (name) => `وعلیکم السلام${name ? ` ${name}` : ''}! میں میزان ہوں، LegalLink کا قانونی معاون۔ اپنا مسئلہ بتائیں، میں پاکستانی قانون کے مطابق آپ کے حقوق اور اگلا قدم سمجھاتا ہوں۔`
  },
  {
    re: /^(hi|hello|hey|hii+|helo|hellow|hey there|hi there|hello there|good (morning|afternoon|evening))( (mizan|there|sir))?$/,
    reply: (name) => `Hello${name ? ` ${name}` : ''}! I'm Mizan, LegalLink's legal assistant. Tell me what happened and I'll explain your rights under Pakistani law and the next steps. You can write in English or Roman Urdu.`
  },
  {
    re: /^(thanks?( a lot| so much)?( mizan)?|thank you( so much| very much)?( mizan)?|thx|ty)$/,
    reply: () => `You're welcome! If you have another legal question, just ask. If your matter needs action, you can also see verified advocates on LegalLink.`
  },
  {
    re: /^(shukriya|shukria|bohat shukriya|bahut shukriya|jazakallah|jazak allah|jazakallah khair|meherbani)( mizan)?$/,
    reply: () => `Koi baat nahi! Agar koi aur qanooni sawal ho to zaroor poochiye. Agar aap ke masle mein karwai chahiye, to LegalLink par verified advocates bhi dekh sakte hain.`
  },
  {
    re: /^(bye|goodbye|good bye|see you)$/,
    reply: () => `Goodbye, take care! Whenever you have a legal question, Mizan is here.`
  },
  {
    re: /^(allah hafiz|khuda hafiz|khudahafiz|allahhafiz)$/,
    reply: () => `Allah Hafiz! Apna khayal rakhiye. Jab bhi koi qanooni sawal ho, Mizan haazir hai.`
  },
  {
    re: /^(ok|okay|okk|k|alright|great|nice|good|hmm)$/,
    reply: () => `Alright. Is there anything else about your legal matter you'd like me to explain?`
  },
  {
    re: /^(theek hai|thik hai|acha|achha|accha|ji|jee|ji theek hai)$/,
    reply: () => `Theek hai. Kya aap apne masle ke baare mein kuch aur poochna chahte hain?`
  }
];

function smallTalkReply(message, userName) {
  const m = norm(message);
  if (!m || m.split(' ').length > 6) return null;
  const hit = SMALL_TALK.find((s) => s.re.test(m));
  return hit ? hit.reply(userName ? userName.split(' ')[0] : '') : null;
}

// ── 2. Cached context lists for the AI prompt ─────────────────────────────────
const CACHE_MS = 5 * 60 * 1000;
let ctxCache = { at: 0, lawyers: [], ngos: [] };

async function getContextLists() {
  if (Date.now() - ctxCache.at < CACHE_MS) return ctxCache;
  try {
    const [lawyers, ngos] = await Promise.all([
      Lawyer.find({ verificationStatus: 'approved', isBlocked: { $ne: true } })
        .select('name specialization experience stateOfPractice rating')
        .sort({ rating: -1, totalReviews: -1 })
        .limit(12)
        .lean(),
      NGO.find({ verificationStatus: 'approved', isBlocked: { $ne: true } })
        .select('name city focusAreas')
        .limit(12)
        .lean()
    ]);
    ctxCache = { at: Date.now(), lawyers, ngos };
  } catch (e) {
    console.warn('[Mizan] could not load context lists:', e.message);
  }
  return ctxCache;
}

// ── 3. Advocate and NGO suggestions ───────────────────────────────────────────
const CITIES = [
  'Lahore', 'Karachi', 'Islamabad', 'Rawalpindi', 'Faisalabad', 'Multan', 'Peshawar', 'Quetta',
  'Sialkot', 'Gujranwala', 'Hyderabad', 'Bahawalpur', 'Sargodha', 'Sukkur', 'Abbottabad', 'Mardan',
  'Gujrat', 'Sahiwal', 'Sheikhupura', 'Jhelum', 'Okara', 'Kasur', 'Rahim Yar Khan', 'Dera Ghazi Khan', 'Muzaffarabad', 'Mirpur'
];

const CITY_PROVINCE = {
  Lahore: 'Punjab', Rawalpindi: 'Punjab', Faisalabad: 'Punjab', Multan: 'Punjab', Sialkot: 'Punjab', Gujranwala: 'Punjab',
  Bahawalpur: 'Punjab', Sargodha: 'Punjab', Gujrat: 'Punjab', Sahiwal: 'Punjab', Sheikhupura: 'Punjab', Jhelum: 'Punjab',
  Okara: 'Punjab', Kasur: 'Punjab', 'Rahim Yar Khan': 'Punjab', 'Dera Ghazi Khan': 'Punjab',
  Karachi: 'Sindh', Hyderabad: 'Sindh', Sukkur: 'Sindh',
  Peshawar: 'Khyber Pakhtunkhwa', Abbottabad: 'Khyber Pakhtunkhwa', Mardan: 'Khyber Pakhtunkhwa',
  Quetta: 'Balochistan', Islamabad: 'Islamabad', Muzaffarabad: 'Azad Kashmir', Mirpur: 'Azad Kashmir'
};

const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

function detectCity(text) {
  const t = String(text || '').toLowerCase();
  return CITIES.find((c) => new RegExp(`\\b${escapeRe(c.toLowerCase())}\\b`).test(t)) || null;
}

// Which NGO focus areas fit a legal category
const NGO_FOCUS = {
  'Human Rights': ['Human Rights'],
  'Domestic Violence': ['Domestic Violence', 'Women Rights'],
  'Women Rights': ['Women Rights', 'Domestic Violence'],
  'Family Law': ['Women Rights', 'Child Protection', 'Domestic Violence'],
  'Labor Law': ['Labor Rights'],
  'Criminal Law': ['Prisoner Aid', 'Human Rights'],
  'Cyber Law': ['Women Rights', 'Human Rights']
};
const AID_CATEGORIES = ['Human Rights', 'Domestic Violence', 'Women Rights'];

const lawyerCard = (l) => ({
  _id: l._id,
  name: l.name,
  photo: l.photo || '',
  specialization: (l.specialization || []).slice(0, 2),
  experience: l.experience || 0,
  rating: l.rating || 0,
  totalReviews: l.totalReviews || 0,
  location: (l.stateOfPractice || [])[0] || ''
});

const ngoCard = (n) => ({
  _id: n._id,
  name: n.name,
  city: n.city || '',
  focusAreas: (n.focusAreas || []).slice(0, 2)
});

async function findLawyers(category, city) {
  const base = { verificationStatus: 'approved', isBlocked: { $ne: true } };
  const spec = category && category !== 'General' ? { specialization: { $in: [new RegExp(`^${escapeRe(category)}$`, 'i')] } } : {};
  const where = city
    ? { $or: [{ officeAddress: new RegExp(escapeRe(city), 'i') }, { stateOfPractice: new RegExp(escapeRe(CITY_PROVINCE[city] || city), 'i') }] }
    : {};
  const pick = (q) => Lawyer.find(q).select('name photo specialization experience rating totalReviews stateOfPractice')
    .sort({ rating: -1, totalReviews: -1, experience: -1 }).limit(3).lean();

  // Most specific first: category + city, then the category anywhere.
  // Advocates from a different field are never suggested for a specific matter.
  let list = await pick({ ...base, ...spec, ...where });
  if (list.length < 3 && city) list = mergeUnique(list, await pick({ ...base, ...spec }));
  return list.slice(0, 3).map(lawyerCard);
}

async function findNGOs(category, city) {
  const base = { verificationStatus: 'approved', isBlocked: { $ne: true } };
  const focus = NGO_FOCUS[category];
  const byFocus = focus ? { focusAreas: { $in: focus } } : {};
  const pick = (q) => NGO.find(q).select('name city focusAreas').limit(2).lean();

  let list = await pick({ ...base, ...byFocus, ...(city ? { city: new RegExp(`^${escapeRe(city)}$`, 'i') } : {}) });
  if (list.length < 2) list = mergeUnique(list, await pick({ ...base, ...byFocus }));
  if (list.length === 0) list = await pick(base);
  return list.slice(0, 2).map(ngoCard);
}

function mergeUnique(a, b) {
  const seen = new Set(a.map((x) => String(x._id)));
  return a.concat(b.filter((x) => !seen.has(String(x._id))));
}

/**
 * Suggestions shown under a legal answer: up to 3 advocates for the category,
 * plus up to 2 NGOs when free help fits (they asked, or it's a rights matter).
 */
async function getSuggestions({ kind, category, aid, text }) {
  if (kind !== 'legal') return { lawyers: [], ngos: [], city: null };
  const city = detectCity(text);
  try {
    const wantNGOs = aid || AID_CATEGORIES.includes(category);
    const [lawyers, ngos] = await Promise.all([
      findLawyers(category, city),
      wantNGOs ? findNGOs(category, city) : Promise.resolve([])
    ]);
    return { lawyers, ngos, city };
  } catch (e) {
    console.warn('[Mizan] suggestions failed:', e.message);
    return { lawyers: [], ngos: [], city };
  }
}

module.exports = { smallTalkReply, getContextLists, getSuggestions, detectCity };
