const fs = require('fs');
const path = require('path');

const targetDir = path.resolve(__dirname, 'dialogflow-agent');
const intentsDir = path.join(targetDir, 'intents');

// Ensure directories exist
fs.mkdirSync(intentsDir, { recursive: true });

// 1. package.json
fs.writeFileSync(path.join(targetDir, 'package.json'), JSON.stringify({
  version: "1.0.0"
}, null, 2));

// 2. agent.json
fs.writeFileSync(path.join(targetDir, 'agent.json'), JSON.stringify({
  description: "LegalLink AI - Pakistani Legal Aid and Domain Classifier Agent",
  language: "en",
  shortDescription: "Legal NLP Agent for Pakistan Law",
  examples: "",
  activeAssistantAgents: [],
  disableInteractionLogs: false,
  disableStackdriverLogs: false,
  googleAssistant: {
    googleAssistantCompatible: false
  },
  defaultTimezone: "Asia/Karachi",
  isPrivate: true,
  mlMinConfidence: 0.3,
  supportedLanguages: [],
  enableOnePlatformApi: true,
  feedbackSupport: false
}, null, 2));

// Helper to write an intent
function writeIntent({ name, trainingPhrases, responseText }) {
  const intentData = {
    name: name,
    auto: true,
    contexts: [],
    responses: [
      {
        resetContexts: false,
        action: name,
        affectedContexts: [],
        parameters: [],
        messages: [
          {
            type: 0,
            lang: "en",
            speech: responseText
          }
        ],
        defaultResponsePlatforms: {},
        speech: []
      }
    ],
    priority: 500000,
    webhookUsed: false,
    webhookForSlotFilling: false,
    fallbackIntent: false,
    events: []
  };

  fs.writeFileSync(path.join(intentsDir, `${name}.json`), JSON.stringify(intentData, null, 2));

  const userSays = trainingPhrases.map((phrase, idx) => ({
    id: `phrase-${idx}`,
    data: [
      {
        text: phrase,
        userDefined: false
      }
    ],
    isTemplate: false,
    count: 0,
    updated: 0
  }));

  fs.writeFileSync(path.join(intentsDir, `${name}_usersays_en.json`), JSON.stringify(userSays, null, 2));
}

// ── INTENT 1: Family Law (Khula & Divorce) ──────────────────────────
writeIntent({
  name: "legal.family.khula_divorce",
  trainingPhrases: [
    "I want to apply for khula from my husband",
    "shohar se khula leni hai process kya hai",
    "how to file for divorce in Pakistan",
    "divorce procedure under Muslim Family Laws",
    "shohar talaq nahi de raha",
    "family court khula procedure",
    "nikahnama me talaq ka haq",
    "talaq notice to union council",
    "dissolution of muslim marriage act",
    "mera shohar doosri shadi kar raha hai baghair ijazat"
  ],
  responseText: "Under the Family Courts Act 1964 and Dissolution of Muslim Marriages Act 1939, a wife can seek Khula through the Family Court. The court typically concludes Khula proceedings within 3 to 6 months. Following a court decree, notice must be sent to the local Union Council under Section 7 of the Muslim Family Laws Ordinance 1961 to make the divorce legally effective."
});

// ── INTENT 2: Child Custody & Maintenance ───────────────────────────
writeIntent({
  name: "legal.family.child_custody",
  trainingPhrases: [
    "who gets custody of children after divorce",
    "bachon ki custody kisko milegi",
    "father is not giving child maintenance",
    "shohar bachon ka kharcha nahi deta",
    "visitation rights for father in Pakistan",
    "guardians and wards act petition",
    "hizanat rights for mother",
    "shohar ne bache cheen liye",
    "child custody age limit in Pakistani law"
  ],
  responseText: "Under the Guardians and Wards Act 1890, custody (Hizanat) decisions prioritize the 'welfare of the minor'. Generally, mothers retain physical custody of sons until age 7 and daughters until puberty, while fathers remain natural guardians responsible for maintenance (Kharcha). You can file an application for interim maintenance immediately in the Family Court."
});

