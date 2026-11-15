import os
import json
import uuid
import zipfile
import shutil

base_dir = os.path.dirname(os.path.abspath(__file__))
agent_dir = os.path.join(base_dir, "dialogflow-agent")
intents_dir = os.path.join(agent_dir, "intents")
entities_dir = os.path.join(agent_dir, "entities")

# Re-create directories cleanly
if os.path.exists(agent_dir):
    shutil.rmtree(agent_dir)

os.makedirs(intents_dir, exist_ok=True)
os.makedirs(entities_dir, exist_ok=True)

# 1. package.json
with open(os.path.join(agent_dir, "package.json"), "w", encoding="utf-8") as f:
    json.dump({"version": "1.0.0"}, f, indent=2)

# 2. agent.json
agent_json = {
    "description": "LegalLink AI - Pakistani Legal Aid and Domain Classifier",
    "language": "en",
    "shortDescription": "Legal NLP Agent for Pakistan Law",
    "examples": "",
    "activeAssistantAgents": [],
    "disableInteractionLogs": False,
    "disableStackdriverLogs": False,
    "googleAssistant": {
        "googleAssistantCompatible": False,
        "welcomeIntentSignInRequired": False,
        "startIntents": [],
        "systemIntents": [],
        "endIntentIds": [],
        "voiceType": "MALE_1",
        "capabilities": [],
        "protocolVersion": "V2",
        "isDeviceAgent": False
    },
    "defaultTimezone": "Asia/Karachi",
    "isPrivate": True,
    "mlMinConfidence": 0.3,
    "supportedLanguages": [],
    "enableOnePlatformApi": True,
    "feedbackSupport": False
}
with open(os.path.join(agent_dir, "agent.json"), "w", encoding="utf-8") as f:
    json.dump(agent_json, f, indent=2)

# 3. Entity: legal_category
entity_id = str(uuid.uuid4())
entity_meta = {
    "id": entity_id,
    "name": "legal_category",
    "isOverridable": True,
    "isEnum": False,
    "isRegexp": False,
    "automatedExpansion": False,
    "allowFulfillmentCommit": False
}
with open(os.path.join(entities_dir, "legal_category.json"), "w", encoding="utf-8") as f:
    json.dump(entity_meta, f, indent=2)

entity_entries = [
    {"value": "Family Law", "synonyms": ["Family Law", "khula", "divorce", "custody", "maintenance", "talaq"]},
    {"value": "Criminal Law", "synonyms": ["Criminal Law", "fir", "bail", "pre arrest", "post arrest", "crpc"]},
    {"value": "Domestic Violence", "synonyms": ["Domestic Violence", "abuse", "beating", "tashaddud", "protection order"]},
    {"value": "Property Law", "synonyms": ["Property Law", "tenant", "rent", "landlord", "eviction", "qabza"]},
    {"value": "Labor Law", "synonyms": ["Labor Law", "wages", "salary", "termination", "job"]}
]
with open(os.path.join(entities_dir, "legal_category_entries_en.json"), "w", encoding="utf-8") as f:
    json.dump(entity_entries, f, indent=2)

# Helper function to generate intent files
def create_intent(name, training_phrases, speech_response, is_fallback=False, action=None, events=None):
    intent_id = str(uuid.uuid4())
    
    # Action names in Dialogflow cannot have whitespace
    if action is None:
        if is_fallback:
            action_name = "input.unknown"
        elif name == "Default Welcome Intent":
            action_name = "input.welcome"
        else:
            action_name = name.replace(" ", "_").lower()
    else:
        action_name = action.replace(" ", "_")

    if events is None:
        if name == "Default Welcome Intent":
            events_list = [{"name": "WELCOME"}]
        else:
            events_list = []
    else:
        events_list = events

    intent_data = {
        "id": intent_id,
        "name": name,
        "auto": True,
        "contexts": [],
        "responses": [
            {
                "resetContexts": False,
                "action": action_name,
                "affectedContexts": [],
                "parameters": [],
                "messages": [
                    {
                        "type": 0,
                        "lang": "en",
                        "speech": speech_response
                    }
                ],
                "defaultResponsePlatforms": {},
                "speech": []
            }
        ],
        "priority": 500000,
        "webhookUsed": False,
        "webhookForSlotFilling": False,
        "fallbackIntent": is_fallback,
        "events": events_list
    }
    
    with open(os.path.join(intents_dir, f"{name}.json"), "w", encoding="utf-8") as f:
        json.dump(intent_data, f, indent=2)

    user_says = []
    for phrase in training_phrases:
        user_says.append({
            "id": str(uuid.uuid4()),
            "data": [
                {
                    "text": phrase,
                    "userDefined": False
                }
            ],
            "isTemplate": False,
            "count": 0,
            "lang": "en",
            "updated": 0
        })

    with open(os.path.join(intents_dir, f"{name}_usersays_en.json"), "w", encoding="utf-8") as f:
        json.dump(user_says, f, indent=2)

# Intent definitions
create_intent(
    "legal.family.khula_divorce",
    [
        "I want to apply for khula from my husband",
        "shohar se khula leni hai process kya hai",
        "how to file for divorce in Pakistan",
        "divorce procedure under Muslim Family Laws",
        "shohar talaq nahi de raha",
        "family court khula procedure",
        "nikahnama me talaq ka haq",
        "talaq notice to union council",
        "dissolution of muslim marriage act",
        "mera shohar doosri shadi kar raha hai baghair ijazat",
        "need legal advice for khula",
        "court marriage divorce procedure"
    ],
    "Under the Family Courts Act 1964 and Dissolution of Muslim Marriages Act 1939, a wife can seek Khula through the Family Court. The court concludes Khula proceedings within 3 to 6 months. Following a court decree, notice must be sent to the local Union Council under Section 7 of the Muslim Family Laws Ordinance 1961 to make the divorce legally effective."
)

