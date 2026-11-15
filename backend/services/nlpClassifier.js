/**
 * LegalLink Local NLP Classifier
 * 
 * Provides deterministic NLP intent classification and entity recognition
 * for Pakistani legal domains in English and Roman Urdu.
 * Used when running offline or as fallback for Dialogflow ES.
 */

const LEGAL_INTENTS = [
  // ── NGO Recommendations & Legal Aid ─────────────────────────────────────────
  {
    intent: "legal.ngo.recommendation",
    category: "Human Rights & Legal Aid",
    urgency: "medium",
    suggestedAction: "ngo",
    actionLabel: "Browse Verified NGOs Directory",
    keywords: [
      "recommend ngo", "recommend me some ngo", "recommend me some ngos", "recommend ngos",
      "human rights ngo", "human rights ngos", "free legal aid", "pro bono", "legal aid ngo",
      "women rights ngo", "women rights ngos", "child protection ngo", "ngo recommendation",
      "ngo list", "charitable trust", "hrcp", "aghs", "dastak", "edhi", "kisi ache ngo",
      "ngo chahiye", "muft vakeel", "free legal help"
    ],
    response: "For human rights protection and pro-bono legal aid in Pakistan, you can connect directly with verified NGOs registered on LegalLink or established public interest organizations like the Human Rights Commission of Pakistan (HRCP), AGHS Legal Aid Cell, and Dastak Charitable Trust. They provide free legal representation, emergency counseling, and shelter. You can submit a direct legal aid request through our NGO Directory."
  },

  // ── Lawyer Recommendations ──────────────────────────────────────────────────
  {
    intent: "legal.lawyer.recommendation",
    category: "General Legal",
    urgency: "medium",
    suggestedAction: "lawyers",
    actionLabel: "Browse Verified Lawyers",
    keywords: [
      "recommend lawyer", "recommend me a lawyer", "recommend lawyers", "find me a lawyer",
      "best lawyer", "top advocate", "family lawyer chahiye", "criminal lawyer chahiye",
      "property lawyer chahiye", "vakeel recommend", "achha vakeel", "hire a lawyer",
      "consult lawyer", "bar council advocate"
    ],
    response: "You can browse and connect with Bar Council verified advocates directly through our Lawyers Directory. We offer two tiers: Gold Advocates (experienced lawyers with up to 5 years experience) and Platinum Advocates (senior litigators with 5+ years experience and 50+ cases). You can filter them by city, legal domain, and client ratings, or click the button below to view verified profiles."
  },

  // ── Domestic Violence (Emergency) ───────────────────────────────────────────
  {
    intent: "legal.domestic_violence.emergency",
    category: "Women's Rights",
    urgency: "high",
    suggestedAction: "ngo",
    actionLabel: "Contact Women Rights NGOs",
    keywords: [
      "beat", "marpeet", "beating", "tashaddud", "violence", "abuse", "abusive",
      "susral", "in-laws", "husband beat", "shohar marta", "marta hai", "harassment",
      "kicked me out", "ghar se nikal", "threatened", "jan se marne", "shelter",
      "domestic violence", "gharelo tashaddud", "gharelu", "protection order"
    ],
    response: "This is a serious domestic violence matter requiring immediate legal protection under the Domestic Violence (Prevention and Protection) Act. You are entitled to an emergency Protection Order and Residence Order from the Magistrate Court. We strongly recommend connecting with our verified Pro-Bono Legal Aid NGOs immediately for safe shelter and free legal representation."
  },

  // ── Family Law (Khula Procedure & Documents) ────────────────────────────────
  {
    intent: "legal.procedure.khula_info",
    category: "Family Law",
    urgency: "medium",
    suggestedAction: "lawyers",
    actionLabel: "Consult Family Lawyers",
    keywords: [
      "documents needed for khula", "documents required for khula", "khula documents",
      "how long does khula take", "khula procedure", "khula process", "talaq certificate",
      "union council procedure", "iddat process", "khula lene ka tareeqa", "khula documents chahiye"
    ],
    response: "To file for Khula in a Pakistani Family Court, you will need: 1) Original Nikahnama or certified copy, 2) CNIC copy, 3) 2 passport-size photographs, and 4) Plaint detailing marital breakdown reasons. The court typically completes Khula within 3 to 6 months. After the court decree is granted, notice must be served to the local Union Council under Section 7 of the Muslim Family Laws Ordinance 1961 for the 90-day Iddat period before the final Talaq certificate is issued."
  },

  // ── Family Law (Khula & Divorce General) ─────────────────────────────────────
  {
    intent: "legal.family.khula_divorce",
    category: "Family Law",
    urgency: "medium",
    suggestedAction: "lawyers",
    actionLabel: "Consult Family Lawyers",
    keywords: [
      "khula", "divorce", "talaq", "separation", "dissolution", "shohar", "wife",
      "husband", "nikahnama", "marriage", "haq mehr", "dower", "iddat", "union council",
      "talaq notice", "section 7", "mflo", "muslim family laws", "dusri shadi", "second marriage",
      "shohar talaq nahi de raha", "court se khula"
    ],
    response: "Under the Family Courts Act 1964 and the Dissolution of Muslim Marriages Act 1939, a wife can seek Khula through the Family Court. Following a court decree, notice must be served to the local Union Council under Section 7 of the Muslim Family Laws Ordinance 1961 to make the divorce legally effective."
  },

  // ── Child Custody & Maintenance ─────────────────────────────────────────────
  {
    intent: "legal.family.child_custody",
    category: "Family Law",
    urgency: "high",
    suggestedAction: "lawyers",
    actionLabel: "Consult Child Custody Advocates",
    keywords: [
      "custody", "bachon", "bache", "child", "children", "minor", "kharcha",
      "maintenance", "visitation", "hizanat", "guardians and wards", "guardian",
      "bacha cheen liya", "father not paying", "shohar kharcha nahi deta", "child support"
    ],
    response: "Under the Guardians and Wards Act 1890, child custody (Hizanat) petitions are decided strictly on the 'welfare of the minor'. Mothers generally retain physical custody of minor children, while the father remains the natural guardian responsible for mandatory child maintenance (Kharcha)."
  },

  // ── Criminal Law (Bail & FIR Procedure) ─────────────────────────────────────
  {
    intent: "legal.procedure.bail_fir_info",
    category: "Criminal Law",
    urgency: "high",
    suggestedAction: "lawyers",
    actionLabel: "Consult Criminal Defense Lawyers",
    keywords: [
      "procedure for bail", "how to get bail", "pre arrest bail process", "post arrest bail process",
      "bail documents", "how to lodge fir", "police refuses fir", "justice of peace process",
      "zamanat karwane ka tareeqa", "section 22a petition"
    ],
    response: "For Pre-Arrest Bail (Bail Before Arrest under Section 498 CrPC), an advocate files an application along with an affidavit before the Sessions Judge or High Court demonstrating mala fide police intent or false implication. The accused must appear in court in person. For police refusal to register an FIR for a cognizable offence, you can file a petition under Section 22-A/22-B CrPC before the Sessions Judge (Justice of Peace) to order registration of the FIR."
  },

  // ── Criminal Law (General FIR & Bail) ───────────────────────────────────────
  {
    intent: "legal.criminal.fir_bail",
    category: "Criminal Law",
    urgency: "high",
    suggestedAction: "lawyers",
    actionLabel: "Consult Criminal Defense Lawyers",
    keywords: [
      "fir", "bail", "arrest", "police", "thana", "crpc", "section 498", "section 497",
      "pre arrest", "post arrest", "section 22a", "justice of peace", "fake fir",
      "false case", "420", "fraud", "cheating", "assault", "police harassment", "warrant",
      "chori", "dacoity", "tapaash", "tashadud police"
    ],
    response: "Under the Code of Criminal Procedure (CrPC), you can apply for Pre-Arrest Bail under Section 498 before the Sessions Court or High Court to prevent unlawful arrest. If police refuse to register an FIR for a cognizable offence, a Section 22-A/22-B petition can be filed before the Sessions Judge (Ex-Officio Justice of Peace)."
  },

  // ── Property Law (Tenancy & Possession) ─────────────────────────────────────
  {
    intent: "legal.property.tenant_dispute",
    category: "Property Law",
    urgency: "medium",
    suggestedAction: "lawyers",
    actionLabel: "Consult Property Lawyers",
    keywords: [
      "tenant", "kirayedar", "rent", "landlord", "malik makan", "eviction", "khali nahi kar raha",
      "possession", "qabza", "property", "registry", "intiqal", "fard", "land", "plot",
      "illegal dispossession", "stay order", "dukan", "shop", "rent agreement", "rent tribunal"
    ],
    response: "Under the Punjab Rented Premises Act (and provincial tenancy laws), a landlord must issue a formal written legal notice before filing an ejectment application with the Rent Tribunal. For illegal land grabbing, an expedited complaint can be filed under the Illegal Dispossession Act 2005 before the Sessions Court."
  },

  // ── Labor Law (Unpaid Wages & Termination) ──────────────────────────────────
  {
    intent: "legal.labor.unpaid_wages",
    category: "Labor Law",
    urgency: "medium",
    suggestedAction: "lawyers",
    actionLabel: "Consult Labor Law Advocates",
    keywords: [
      "salary", "tankhwah", "wages", "unpaid", "job", "termination", "fired", "naukri",
      "workplace", "company", "malik", "boss", "gratuity", "provident fund", "severance",
      "payment of wages", "industrial relations", "harassment at workplace", "ombudsperson"
    ],
    response: "Under the Payment of Wages Act 1936 and provincial industrial relations laws, employers cannot unlawfully deduct or delay earned wages or terminate employment without written cause and notice pay. Workplace harassment complaints can be directly lodged with the Federal/Provincial Ombudsperson."
  },

  // ── Legal Document Generator Guidance ───────────────────────────────────────
  {
    intent: "legal.documents.generator_help",
    category: "Legal Documents",
    urgency: "low",
    suggestedAction: "documents",
    actionLabel: "Draft Legal Notice / Affidavit",
    keywords: [
      "affidavit", "legal notice", "power of attorney", "rent agreement format",
      "demand letter", "draft document", "stamp paper", "bayan e halfi"
    ],
    response: "LegalLink includes a built-in Legal Document Generator for Pakistani law. You can generate: 1) Sworn Affidavits (for court, police, or NADRA), 2) Formal Legal Notices (with WHEREAS clauses and 15-day warning), 3) Power of Attorney, 4) Standard Rental Agreements, and 5) Money Demand Letters. Fill in your details and download as a formatted Word Document (DOCX) or print-ready PDF via the Documents tab."
  },

  // ── Platform Guide ──────────────────────────────────────────────────────────
  {
    intent: "legal.platform.how_it_works",
    category: "Platform Guide",
    urgency: "low",
    suggestedAction: null,
    actionLabel: null,
    keywords: [
      "how does legallink work", "how to use this website", "how to submit a case",
      "what is legallink", "kya services hain", "website kaise use karein"
    ],
    response: "LegalLink connects Pakistani citizens with verified legal help in 4 steps: 1) AI Legal Guidance: Chat with me to identify your legal category and statutory rights. 2) Verified Directory: Browse Bar Council verified lawyers or human rights NGOs. 3) Case Management: Submit your case, upload evidence documents, and track court hearing dates and progress in real-time. 4) Document Generation: Draft affidavits, notices, and agreements for free."
  },

  // ── Fees & Costs Info ───────────────────────────────────────────────────────
  {
    intent: "legal.fees.costs_info",
    category: "Fees & Legal Aid",
    urgency: "low",
    suggestedAction: "ngo",
    actionLabel: "Explore Free Legal Aid",
    keywords: [
      "how much does a lawyer cost", "lawyer fees", "is legal aid free", "are ngos free",
      "court fees", "vakeel ki fees", "kitne paise lagenge"
    ],
    response: "LegalLink pricing transparency: 1) NGO Legal Aid: 100% Free / Pro-Bono for eligible citizens facing human rights violations, domestic abuse, or financial hardship. 2) Lawyer Subscriptions: Gold Advocates (up to 5 years experience) and Platinum Advocates (senior litigators with 50+ cases). 3) Document Generation: Completely free on the platform. Court fees and government stamp paper charges vary according to the Court Fees Act 1870."
  },

  // ── Welcome Intent ──────────────────────────────────────────────────────────
  {
    intent: "Default Welcome Intent",
    category: null,
    urgency: "low",
    suggestedAction: null,
    actionLabel: null,
    keywords: [
      "hi", "hello", "salam", "assalam", "aoa", "hey", "madad", "help", "kya kar sakte ho", "guidance"
    ],
    response: "Assalam-o-Alaikum! Welcome to LegalLink AI Assistant. I am your specialized legal assistant for Pakistani law. You can ask your legal questions in English or Roman Urdu, request NGO legal aid, find verified lawyers, or ask about court procedures and legal documents."
  }
];