// ── INTENT 3: Domestic Violence & Emergency ─────────────────────────
writeIntent({
  name: "legal.domestic_violence.emergency",
  trainingPhrases: [
    "my husband beat me and kicked me out",
    "shohar marpeet karta hai bohot",
    "in-laws are harassing and threatening me",
    "susral wale tang kar rahe hain aur marte hain",
    "domestic violence emergency protection",
    "need emergency shelter and legal protection",
    "husband threatened to kill me",
    "gharelo tashaddud se bachao",
    "police is not registering domestic violence complaint"
  ],
  responseText: "This is a serious domestic violence matter requiring immediate protection under the Domestic Violence (Prevention and Protection) Act. You are entitled to an emergency Protection Order and Residence Order from the Magistrate Court. We strongly recommend reaching out to our verified Pro-Bono Legal Aid NGOs immediately for legal accompaniment and safe shelter."
});

// ── INTENT 4: Criminal Law (FIR & Bail) ──────────────────────────────
writeIntent({
  name: "legal.criminal.fir_bail",
  trainingPhrases: [
    "police registered false FIR against me",
    "how to get pre arrest bail in Pakistan",
    "section 498 crpc bail before arrest",
    "police station me FIR darj nahi ho rahi",
    "section 22A 22B petition justice of peace",
    "arrest warrant issued by magistrate",
    "post arrest bail section 497 crpc",
    "someone committed fraud with me 420 case",
    "false criminal case filed by enemy",
    "police harassment without warrant"
  ],
  responseText: "Under the Code of Criminal Procedure (CrPC), you can apply for Pre-Arrest Bail under Section 498 before the Sessions Court or High Court to prevent unlawful detention. If the police refuse to register an FIR for a cognizable offence, you can file a Section 22-A/22-B petition before the Ex-Officio Justice of Peace (Sessions Judge)."
});

// ── INTENT 5: Property & Tenant Disputes ────────────────────────────
writeIntent({
  name: "legal.property.tenant_dispute",
  trainingPhrases: [
    "tenant is not paying rent and refusing to leave",
    "kirayedar dukan khali nahi kar raha",
    "landlord illegally locked my house",
    "property registry verify kaise karein",
    "illegal dispossession act complaint",
    "land grabbing qabza group issue",
    "rent agreement expired eviction notice",
    "plot registry fake documents fraud",
    "stay order on property dispute"
  ],
  responseText: "Under the Punjab Rented Premises Act (or provincial tenancy laws), landlords must serve a written legal notice before filing an ejectment petition before the Rent Tribunal. For illegal land grabbing, a direct complaint lies under the Illegal Dispossession Act 2005 before the Court of Sessions with expedited proceedings."
});

// ── INTENT 6: Labor & Employment Law ────────────────────────────────
writeIntent({
  name: "legal.labor.unpaid_wages",
  trainingPhrases: [
    "company is not paying my salary for months",
    "malik ne tankhwah rok li hai",
    "wrongful termination from job without notice",
    "service matter grievance petition",
    "workplace harassment complaint ombudsperson",
    "payment of wages act claim",
    "provident fund and gratuity not given",
    "company terminated me without reason"
  ],
  responseText: "Under the Payment of Wages Act 1936 and provincial industrial relations legislation, employers cannot unlawfully withhold earned wages or terminate employment without written cause and notice pay. For workplace harassment, you can file an immediate complaint before the Federal or Provincial Ombudsperson under the 2010 Protection Act."
});

// ── INTENT 7: Default Welcome Intent ────────────────────────────────
writeIntent({
  name: "Default Welcome Intent",
  trainingPhrases: [
    "hi", "hello", "assalam o alaikum", "aoa", "salam", "hey", "help", "need legal help", "madad chahiye"
  ],
  responseText: "Assalam-o-Alaikum! Welcome to LegalLink AI. I am your specialized legal assistant for Pakistani law. You can ask your legal questions in English or Roman Urdu (e.g., family disputes, property issues, criminal matters, or domestic violence)."
});

// ── INTENT 8: FAQ Police Arrest Without FIR ───────────────────────
writeIntent({
  name: "legal.faq.police_arrest_without_fir",
  trainingPhrases: [
    "can police arrest me without FIR",
    "can police arrest without warrant in Pakistan",
    "kya police bina FIR ke arrest kar sakti hai",
    "is arrest legal without registration of FIR",
    "police took my brother without FIR or warrant"
  ],
  responseText: "Generally, No. Under Pakistani law (Section 154 CrPC), police cannot arrest or detain a person without registering an FIR or obtaining a court warrant, except in cases of serious cognizable offences committed directly in their presence. Even in cognizable arrests, Article 10 of the Constitution of Pakistan mandates that the detained person must be informed of grounds and produced before a judicial magistrate within 24 hours. Unlawful police detention is illegal and can be challenged through an urgent Habeas Corpus petition before the High Court."
});