create_intent(
    "legal.family.child_custody",
    [
        "who gets custody of children after divorce",
        "bachon ki custody kisko milegi",
        "father is not giving child maintenance",
        "shohar bachon ka kharcha nahi deta",
        "visitation rights for father in Pakistan",
        "guardians and wards act petition",
        "hizanat rights for mother",
        "shohar ne bache cheen liye",
        "child custody age limit in Pakistani law",
        "mother guardianship rights"
    ],
    "Under the Guardians and Wards Act 1890, custody (Hizanat) decisions prioritize the 'welfare of the minor'. Generally, mothers retain physical custody of minor sons and daughters, while fathers remain natural guardians responsible for maintenance (Kharcha). You can file an application for interim maintenance immediately in the Family Court."
)

create_intent(
    "legal.domestic_violence.emergency",
    [
        "my husband beat me and kicked me out",
        "shohar marpeet karta hai bohot",
        "in-laws are harassing and threatening me",
        "susral wale tang kar rahe hain aur marte hain",
        "domestic violence emergency protection",
        "need emergency shelter and legal protection",
        "husband threatened to kill me",
        "gharelo tashaddud se bachao",
        "police is not registering domestic violence complaint",
        "urgent domestic abuse help"
    ],
    "This is a serious domestic violence matter requiring immediate protection under the Domestic Violence (Prevention and Protection) Act. You are entitled to an emergency Protection Order and Residence Order from the Magistrate Court. We strongly recommend reaching out to our verified Pro-Bono Legal Aid NGOs immediately for legal accompaniment and safe shelter."
)

create_intent(
    "legal.criminal.fir_bail",
    [
        "police registered false FIR against me",
        "how to get pre arrest bail in Pakistan",
        "section 498 crpc bail before arrest",
        "police station me FIR darj nahi ho rahi",
        "section 22A 22B petition justice of peace",
        "arrest warrant issued by magistrate",
        "post arrest bail section 497 crpc",
        "someone committed fraud with me 420 case",
        "false criminal case filed by enemy",
        "police harassment without warrant",
        "anticipatory bail procedure"
    ],
    "Under the Code of Criminal Procedure (CrPC), you can apply for Pre-Arrest Bail under Section 498 before the Sessions Court or High Court to prevent unlawful detention. If the police refuse to register an FIR for a cognizable offence, you can file a Section 22-A/22-B petition before the Ex-Officio Justice of Peace (Sessions Judge)."
)

create_intent(
    "legal.property.tenant_dispute",
    [
        "tenant is not paying rent and refusing to leave",
        "kirayedar dukan khali nahi kar raha",
        "landlord illegally locked my house",
        "property registry verify kaise karein",
        "illegal dispossession act complaint",
        "land grabbing qabza group issue",
        "rent agreement expired eviction notice",
        "plot registry fake documents fraud",
        "stay order on property dispute",
        "shop tenant dispute rent tribunal"
    ],
    "Under the Punjab Rented Premises Act (or provincial tenancy laws), landlords must serve a written legal notice before filing an ejectment petition before the Rent Tribunal. For illegal land grabbing, a direct complaint lies under the Illegal Dispossession Act 2005 before the Court of Sessions with expedited proceedings."
)

create_intent(
    "legal.labor.unpaid_wages",
    [
        "company is not paying my salary for months",
        "malik ne tankhwah rok li hai",
        "wrongful termination from job without notice",
        "service matter grievance petition",
        "workplace harassment complaint ombudsperson",
        "payment of wages act claim",
        "provident fund and gratuity not given",
        "company terminated me without reason",
        "unlawful dismissal labor court"
    ],
    "Under the Payment of Wages Act 1936 and provincial industrial relations legislation, employers cannot unlawfully withhold earned wages or terminate employment without written cause and notice pay. For workplace harassment, you can file an immediate complaint before the Federal or Provincial Ombudsperson under the 2010 Protection Act."
)

create_intent(
    "Default Welcome Intent",
    [
        "hi", "hello", "assalam o alaikum", "aoa", "salam", "hey", "help", "need legal help", "madad chahiye", "start"
    ],
    "Assalam-o-Alaikum! Welcome to LegalLink AI. I am your specialized legal assistant for Pakistani law. You can ask your legal questions in English or Roman Urdu (e.g., family disputes, property issues, criminal matters, or domestic violence)."
)

create_intent(
    "Default Fallback Intent",
    [],
    "I could not identify the specific legal statute for your query. Please provide more details or specify whether your case relates to Family Law, Criminal Law, Property Law, or Domestic Violence.",
    is_fallback=True
)

# 4. Create ZIP with Unix-style forward slashes '/'
zip_output_path = os.path.join(base_dir, "LegalLink_Dialogflow_Agent.zip")
if os.path.exists(zip_output_path):
    os.remove(zip_output_path)

with zipfile.ZipFile(zip_output_path, "w", zipfile.ZIP_DEFLATED) as zipf:
    for root, dirs, files in os.walk(agent_dir):
        for file in files:
            full_path = os.path.join(root, file)
            rel_path = os.path.relpath(full_path, agent_dir)
            # CRITICAL: Forward slash is required by Linux/Dialogflow
            archive_name = rel_path.replace("\\", "/")
            zipf.write(full_path, archive_name)

print("ZIP created successfully at:", zip_output_path)
