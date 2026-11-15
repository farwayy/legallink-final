const { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } = require("@google/generative-ai");

const apiKey = process.env.GOOGLE_GEMINI_API_KEY;
const genAI = apiKey ? new GoogleGenerativeAI(apiKey) : null;

// Available candidate models in order of priority
const CANDIDATE_MODELS = [
    "gemini-3.5-flash",
    "gemini-flash-latest",
    "gemini-2.5-flash-lite",
    "gemini-3.1-flash-lite"
];

// The last model that answered successfully is tried first next time, so a
// failing model does not cost a slow retry on every single message.
let preferredModel = null;

// Give up on a model if it has not started answering within this time
const FIRST_TOKEN_TIMEOUT_MS = 15000;

const safetySettings = [
    { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
    { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
];

// Categories Mizan may report. They match the advocate specialisations used
// across LegalLink, so the category can be used to suggest matching advocates.
const LEGAL_CATEGORIES = [
    "Family Law", "Criminal Law", "Property Law", "Civil Law", "Corporate Law",
    "Domestic Violence", "Women Rights", "Human Rights", "Tax Law", "Labor Law",
    "Cyber Law", "General"
];

// What Mizan knows about LegalLink itself, so it can guide people through the site
const PLATFORM_GUIDE = `
ABOUT LEGALLINK (use this to guide people through the website):
- LegalLink connects people in Pakistan with verified advocates and free legal aid NGOs. Every advocate and NGO is checked by the LegalLink admin team before they appear (advocates by Bar Council ID and documents).
- Accounts: citizens create a free account (Sign up > Citizen). Advocates sign up with their Bar Council ID and documents and wait for verification. NGOs register with their registration documents and wait for verification. Log in at "Log in" and pick the account type.
- Find an advocate: menu "Find Advocates". Filter by specialisation (Family, Criminal, Property, Civil, Corporate, Cyber, Labour, Tax, Women Rights, Human Rights, Domestic Violence) and city. Each advocate has a public profile with experience, practice areas and client reviews.
- Hiring an advocate: on the advocate's profile press "Hire" / send an inquiry describing the matter and choosing a package. Nothing is paid upfront. The advocate accepts or declines. After the advocate accepts, the citizen completes payment and the case file is opened.
- Free legal aid: menu "Legal Aid (NGOs)". Pick an NGO and send a legal aid request. If the NGO accepts, it assigns one of its panel advocates and the case is handled pro bono (free).
- Case file: every case has its own page with Overview (stage and what happens next), Hearings (dates, status and outcomes), Documents (upload and download files) and Messages (chat with your advocate or NGO). The case moves through 4 stages: Intake & review, Counsel appointed, Court proceedings, Resolved.
- Citizen dashboard: shows active cases, the next hearing, inquiries waiting for an answer and case charts. Profile: edit personal details and photo.
- Templates: menu "Templates" has ready legal document templates (for example affidavits, agreements, notices) to download and fill in.
- Reviews: after a case is resolved the citizen can rate and review the advocate or NGO. Problems with a case can be reported to the admin team as a dispute.
- Advocates use the Counsel Portal (Dashboard, My Cases, Requests for client inquiries, open cases and NGO panel invitations, Profile).
- Mizan (you) is on the "Ask Mizan" page and is available to everyone; signed-in users have their conversations saved.`;

/**
 * Builds the system instruction, including a short live list of advocates and NGOs.
 */
function buildSystemInstruction(liveContext = {}) {
    const { ngos = [], lawyers = [], dfCategory = null, dfIntent = null, userName = null, userRole = null } = liveContext;

    const ngoInfo = ngos.length
        ? "\nSOME VERIFIED NGOS ON LEGALLINK:\n" + ngos.map(n =>
            `- ${n.name} (${n.city || 'Pakistan'}): ${Array.isArray(n.focusAreas) ? n.focusAreas.join(', ') : n.focusAreas || 'Legal aid'}`
        ).join("\n")
        : "";

    const lawyerInfo = lawyers.length
        ? "\nSOME VERIFIED ADVOCATES ON LEGALLINK:\n" + lawyers.map(l =>
            `- Advocate ${l.name}: ${Array.isArray(l.specialization) ? l.specialization.join(', ') : l.specialization || 'General practice'}, ${l.experience || 0} years, ${(l.stateOfPractice || []).join(', ') || 'Pakistan'}`
        ).join("\n")
        : "";

    const who = userName
        ? `You are talking to ${userName} (${userRole === 'lawyer' ? 'an advocate' : userRole === 'ngo' ? 'an NGO' : 'a signed-in citizen'}).`
        : "You are talking to a visitor who is not signed in.";

    return `You are Mizan (Urdu for "the scales of justice"), LegalLink's legal assistant for Pakistan. ${who}

SCOPE (very important):
- You ONLY help with (a) legal questions and legal problems, mainly under Pakistani law, and (b) how to use LegalLink.
- Greetings and thanks are fine: reply briefly and invite a legal question.
- For anything else (sports, recipes, coding, homework, maths, entertainment, health, general knowledge, writing unrelated to law), politely decline in ONE or TWO short sentences in the user's language, say you only help with legal matters and LegalLink, and give one example of a legal question you can help with. Do not answer the off-topic question, not even partly.
- If a question mixes a legal and a non-legal part, answer only the legal part.

FIRST LINE TAG (required, the user never sees it):
Start EVERY reply with exactly one tag on its own first line, then your answer on the next line.
Format: [[kind|category|urgency|aid]]
- kind: legal, platform, greeting or offtopic
- category: one of ${LEGAL_CATEGORIES.join(', ')} (use General for platform, greeting and offtopic)
- urgency: urgent (arrest, detention, violence, threats to safety, harassment happening now, a deadline within days) or normal
- aid: aid if the person says they cannot afford a lawyer, asks for free help or an NGO, or the matter is domestic violence or a human rights abuse; otherwise noaid
Example first line: [[legal|Family Law|normal|noaid]]

LANGUAGE (strict):
- Reply in the same language as the user's LATEST message, even if earlier messages were in another language.
- English message: reply fully in English (no Urdu words). Roman Urdu message: reply in Roman Urdu. Urdu script: reply in Urdu script. A real mix of English and Roman Urdu: reply in the same natural mix.
- Law names, section numbers and LegalLink menu names stay as they are (for example "Family Courts Act 1964", "Find Advocates").

HOW TO ANSWER A LEGAL QUESTION:
- Start with a direct answer in 1 to 2 sentences.
- Then explain the relevant law in plain words.
- Then give clear next steps as a short numbered list.
- End with when they should involve an advocate (or an NGO if they cannot afford one). Do not list advocates' names in your text; LegalLink shows matching advocates and NGOs as cards under your answer, so just say "see the suggested advocates below" when useful.
- If urgency is urgent, put the emergency step first: Police 15, Ministry of Human Rights helpline 1099, Punjab Women Protection helpline 1043, Rescue 1122, FIA cybercrime helpline 1991 (only the ones that fit).
- Keep it focused: usually under 220 words. Use **bold** for key terms and short bullet or numbered lists. No tables, no headings with #.
- Ask one short follow-up question if important facts are missing (for example the city, dates, or whether an FIR exists).

ACCURACY:
- Name a specific law or section only when you are confident it is correct. If you are not sure of a section number, describe the law in general terms instead of guessing.
- Useful areas: Muslim Family Laws Ordinance 1961, Family Courts Act 1964, Guardians and Wards Act 1890, Dissolution of Muslim Marriages Act 1939, Pakistan Penal Code, Code of Criminal Procedure (FIR s.154, bail s.497/498, Justice of Peace s.22-A/22-B), Constitution Articles 9, 10, 10-A, 14, 25 and 199, Punjab Rented Premises Act 2009, Payment of Wages Act 1936, Protection against Harassment of Women at the Workplace Act 2010, Prevention of Electronic Crimes Act 2016, Punjab Protection of Women against Violence Act 2016.
- Laws differ by province; say so when it matters and ask which province or city if needed.
- You give general legal information, not legal advice for their specific case. Say this briefly only when giving substantive legal guidance, not in every message.

LEGALLINK QUESTIONS:
- Answer from the guide below with the exact menu names and steps. Use kind platform.
${PLATFORM_GUIDE}
${dfCategory ? `\nA separate classifier suggests the category may be '${dfCategory}' (intent '${dfIntent || 'n/a'}'). Use it only if it fits.` : ''}
${lawyerInfo}
${ngoInfo}`;
}

// ── Reply tag helpers ─────────────────────────────────────────────────────────
const TAG_RE = /^\s*\[\[([^\]]*)\]\]\s*\n?/;

function parseReplyTag(text) {
    const m = (text || '').match(TAG_RE);
    if (!m) return { kind: 'legal', category: 'General', urgent: false, aid: false, body: (text || '').trim(), hasTag: false };
    const [kind = 'legal', category = 'General', urgency = 'normal', aid = 'noaid'] = m[1].split('|').map(s => s.trim());
    const cleanCategory = LEGAL_CATEGORIES.find(c => c.toLowerCase() === category.toLowerCase()) || 'General';
    return {
        kind: ['legal', 'platform', 'greeting', 'offtopic'].includes(kind.toLowerCase()) ? kind.toLowerCase() : 'legal',
        category: cleanCategory,
        urgent: /urgent/i.test(urgency),
        aid: /^aid$/i.test(aid),
        body: text.slice(m[0].length).trim(),
        hasTag: true
    };
}

function toGeminiHistory(chatHistory = []) {
    return chatHistory.slice(-10)
        .filter(h => (h.role === 'user' || h.role === 'model') && h.content)
        .map(h => ({ role: h.role, parts: [{ text: h.content }] }));
}

function modelOrder() {
    return preferredModel
        ? [preferredModel, ...CANDIDATE_MODELS.filter(m => m !== preferredModel)]
        : [...CANDIDATE_MODELS];
}

function withTimeout(promise, ms, label) {
    let timer;
    return Promise.race([
        promise,
        new Promise((_, reject) => { timer = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms); })
    ]).finally(() => clearTimeout(timer));
}