// ── INTENT 9: FAQ Husband Deny Khula ────────────────────────────────
writeIntent({
  name: "legal.faq.husband_deny_khula",
  trainingPhrases: [
    "can my husband refuse khula",
    "does husband have to agree for khula",
    "kya shohar khula rok sakta hai",
    "shohar khula nahi de raha to kya hoga",
    "can wife get khula without husband consent"
  ],
  responseText: "No, the husband cannot stop a Khula. Under the Family Courts Act 1964 and Supreme Court of Pakistan landmark precedents, Khula is an unconditional judicial right of the wife. Even if the husband vehemently refuses, fails to appear in court, or refuses to sign, the Family Court Judge will still grant the Khula decree based on irrevocable marital breakdown. His consent is not required by the court."
});

// ── INTENT 10: FAQ Father Child Custody ─────────────────────────────
writeIntent({
  name: "legal.faq.father_take_custody",
  trainingPhrases: [
    "can father take custody of 3 year old child",
    "can father take baby from mother in Pakistan",
    "kya baap chote bachay ko zabardasti le sakta hai",
    "can mother keep custody of infant child",
    "father snatching child custody legal"
  ],
  responseText: "Generally, No. Under Pakistani family law (Guardians and Wards Act 1890 and Hanafi Islamic jurisprudence), the mother has the presumptive legal right of physical custody (Hizanat) of a male child up to the age of 7 years, and a female child until puberty. The father cannot forcibly take custody of young children from the mother. The father remains the natural guardian responsible for paying child maintenance (Kharcha), but physical custody remains with the mother unless the court finds her disqualified on severe welfare grounds."
});

// ── INTENT 11: FAQ Landlord Evict Without Notice ─────────────────────
writeIntent({
  name: "legal.faq.landlord_evict_without_notice",
  trainingPhrases: [
    "can landlord evict me without notice",
    "can landlord lock my shop without notice",
    "kya malik makan bina notice ghar khali karwa sakta hai",
    "landlord cut electricity and water supply",
    "illegal eviction by landlord Pakistan"
  ],
  responseText: "No. Under the Punjab Rented Premises Act (and provincial tenancy laws across Pakistan), a landlord CANNOT evict a tenant, lock the property, or disconnect utilities on their own. Forcible self-help eviction is strictly illegal. The landlord must serve a formal written legal notice and file an eviction application before the Rent Tribunal. If a landlord locks your premises unlawfully, you can file an immediate petition before the Rent Tribunal or local police for restoration of possession."
});

// ── INTENT 12: FAQ NGO Free Legal Aid ────────────────────────────────
writeIntent({
  name: "legal.faq.ngo_free_aid",
  trainingPhrases: [
    "do NGOs charge money for legal aid",
    "is legal aid free in Pakistan",
    "kya NGO muft wakeel deti hai",
    "fee of pro bono human rights NGO"
  ],
  responseText: "Yes, legal aid provided by registered Human Rights NGOs (such as HRCP, AGHS Legal Aid Cell, LAS, and Dastak) is 100% free for deserving citizens, women, children, and low-income individuals. They do not charge legal fees or consultation fees for genuine pro-bono cases."
});

// ── INTENT 13: FAQ Pre-Arrest Bail ──────────────────────────────────
writeIntent({
  name: "legal.faq.pre_arrest_bail",
  trainingPhrases: [
    "can I get bail before being arrested",
    "kya giraftari se pehle zamanat ho sakti hai",
    "is pre arrest bail possible in Pakistan",
    "how to prevent arrest in false FIR",
    "section 498 crpc pre arrest bail conditions"
  ],
  responseText: "Yes! Under Section 498 CrPC, you can apply for Pre-Arrest Bail before the Sessions Court or High Court if a false FIR has been registered or is imminent with ulterior motives. If granted interim pre-arrest bail, police cannot arrest you."
});

