const express = require('express');
const mongoose = require('mongoose');
const NGO = require('../models/NGO');
const Lawyer = require('../models/Lawyer');
const { 
    detectDialogflowIntent, 
    isDialogflowConfigured, 
    getDialogflowStatus 
} = require('../services/dialogflowService');
const { 
    generateGeminiLegalResponse, 
    streamMizanReply,
    parseReplyTag,
    isGeminiConfigured 
} = require('../services/legalAiService');
const { smallTalkReply, getContextLists, getSuggestions } = require('../services/mizanHelpers');
const ChatSession = require('../models/ChatSession');
const User = require('../models/User');
const jwt = require('jsonwebtoken');
const { authMiddleware } = require('../middleware/auth');
const { createRateLimiter } = require('../middleware/rateLimit');
const { classifyLocalNLP } = require('../services/nlpClassifier');

const router = express.Router();

// ── In-Memory Multi-Turn Session Tracker ─────────────────────────────────────
const sessionMemory = new Map();

function getSessionState(sessionId) {
    if (!sessionMemory.has(sessionId)) {
        sessionMemory.set(sessionId, {
            history: [],
            lastIntent: null,
            lastCategory: null,
            activeTopic: null,
            updatedAt: Date.now()
        });
    }
    return sessionMemory.get(sessionId);
}

function updateSessionState(sessionId, intent, category, topic) {
    const state = getSessionState(sessionId);
    state.lastIntent = intent || state.lastIntent;
    state.lastCategory = category || state.lastCategory;
    state.activeTopic = topic || state.activeTopic;
    state.updatedAt = Date.now();
    sessionMemory.set(sessionId, state);
}

// ── Dynamic NGO Recommendations ──────────────────────────────────────────────
async function buildDynamicNGOResponse(specificType = 'general') {
    let dbNGOs = [];
    try {
        let filter = { verificationStatus: 'approved' };
        if (specificType === 'human_rights_only') {
            filter.focusAreas = { $in: [new RegExp('Human Rights', 'i')] };
        } else if (specificType === 'women_only') {
            filter.focusAreas = { $in: [new RegExp('Women Rights|Domestic Violence', 'i')] };
        } else if (specificType === 'child_only') {
            filter.focusAreas = { $in: [new RegExp('Child Protection', 'i')] };
        }
        dbNGOs = await NGO.find(filter).select('name city focusAreas phone address servicesOffered').limit(3);
    } catch (e) {
        console.warn('Could not query NGOs from database:', e.message);
    }

    // ── CASE 1: SPECIFICALLY HUMAN RIGHTS NGOS ONLY ──
    if (specificType === 'human_rights_only') {
        let text = "Here are the premier independent Human Rights bodies and legal advocacy organizations in Pakistan:\n\n";

        if (dbNGOs.length > 0) {
            text += "🏛️ **Verified on LegalLink:**\n";
            dbNGOs.forEach((ngo, idx) => {
                text += `${idx + 1}. **${ngo.name}** (${ngo.city})\n   • Focus: Human Rights & Constitutional Protection\n   • Contact: ${ngo.phone || 'Available in directory'}\n`;
            });
            text += "\n";
        }

        text += "⚖️ **Dedicated National Human Rights Institutions:**\n";
        text += "1. **Human Rights Commission of Pakistan (HRCP)**\n";
        text += "   • Role: Pakistan's premier independent human rights watchdog since 1986.\n";
        text += "   • Scope: Civil liberties, freedom of expression, prevention of torture, enforced disappearances, and minority protections.\n";
        text += "   • Contact: Head Office Lahore (042-35883570) with regional chapters in Karachi, Islamabad, Quetta, Multan, and Peshawar.\n\n";

        text += "2. **National Commission for Human Rights (NCHR)**\n";
        text += "   • Role: Statutory federal human rights body created under the 2012 Act.\n";
        text += "   • Scope: Independent inquiries into government/police abuses, custodial torture, and suo-moto investigations.\n";
        text += "   • Direct Helpline: 1099 (Ministry of Human Rights).\n\n";

        text += "3. **AGHS Legal Aid Cell (Asma Jahangir Legal Aid)**\n";
        text += "   • Role: Pro-bono public interest litigation cell.\n";
        text += "   • Scope: Defending prisoners of conscience, political dissidents, vulnerable minorities, and victims of fundamental rights abuses before High Courts and the Supreme Court.\n\n";

        text += "4. **Ministry of Human Rights (MOHR) Legal Aid & Helpline**\n";
        text += "   • Toll-Free National Helpline: **1099** (operates 24/7 for reporting fundamental rights violations and requesting government legal assistance).\n\n";

        text += "💡 **What Specific Violation Are You Facing?**\n";
        text += "If you or a family member are dealing with an unlawful arrest, police detention without warrant, threats, or harassment, describe what occurred. I can guide you on immediate constitutional remedies (such as a **Habeas Corpus Petition under Article 199** before the High Court).";

        return text;
    }

    // ── CASE 2: WOMEN'S RIGHTS & CRISIS SHELTER ──
    if (specificType === 'women_only') {
        let text = "Here are specialized Women's Rights NGOs and Crisis Shelters in Pakistan:\n\n";
        text += "1. **Dastak Charitable Trust** — Emergency crisis shelter, psychological counseling, and free legal representation for women facing domestic violence and abuse.\n";
        text += "2. **Aurat Foundation** — Nationwide advocacy, legal literacy, and assistance for women facing gender-based violence.\n";
        text += "3. **Shirkat Gah Women's Resource Centre** — Legal counseling and family law rights advocacy.\n";
        text += "4. **Punjab Women Protection Authority** — Government emergency helpline: **1043** (24/7 rescue, shelter, and legal support).\n";
        text += "5. **Bedari / Rozan** — Trauma counseling and emotional support helpline.\n\n";
        text += "If you are in immediate physical danger, you can also seek an Emergency Protection Order from the Magistrate under the Domestic Violence (Prevention and Protection) Act.";
        return text;
    }

    // ── CASE 3: GENERAL NGO & LEGAL AID INQUIRY ──
    let text = "Here are verified Legal Aid and Human Rights NGOs you can connect with in Pakistan for free assistance:\n\n";

    if (dbNGOs.length > 0) {
        text += "🏛️ **Verified NGOs on LegalLink:**\n";
        dbNGOs.forEach((ngo, idx) => {
            const focus = Array.isArray(ngo.focusAreas) ? ngo.focusAreas.join(', ') : 'Human Rights';
            text += `${idx + 1}. **${ngo.name}** (${ngo.city})\n   • Focus: ${focus}\n   • Contact: ${ngo.phone || 'Available in portal'}\n`;
        });
        text += "\n";
    }

    text += "⚖️ **Prominent Public Interest Legal Aid Institutions:**\n";
    text += "• **Human Rights Commission of Pakistan (HRCP)** — Fundamental rights, civil liberties, and prisoner support.\n";
    text += "• **AGHS Legal Aid Cell (Asma Jahangir)** — Free court representation for women, children, minorities, and bonded labor.\n";
    text += "• **Dastak Charitable Trust** — Emergency safe shelter and legal crisis intervention for domestic violence.\n";
    text += "• **Legal Aid Society (LAS)** — Comprehensive pro-bono criminal defense and civil mediation.\n\n";
    text += "You can submit an official pro-bono aid application directly to these organizations using the button below.";

    return text;
}