/**
 * Classifies an incoming text query against Pakistani legal intents
 * using keyword and phrase matching with frequency weighting.
 */
function classifyLocalNLP(text = '') {
  const lower = text.toLowerCase().trim();

  let bestMatch = null;
  let highestScore = 0;

  for (const item of LEGAL_INTENTS) {
    let score = 0;

    for (const kw of item.keywords) {
      if (lower === kw) {
        score += 10; // Exact phrase match
      } else if (lower.includes(kw)) {
        score += kw.split(' ').length * 2; // Longer keyword match gets more weight
      }
    }

    if (score > highestScore) {
      highestScore = score;
      bestMatch = item;
    }
  }

  // If a strong match was found with score >= 2
  if (bestMatch && highestScore >= 2) {
    return {
      reply: bestMatch.response,
      category: bestMatch.category,
      intent: bestMatch.intent,
      confidence: Math.min(1, Math.round((highestScore / 10) * 100) / 100),
      urgency: bestMatch.urgency,
      suggestedAction: bestMatch.suggestedAction,
      actionLabel: bestMatch.actionLabel
    };
  }

  // Fallback response for unclassified queries
  return {
    reply: "I understand you have a legal inquiry. To help you accurately, could you please specify your legal issue? (e.g., family matters like Khula or child custody, criminal cases and bail, property and tenant disputes, domestic violence emergency, or requesting verified lawyer/NGO recommendations).",
    category: null,
    intent: "Default Fallback Intent",
    confidence: 0.2,
    urgency: "low",
    suggestedAction: "lawyers",
    actionLabel: "Browse Verified Legal Directory"
  };
}

module.exports = {
  classifyLocalNLP,
  LEGAL_INTENTS
};