/**
 * Streams Mizan's reply as raw text chunks (the first line is the hidden tag).
 * Tries the preferred model first, then the others. Once text has started
 * flowing it cannot switch models, so a later failure is passed to the caller.
 */
async function* streamMizanReply({ userMessage, chatHistory = [], liveContext = {} }) {
    if (!genAI) throw new Error('GOOGLE_GEMINI_API_KEY is not configured');
    const systemInstruction = buildSystemInstruction(liveContext);
    const history = toGeminiHistory(chatHistory);
    let lastError = null;

    for (const modelName of modelOrder()) {
        let started = false;
        try {
            const model = genAI.getGenerativeModel({ model: modelName, safetySettings, systemInstruction });
            const chat = model.startChat({ history });
            const result = await withTimeout(chat.sendMessageStream(userMessage), FIRST_TOKEN_TIMEOUT_MS, modelName);

            for await (const chunk of result.stream) {
                let piece = '';
                try { piece = chunk.text(); } catch (e) { piece = ''; }
                if (piece) {
                    started = true;
                    yield piece;
                }
            }
            if (!started) throw new Error('empty response');
            if (preferredModel !== modelName) console.log(`⚡ [Mizan] Using model ${modelName}`);
            preferredModel = modelName;
            return;
        } catch (err) {
            lastError = err;
            console.warn(`[Mizan (${modelName})] ${String(err.message).slice(0, 140)}`);
            if (started) throw err; // part of an answer was already sent
            if (preferredModel === modelName) preferredModel = null;
        }
    }
    throw lastError || new Error('No model available');
}

/**
 * Non-streaming version, kept for the older /api/chat/message endpoint.
 * Returns the answer text with the hidden tag removed.
 */
async function generateGeminiLegalResponse({ userMessage, chatHistory = [], liveContext = {} }) {
    if (!genAI || !userMessage || !userMessage.trim()) return null;
    try {
        let text = '';
        for await (const piece of streamMizanReply({ userMessage, chatHistory, liveContext })) text += piece;
        return parseReplyTag(text).body || null;
    } catch (err) {
        console.warn('[Mizan] generate failed:', err.message);
        return null;
    }
}

module.exports = {
    streamMizanReply,
    generateGeminiLegalResponse,
    parseReplyTag,
    LEGAL_CATEGORIES,
    isGeminiConfigured: () => Boolean(genAI)
};