// ── Dynamic Lawyer Recommendations ──────────────────────────────────────────
async function buildDynamicLawyerResponse(specializationFilter = null) {
    let dbLawyers = [];
    try {
        const query = { verificationStatus: 'approved' };
        if (specializationFilter) {
            query.specialization = { $in: [new RegExp(specializationFilter, 'i')] };
        }
        dbLawyers = await Lawyer.find(query).select('name specialization experience city rating').limit(3);
    } catch (e) {
        console.warn('Could not query Lawyers from database:', e.message);
    }

    let responseText = "You can browse and connect with Bar Council verified advocates directly on LegalLink:\n\n";

    if (dbLawyers.length > 0) {
        responseText += "⚖️ **Verified Advocates on LegalLink:**\n";
        dbLawyers.forEach((l, idx) => {
            const spec = Array.isArray(l.specialization) ? l.specialization.join(', ') : 'General Practice';
            responseText += `${idx + 1}. **Advocate ${l.name}** (${l.city || 'Pakistan'})\n   • Expertise: ${spec} (${l.experience} years experience)\n   • Rating: ${l.rating ? l.rating + '★' : 'Verified'}\n`;
        });
        responseText += "\n";
    }

    responseText += "💼 **LegalLink Lawyer Tiers:**\n";
    responseText += "• **Gold Advocates:** Dedicated legal counsel with up to 5 years experience handling civil, family, and criminal matters.\n";
    responseText += "• **Platinum Advocates:** Senior advocates with 5+ years experience and over 50 cases argued in District and High Courts.\n\n";
    responseText += "Click below to view the verified legal directory filtered by specialization, experience, and fee packages.";

    return responseText;
}

// ── GET /api/chat/status ──────────────────────────────────────────────────────
router.get('/status', (req, res) => {
    const dfStatus = getDialogflowStatus();
    const geminiActive = isGeminiConfigured();

    res.json({
        engine: 'Dialogflow ES + Google Gemini Hybrid AI',
        architecture: 'Hybrid Intent-Classification & Generative NLU',
        dialogflowActive: dfStatus.dialogflowActive,
        geminiActive: geminiActive,
        projectId: dfStatus.projectId,
        credentialsType: dfStatus.credentialsType,
        nlpModel: dfStatus.dialogflowActive 
            ? 'Dialogflow ES (Routing) + Google Gemini (Generative Reasoning)' 
            : 'Google Gemini (Generative Reasoning)',
        supportedLanguages: ['English', 'Roman Urdu', 'Urdu'],
        pakistaniLegalDomains: [
            'Family Law (Khula, Custody, Maintenance)',
            'Criminal Law (FIR, Pre/Post-Arrest Bail)',
            'Domestic Violence (Emergency Orders)',
            'Property Law (Tenancy, Eviction, Illegal Dispossession)',
            'Labor Law (Unpaid Wages, Wrongful Termination)',
            'Human Rights & Free Legal Aid (NGOs)'
        ]
    });
});