// ── INTENT 14: FAQ Father Child Maintenance ─────────────────────────
writeIntent({
  name: "legal.faq.father_child_maintenance",
  trainingPhrases: [
    "does father have to pay child maintenance after divorce",
    "is father responsible for child maintenance in Pakistan",
    "kya talaq ke baad baap bachon ka kharcha dega",
    "shohar bachon ka kharcha dene ka paband hai",
    "can father refuse to pay child support",
    "kya baap bachon ka kharcha rok sakta hai",
    "can mother claim child maintenance from ex husband"
  ],
  responseText: "Yes, absolutely. Under Section 9 of the Muslim Family Laws Ordinance 1961 and binding Supreme Court precedents, a father has an absolute, non-negotiable statutory obligation to provide maintenance (Kharcha-e-Naan-o-Nafaqah) for his minor children. This legal duty applies until sons attain majority (18 years) and daughters get married, regardless of whether custody is with the mother or whether divorce occurred by Khula. If the father refuses or defaults, the Family Court can order interim maintenance, attach his salary/bank accounts, or issue civil jail arrest warrants."
});

// ── INTENT 15: FAQ Verbal Talaq ─────────────────────────────────────
writeIntent({
  name: "legal.faq.verbal_talaq",
  trainingPhrases: [
    "is verbal talaq valid in Pakistan",
    "does oral talaq work without paperwork",
    "kya zubani talaq ho jati hai",
    "shohar ne zubani 3 bar talaq bol diya",
    "is written notice mandatory for divorce in Pakistan",
    "without union council certificate is divorce valid"
  ],
  responseText: "Under Section 7 of the Muslim Family Laws Ordinance 1961, any pronouncement of Talaq (even if verbally pronounced three times) MUST be notified in writing to the Chairman of the local Union Council / Arbitration Council, with a copy dispatched to the wife via registered mail. Talaq does NOT become legally effective until 90 days after formal receipt of this written notice by the Union Council, during which mandatory reconciliation proceedings are held. Without the official NADRA / Union Council Talaq Certificate, parties remain legally married in the eyes of Pakistani statutory law."
});

// ── INTENT 16: FAQ Woman Marriage Without Wali ───────────────────────
writeIntent({
  name: "legal.faq.woman_marriage_without_wali",
  trainingPhrases: [
    "can a woman marry without wali in Pakistan",
    "can adult girl marry without parent permission",
    "court marriage without wali legal in Pakistan",
    "kya larki bina wali ki marzi ke shadi kar sakti hai",
    "is parent consent required for court marriage"
  ],
  responseText: "Yes. Under Pakistani civil and Islamic family law (affirmed by the Supreme Court in the landmark Hafiz Abdul Waheed v. Asma Jahangir case and Federal Shariat Court jurisprudence), an adult, sane Muslim woman who has attained puberty/majority has the full autonomous legal right to contract a valid marriage of her own free will without requiring the permission, presence, or consent of a Wali (father/guardian). Any forced marriage or restraint is a criminal offence under Section 498-B of the Pakistan Penal Code."
});

// ── INTENT 17: FAQ Landlord Rent Increase ────────────────────────────
writeIntent({
  name: "legal.faq.landlord_rent_increase",
  trainingPhrases: [
    "can landlord increase rent anytime",
    "how much rent can landlord increase in Pakistan",
    "kya malik makan har saal kiraya barha sakta hai",
    "landlord demanding double rent suddenly",
    "rent increase rules under rent restriction act"
  ],
  responseText: "No, a landlord cannot increase rent arbitrarily or at will. Under the Punjab Rented Premises Act 2009 (and provincial tenancy laws across Sindh, KP, and ICT), rent can only be increased strictly according to the agreed terms in the registered tenancy agreement. If no specific escalation clause was stipulated, provincial laws generally restrict increases up to an automatic statutory cap (typically 25% every three years upon lease renewal). A landlord cannot demand unjustified sudden increments or harass a tenant for higher rent."
});

// ── INTENT 18: Default Fallback Intent ───────────────────────────────
const fallbackData = {
  name: "Default Fallback Intent",
  auto: true,
  contexts: [],
  responses: [
    {
      resetContexts: false,
      action: "input.unknown",
      affectedContexts: [],
      parameters: [],
      messages: [
        {
          type: 0,
          lang: "en",
          speech: "I could not identify the specific legal statute for your query. Let me connect you with our legal analysis engine for detailed assistance, or you can browse our verified legal practitioners."
        }
      ],
      defaultResponsePlatforms: {},
      speech: []
    }
  ],
  priority: 500000,
  webhookUsed: false,
  webhookForSlotFilling: false,
  fallbackIntent: true,
  events: []
};

fs.writeFileSync(path.join(intentsDir, 'Default Fallback Intent.json'), JSON.stringify(fallbackData, null, 2));

console.log('✅ Dialogflow Agent package generated successfully at:', targetDir);