// ── POST /api/chat/message ────────────────────────────────────────────────────
router.post('/message', async (req, res) => {
    try {
        const { message, sessionId = 'default-session', contexts = [] } = req.body;

        if (!message || !message.trim()) {
            return res.status(400).json({ error: "Message is required" });
        }

        const trimmedMsg = message.trim();
        const lowerMsg = trimmedMsg.toLowerCase();
        const sessionState = getSessionState(sessionId);

        // ═════════════════════════════════════════════════════════════════════
        //  1. DIALOGFLOW ES INTENT & DOMAIN CLASSIFIER
        // ═════════════════════════════════════════════════════════════════════
        let dfResult = null;
        if (isDialogflowConfigured()) {
            try {
                dfResult = await detectDialogflowIntent(trimmedMsg, sessionId, 'en', contexts);
                if (dfResult?.intent) {
                    console.log(`🎯 [Dialogflow Agent] Intent: "${dfResult.intent}" (Confidence: ${dfResult.confidence})`);
                }
            } catch (dfErr) {
                console.warn('Dialogflow error:', dfErr.message);
            }
        }

        // ═════════════════════════════════════════════════════════════════════
        //  2. GEMINI GENERATIVE REASONING (HYBRID BRAIN)
        // ═════════════════════════════════════════════════════════════════════
        // Gemini generates intelligent, human-like answers for any question
        // in Roman Urdu or English, grounded in Pakistani law and LegalLink data.
        if (isGeminiConfigured()) {
            // Check if user specifically requested a strict directory list without asking a question
            const isStrictDirectoryDump = /^(show me ngos|ngos list|lawyers list|browse directory|browse ngos|browse lawyers)$/i.test(trimmedMsg);

            if (!isStrictDirectoryDump) {
                try {
                    let dbNGOs = [];
                    let dbLawyers = [];
                    try {
                        dbNGOs = await NGO.find({ verificationStatus: 'approved' })
                            .select('name city focusAreas phone address servicesOffered')
                            .limit(10);
                        dbLawyers = await Lawyer.find({ verificationStatus: 'approved' })
                            .select('name specialization experience city rating')
                            .limit(10);
                    } catch (dbErr) {
                        console.warn('DB query error for AI context:', dbErr.message);
                    }

                    const geminiReply = await generateGeminiLegalResponse({
                        userMessage: trimmedMsg,
                        chatHistory: sessionState.history || [],
                        liveContext: {
                            ngos: dbNGOs,
                            lawyers: dbLawyers,
                            dfCategory: dfResult?.category || null,
                            dfIntent: dfResult?.intent || null
                        }
                    });

                    if (geminiReply) {
                        // Determine legal category and action
                        let finalCategory = dfResult?.category;
                        if (!finalCategory || dfResult?.isFallback) {
                            if (/divorce|khula|talaq|custody|hizanat|maintenance|nikah/i.test(lowerMsg)) {
                                finalCategory = 'Family Law';
                            } else if (/fir|bail|zamanat|arrest|police|magistrate|crime|420/i.test(lowerMsg)) {
                                finalCategory = 'Criminal Law';
                            } else if (/tenant|rent|kiraya|eviction|landlord|property|qabza/i.test(lowerMsg)) {
                                finalCategory = 'Property Law';
                            } else if (/domestic|violence|marpeet|abuse|shelter|beating/i.test(lowerMsg)) {
                                finalCategory = "Women's Rights";
                            } else if (/salary|wage|tankhwah|job|boss|termination|labor/i.test(lowerMsg)) {
                                finalCategory = 'Labor Law';
                            } else if (/human\s*right|ngo|fundamental/i.test(lowerMsg)) {
                                finalCategory = 'Human Rights';
                            } else {
                                finalCategory = 'General Legal';
                            }
                        }

                        let finalAction = dfResult?.suggestedAction;
                        let finalActionLabel = dfResult?.actionLabel;

                        if (!finalAction) {
                            if (finalCategory === "Human Rights" || finalCategory === "Women's Rights") {
                                finalAction = 'ngo';
                                finalActionLabel = 'Browse Verified NGOs Directory';
                            } else {
                                finalAction = 'lawyers';
                                finalActionLabel = `Consult ${finalCategory} Advocates`;
                            }
                        }

                        // Save in multi-turn history
                        if (!sessionState.history) sessionState.history = [];
                        sessionState.history.push({ role: 'user', content: trimmedMsg });
                        sessionState.history.push({ role: 'model', content: geminiReply });
                        updateSessionState(sessionId, dfResult?.intent || 'hybrid.conversational', finalCategory, finalCategory.toLowerCase());

                        return res.json({
                            reply: geminiReply,
                            category: finalCategory,
                            intent: dfResult?.intent || 'hybrid.gemini_dialogflow',
                            confidence: dfResult?.confidence || 0.95,
                            urgency: dfResult?.urgency || (finalCategory === "Women's Rights" ? 'high' : 'medium'),
                            suggestedAction: finalAction,
                            actionLabel: finalActionLabel,
                            parameters: dfResult?.parameters || {},
                            contexts: dfResult?.contexts || [],
                            source: 'dialogflow_gemini_hybrid'
                        });
                    }
                } catch (geminiError) {
                    console.error('Gemini error, falling back to Dialogflow pipeline:', geminiError.message);
                }
            }
        }

        // ═════════════════════════════════════════════════════════════════════
        //  3. DIALOGFLOW STANDALONE / DIRECTORY TEMPLATE PIPELINE (Secondary)
        // ═════════════════════════════════════════════════════════════════════
        if (dfResult && dfResult.success && !dfResult.isFallback && dfResult.reply) {
            let intentName = dfResult.intent || '';

            // A) Question-Answering FAQs
            if (intentName.startsWith('legal.faq.')) {
                updateSessionState(sessionId, dfResult.intent, dfResult.category, 'faq');
                return res.json({
                    reply: dfResult.reply,
                    category: dfResult.category,
                    intent: dfResult.intent,
                    confidence: dfResult.confidence,
                    urgency: dfResult.urgency,
                    suggestedAction: dfResult.suggestedAction,
                    actionLabel: dfResult.actionLabel,
                    parameters: dfResult.parameters || {},
                    contexts: dfResult.contexts || [],
                    source: 'dialogflow_nlp'
                });
            }

            // B) Specific Human Rights Request
            if (intentName === 'legal.ngo.recommendation' && /(only|strictly|just|solely).*human\s*right/i.test(lowerMsg)) {
                const humanRightsOnlyReply = await buildDynamicNGOResponse('human_rights_only');
                updateSessionState(sessionId, 'legal.ngo.recommendation', 'Human Rights', 'human_rights');
                return res.json({
                    reply: humanRightsOnlyReply,
                    category: "Human Rights",
                    intent: "legal.ngo.recommendation",
                    confidence: dfResult.confidence,
                    urgency: "medium",
                    suggestedAction: "ngo",
                    actionLabel: "Browse Verified NGOs Directory",
                    parameters: { target: "human_rights_ngo" },
                    contexts: [],
                    source: "dialogflow_nlp"
                });
            }

            // C) Lawyer Recommendations
            if (intentName === 'legal.lawyer.recommendation') {
                const lawyerReply = await buildDynamicLawyerResponse(dfResult.category);
                updateSessionState(sessionId, 'legal.lawyer.recommendation', dfResult.category || 'General Legal', 'lawyer_hire');
                return res.json({
                    reply: lawyerReply,
                    category: dfResult.category || "General Legal",
                    intent: dfResult.intent,
                    confidence: dfResult.confidence,
                    urgency: dfResult.urgency,
                    suggestedAction: "lawyers",
                    actionLabel: "Browse Verified Lawyers",
                    parameters: dfResult.parameters || {},
                    contexts: dfResult.contexts || [],
                    source: 'dialogflow_nlp'
                });
            }

            // D) General NGO Recommendations
            if (intentName === 'legal.ngo.recommendation') {
                const ngoReply = await buildDynamicNGOResponse(lowerMsg.includes('human right') ? 'human_rights_only' : 'general');
                updateSessionState(sessionId, 'legal.ngo.recommendation', 'Human Rights & Legal Aid', 'ngo_aid');
                return res.json({
                    reply: ngoReply,
                    category: lowerMsg.includes('human right') ? "Human Rights" : "Human Rights & Legal Aid",
                    intent: dfResult.intent,
                    confidence: dfResult.confidence,
                    urgency: dfResult.urgency,
                    suggestedAction: "ngo",
                    actionLabel: "Browse Verified NGOs Directory",
                    parameters: dfResult.parameters || {},
                    contexts: dfResult.contexts || [],
                    source: 'dialogflow_nlp'
                });
            }

            // Standard intent
            return res.json({
                reply: dfResult.reply,
                category: dfResult.category,
                intent: dfResult.intent,
                confidence: dfResult.confidence,
                urgency: dfResult.urgency,
                suggestedAction: dfResult.suggestedAction,
                actionLabel: dfResult.actionLabel,
                parameters: dfResult.parameters || {},
                contexts: dfResult.contexts || [],
                source: 'dialogflow_nlp'
            });
        }

        // ═════════════════════════════════════════════════════════════════════
        //  2. CONVERSATIONAL FALLBACK & CONTEXT SOLVER (When cloud intent is fallback)
        // ═════════════════════════════════════════════════════════════════════

        // A) SPECIFIC "ONLY HUMAN RIGHTS NGOS" REQUEST
        if (/(only|just|specifically|solely).*human\s*right/i.test(lowerMsg) || /human\s*rights?\s*(only|ngos?\s*only)/i.test(lowerMsg)) {
            const dynamicReply = await buildDynamicNGOResponse('human_rights_only');
            updateSessionState(sessionId, 'legal.ngo.recommendation', 'Human Rights', 'human_rights');
            return res.json({
                reply: dynamicReply,
                category: "Human Rights",
                intent: "legal.ngo.recommendation",
                confidence: 1.0,
                urgency: "medium",
                suggestedAction: "ngo",
                actionLabel: "Browse Verified NGOs Directory",
                parameters: { target: "human_rights_ngo" },
                contexts: [],
                source: "dialogflow_nlp"
            });
        }

        // B) HABEAS CORPUS & POLICE DETENTION QUESTIONS
        if (/habeas\s*corpus/i.test(lowerMsg) || /police.*(picked|arrested|le gayi|pakad|uthaya|illegal\s*detention|without\s*fir|without\s*warrant)/i.test(lowerMsg)) {
            const habeasReply = "If someone has been unlawfully detained by police without an FIR or warrant, here are the immediate constitutional remedies under Pakistani law:\n\n" +
                               "1. **Habeas Corpus Petition (Article 199, Constitution of Pakistan):**\n" +
                               "   • File an urgent Writ Petition before the High Court (or Section 491 CrPC before Sessions Judge).\n" +
                               "   • The court immediately dispatches a Bailiff to raid the police station, recover the detainee, and produce them in court within 24 hours.\n\n" +
                               "2. **Section 22-A / 22-B CrPC Petition:**\n" +
                               "   • File before the Sessions Judge (Ex-Officio Justice of Peace) against the police station for illegal confinement.\n\n" +
                               "3. **Emergency Helplines:**\n" +
                               "   • Ministry of Human Rights Helpline: **1099**\n" +
                               "   • Police Complaint Cell: **1787**\n\n" +
                               "Would you like to connect with a criminal defense advocate to file an urgent Habeas Corpus petition?";

            updateSessionState(sessionId, 'legal.criminal.fir_bail', 'Criminal Law', 'habeas_corpus');
            return res.json({
                reply: habeasReply,
                category: "Criminal Law",
                intent: "legal.criminal.fir_bail",
                confidence: 1.0,
                urgency: "high",
                suggestedAction: "lawyers",
                actionLabel: "Consult Criminal Defense Lawyers",
                parameters: { remedy: "habeas_corpus" },
                contexts: [],
                source: "dialogflow_nlp"
            });
        }

        // C) MULTI-TURN DOCUMENT REQUIREMENTS
        const isDocumentFollowUp = /(documents?|kya\s*documents|kaghat|kaagaz|requirements?).*(need|chahiye|require|for this)/i.test(lowerMsg) ||
                                  /^(what documents|which documents|documents needed|required documents)/i.test(lowerMsg);

        if (isDocumentFollowUp) {
            const isKhulaDocs = /khula|divorce|talaq/i.test(lowerMsg);
            const isCustodyDocs = /custody|hizanat|child|children|minor/i.test(lowerMsg);
            const isBailDocs = /bail|fir|zamanat|arrest/i.test(lowerMsg);
            const isPropertyDocs = /property|tenant|kirayedar|ejectment|eviction|land|qabza/i.test(lowerMsg);

            const resolvedTopic = isKhulaDocs ? 'khula' :
                                 isCustodyDocs ? 'custody' :
                                 isBailDocs ? 'bail' :
                                 isPropertyDocs ? 'property' : (sessionState.activeTopic || 'general');

            let docReply = "";
            let category = "General Legal";
            let action = "lawyers";

            if (resolvedTopic === 'khula') {
                docReply = "To file for Khula in Pakistani Family Court, prepare the following documents:\n" +
                           "1. Original Nikahnama or certified copy from local Union Council\n" +
                           "2. Copy of your CNIC\n" +
                           "3. Two passport-sized photographs\n" +
                           "4. Plaint stating grounds for dissolution under the Dissolution of Muslim Marriages Act 1939\n" +
                           "5. List of witnesses and children's birth certificates (if custody/maintenance is claimed).";
                category = "Family Law";
            } else if (resolvedTopic === 'custody') {
                docReply = "For Child Custody (Hizanat) under the Guardians and Wards Act 1890, you will need:\n" +
                           "1. Children's NADRA Birth Certificates / B-Form copies\n" +
                           "2. Copy of your CNIC\n" +
                           "3. Proof of parentage and marital status (Nikahnama or Divorce deed)\n" +
                           "4. Evidence demonstrating the welfare of the minor (residence suitability, school records)\n" +
                           "5. Guardianship application with supporting affidavit.";
                category = "Family Law";
            } else if (resolvedTopic === 'bail') {
                docReply = "For Pre-Arrest or Post-Arrest Bail under Sections 497/498 CrPC, you will need:\n" +
                           "1. Certified copy of the FIR (First Information Report)\n" +
                           "2. Power of Attorney (Vakalatnama) signed by the accused\n" +
                           "3. Affidavit explaining mala fide police intention or grounds of innocence\n" +
                           "4. Surety bond documents and CNIC copies of local sureties\n" +
                           "5. Accused must be physically present in court for Pre-Arrest bail.";
                category = "Criminal Law";
            } else if (resolvedTopic === 'property') {
                docReply = "For Property & Tenancy Ejectment proceedings, you will need:\n" +
                           "1. Registered Tenancy Agreement / Lease Deed\n" +
                           "2. Copy of written Legal Notice served on the tenant with postal receipt\n" +
                           "3. Proof of default on rent or expiry of tenancy period\n" +
                           "4. Ownership title documents (Fard Malkiat, Registry, or Mutation copy)\n" +
                           "5. Application before the Rent Tribunal under the Punjab Rented Premises Act.";
                category = "Property Law";
            } else {
                docReply = "Standard legal documentation in Pakistan requires:\n" +
                           "1. Valid CNIC copy of the petitioner\n" +
                           "2. Primary evidence (contract, notice, FIR, or deed)\n" +
                           "3. Sworn Affidavit on government stamp paper\n" +
                           "4. Signed Power of Attorney (Vakalatnama) if represented by an advocate.";
            }

            const actionLabel = category === 'Family Law' ? 'Consult Family Lawyers' :
                                category === 'Criminal Law' ? 'Consult Criminal Defense Lawyers' :
                                category === 'Property Law' ? 'Consult Property Lawyers' :
                                `Consult ${category} Advocates`;

            return res.json({
                reply: docReply,
                category: category,
                intent: "legal.procedure.documents",
                confidence: 0.95,
                urgency: "medium",
                suggestedAction: action,
                actionLabel: actionLabel,
                parameters: { topic: resolvedTopic },
                contexts: [],
                source: "dialogflow_nlp"
            });
        }

        // ═════════════════════════════════════════════════════════════════════
        //  3. LOCAL PAKISTANI LEGAL NLP CLASSIFIER (Final Guard)
        // ═════════════════════════════════════════════════════════════════════
        console.log(`🧠 [Local NLP Classifier] Processing query: "${trimmedMsg}"`);
        const nlpResult = classifyLocalNLP(trimmedMsg);

        let finalLocalReply = nlpResult.reply;
        if (nlpResult.intent === 'legal.ngo.recommendation') {
            finalLocalReply = await buildDynamicNGOResponse(lowerMsg.includes('human right') ? 'human_rights_only' : 'general');
        } else if (nlpResult.intent === 'legal.lawyer.recommendation') {
            finalLocalReply = await buildDynamicLawyerResponse();
        }

        return res.json({
            reply: finalLocalReply,
            category: nlpResult.category,
            intent: nlpResult.intent,
            confidence: nlpResult.confidence,
            urgency: nlpResult.urgency,
            suggestedAction: nlpResult.suggestedAction,
            actionLabel: nlpResult.actionLabel,
            parameters: {},
            contexts: [],
            source: 'dialogflow_nlp'
        });

    } catch (error) {
        console.error("❌ NLP Chat Error:", error);
        res.status(500).json({ 
            reply: "Sorry, I encountered an error processing your query. Please try again or browse our verified legal directory directly.",
            error: error.message
        });
    }
});

// ── POST /api/chat/clear ──────────────────────────────────────────────────────
router.post('/clear', (req, res) => {
    const { sessionId = 'default-session' } = req.body;
    sessionMemory.delete(sessionId);
    console.log(`🧹 Chat session and state cleared for ID: ${sessionId}`);
    res.json({ success: true, message: "NLP session reset.", sessionId });
});

// ═════════════════════════════════════════════════════════════════════════════
//  MIZAN v2: streaming answers, instant small talk, saved chats (signed-in only)
// ═════════════════════════════════════════════════════════════════════════════

// Up to 20 messages a minute per signed-in user (or per IP for visitors),
// so nobody can run up the AI bill by flooding the chat.
const mizanLimiter = createRateLimiter({
    windowMs: 60 * 1000,
    max: 20,
    keyFn: (req) => `mizan:${req.ip}`,
    message: (minutes) => `You're sending messages very quickly. Please wait ${minutes} minute${minutes === 1 ? '' : 's'} and try again.`
});

// Reads the login token if there is one, but lets visitors through too
function optionalAuth(req, res, next) {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    if (token) {
        try { req.user = jwt.verify(token, process.env.JWT_SECRET); } catch (e) { req.user = null; }
    }
    next();
}

// Visitors' conversations live only in memory for context, never in the database
const guestMemory = new Map();
function guestHistory(key) {
    const entry = guestMemory.get(key);
    if (entry && Date.now() - entry.at < 2 * 60 * 60 * 1000) return entry.history;
    return [];
}
function saveGuestHistory(key, history) {
    guestMemory.set(key, { at: Date.now(), history: history.slice(-20) });
    if (guestMemory.size > 2000) {
        const oldest = [...guestMemory.entries()].sort((a, b) => a[1].at - b[1].at).slice(0, 500);
        oldest.forEach(([k]) => guestMemory.delete(k));
    }
}

async function lookupName(user) {
    if (!user?.id) return null;
    try {
        const Model = user.role === 'lawyer' ? Lawyer : user.role === 'ngo' ? NGO : user.role === 'user' ? User : null;
        if (!Model) return null;
        const doc = await Model.findById(user.id).select('name').lean();
        return doc?.name || null;
    } catch (e) {
        return null;
    }
}

const makeTitle = (text) => {
    const t = String(text || '').replace(/\s+/g, ' ').trim();
    return t.length > 48 ? `${t.slice(0, 48)}…` : t || 'New conversation';
};

// Rebuild the hidden first-line tag for earlier answers, so the AI keeps the format
const withTag = (m) =>
    m.role === 'model' && m.meta?.kind
        ? `[[${m.meta.kind}|${m.meta.category || 'General'}|${m.meta.urgent ? 'urgent' : 'normal'}|${m.meta.aid ? 'aid' : 'noaid'}]]\n${m.content}`
        : m.content;

const DF_TO_CATEGORY = {
    'family law': 'Family Law', 'criminal law': 'Criminal Law', 'property law': 'Property Law',
    "women's rights": 'Women Rights', 'women rights': 'Women Rights', 'labor law': 'Labor Law',
    'labour law': 'Labor Law', 'human rights': 'Human Rights', 'cyber law': 'Cyber Law', 'civil law': 'Civil Law'
};

const settle = (promise, ms) =>
    promise ? Promise.race([promise.catch(() => null), new Promise((r) => setTimeout(() => r(null), ms))]) : Promise.resolve(null);

/**
 * POST /api/chat/stream  { message, sessionId? }
 * Streams the answer as Server-Sent Events:
 *   start → delta (text pieces) → meta (category, urgency, advocate/NGO cards) → done
 */
router.post('/stream', mizanLimiter, optionalAuth, async (req, res) => {
    const message = String(req.body?.message || '').trim();
    const sessionId = req.body?.sessionId || null;
    if (!message) return res.status(400).json({ error: 'Message is required' });
    if (message.length > 2000) return res.status(400).json({ error: 'Please keep your message under 2000 characters.' });

    res.set({
        'Content-Type': 'text/event-stream; charset=utf-8',
        'Cache-Control': 'no-cache, no-transform',
        Connection: 'keep-alive',
        'X-Accel-Buffering': 'no'
    });
    res.flushHeaders?.();

    let closed = false;
    res.on('close', () => { closed = true; });
    const send = (obj) => { if (!closed) res.write(`data: ${JSON.stringify(obj)}\n\n`); };

    let sentText = false;
    try {
        // ── Who is asking, and what was said before ──
        let session = null;
        let history = [];
        const guestKey = `guest:${sessionId || req.ip}`;
        const namePromise = lookupName(req.user);

        if (req.user?.id) {
            if (sessionId && mongoose.Types.ObjectId.isValid(sessionId)) {
                session = await ChatSession.findOne({ _id: sessionId, owner: req.user.id });
            }
            if (!session) {
                session = new ChatSession({ owner: req.user.id, ownerRole: req.user.role, title: makeTitle(message) });
            }
            history = session.messages.slice(-10).map((m) => ({ role: m.role, content: withTag(m) }));
        } else {
            history = guestHistory(guestKey);
        }

        send({ type: 'start', sessionId: session ? String(session._id) : null, saved: Boolean(session) });

        const userName = await namePromise;
        let replyText = '';
        let meta;

        // ── 1. Greetings and thanks: answer instantly, no AI call ──
        const quick = smallTalkReply(message, userName);
        if (quick) {
            replyText = quick;
            send({ type: 'delta', text: quick });
            sentText = true;
            meta = { kind: 'greeting', category: 'General', urgent: false, aid: false, lawyers: [], ngos: [], source: 'instant' };
        } else {
            if (!isGeminiConfigured()) {
                send({ type: 'error', code: 'unavailable', message: 'AI is not configured' });
                return res.end();
            }

            // ── 2. Dialogflow runs at the same time as the answer (adds no waiting) ──
            const dfPromise = isDialogflowConfigured()
                ? detectDialogflowIntent(message, sessionId || req.ip, 'en', [])
                : null;

            const ctx = await getContextLists(); // cached for 5 minutes

            // ── 3. Stream the answer; hide the first-line tag ──
            let raw = '';
            let tagDone = false;
            for await (const piece of streamMizanReply({
                userMessage: message,
                chatHistory: history,
                liveContext: { ngos: ctx.ngos, lawyers: ctx.lawyers, userName, userRole: req.user?.role }
            })) {
                if (closed) break;
                raw += piece;
                if (!tagDone) {
                    const lead = raw.trimStart();
                    if (lead.startsWith('[[')) {
                        const end = lead.indexOf(']]');
                        if (end === -1 && lead.length < 160) continue; // tag still arriving
                        tagDone = true;
                        const rest = end === -1 ? lead : lead.slice(end + 2).replace(/^[ \t]*\r?\n?/, '');
                        if (rest) { send({ type: 'delta', text: rest }); sentText = true; }
                    } else if (lead.length >= 2 || (lead && lead !== '[')) {
                        tagDone = true;
                        send({ type: 'delta', text: raw });
                        sentText = true;
                    }
                    continue;
                }
                send({ type: 'delta', text: piece });
                sentText = true;
            }

            const parsed = parseReplyTag(raw);
            replyText = parsed.body;

            const dfResult = await settle(dfPromise, 1500);
            if (dfResult?.intent) console.log(`🎯 [Dialogflow] ${dfResult.intent} (${dfResult.confidence})`);
            let category = parsed.category;
            if (category === 'General' && parsed.kind === 'legal' && dfResult?.category) {
                category = DF_TO_CATEGORY[String(dfResult.category).toLowerCase()] || 'General';
            }

            // Earlier user messages help find the city ("I live in Lahore" said before)
            const recentText = [message, ...history.filter((h) => h.role === 'user').map((h) => h.content)].join(' ');
            const suggestions = await getSuggestions({ kind: parsed.kind, category, aid: parsed.aid, text: recentText });

            meta = {
                kind: parsed.kind,
                category,
                urgent: parsed.urgent,
                aid: parsed.aid,
                lawyers: suggestions.lawyers,
                ngos: suggestions.ngos,
                city: suggestions.city,
                source: dfResult ? 'dialogflow_gemini_hybrid' : 'gemini'
            };
        }

        send({ type: 'meta', ...meta });

        // ── 4. Remember the conversation ──
        if (replyText) {
            if (session) {
                // Name the chat after the first real question, not after "salam"
                const hadQuestion = session.messages.some((m) => m.role === 'model' && m.meta?.kind && m.meta.kind !== 'greeting');
                if (meta.kind === 'greeting' && !hadQuestion) session.title = 'New conversation';
                else if (!hadQuestion) session.title = makeTitle(message);
                session.messages.push({ role: 'user', content: message });
                session.messages.push({ role: 'model', content: replyText, meta });
                if (session.messages.length > 200) session.messages = session.messages.slice(-200);
                session.updatedAt = new Date();
                await session.save();
            } else {
                saveGuestHistory(guestKey, [
                    ...history,
                    { role: 'user', content: message },
                    { role: 'model', content: withTag({ role: 'model', content: replyText, meta }) }
                ]);
            }
        }

        send({ type: 'done' });
        res.end();
    } catch (error) {
        console.error('[Mizan stream] error:', error.message);
        send({
            type: 'error',
            code: sentText ? 'interrupted' : 'unavailable',
            message: sentText ? 'The answer was interrupted.' : 'Mizan is not available right now.'
        });
        res.end();
    }
});

// ── Saved conversations (signed-in users only) ──────────────────────────────
router.get('/sessions', authMiddleware, async (req, res) => {
    try {
        const sessions = await ChatSession.find({ owner: req.user.id })
            .select('title updatedAt')
            .sort({ updatedAt: -1 })
            .limit(50)
            .lean();
        res.json({ sessions: sessions.map((s) => ({ id: String(s._id), title: s.title, updatedAt: s.updatedAt })) });
    } catch (error) {
        res.status(500).json({ message: 'Could not load conversations' });
    }
});

router.get('/sessions/:id', authMiddleware, async (req, res) => {
    try {
        if (!mongoose.Types.ObjectId.isValid(req.params.id)) return res.status(404).json({ message: 'Not found' });
        const session = await ChatSession.findOne({ _id: req.params.id, owner: req.user.id }).lean();
        if (!session) return res.status(404).json({ message: 'Not found' });
        res.json({ id: String(session._id), title: session.title, messages: session.messages });
    } catch (error) {
        res.status(500).json({ message: 'Could not load conversation' });
    }
});

router.delete('/sessions/:id', authMiddleware, async (req, res) => {
    try {
        if (!mongoose.Types.ObjectId.isValid(req.params.id)) return res.status(404).json({ message: 'Not found' });
        await ChatSession.deleteOne({ _id: req.params.id, owner: req.user.id });
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ message: 'Could not delete conversation' });
    }
});

module.exports = router;
