# Dialogflow ES Setup Guide for LegalLink

This guide walks you through connecting your **Google Cloud Dialogflow ES Agent** to **LegalLink** in under 5 minutes using the pre-built Agent ZIP package.

---

## 1. Quick Architecture Overview

LegalLink uses a **Hybrid Enterprise NLP Architecture**:
1. **Dialogflow ES (Primary Engine):** 
   - Classifies Pakistani legal domains (*Family Law, Criminal Law, Property Law, Labor Law, Domestic Violence*).
   - Accurately matches legal intents from user queries in both **English** and **Roman Urdu** (e.g., *"shohar se khula leni hai"*, *"kirayedar dukan khali nahi kar raha"*).
   - Extracts legal category, urgency level, and suggested action (Lawyer vs NGO).
2. **Google Gemini (Fallback Engine):**
   - Automatically kicks in if a query is open-ended or falls outside the standard legal intents.
   - Ensures the chatbot **never breaks or fails to answer**.

---

## 2. Step-by-Step Setup in Dialogflow Console

### Step 1: Create the Agent
1. Go to the [Dialogflow ES Console](https://dialogflow.cloud.google.com/).
2. Sign in with your Google Account.
3. Click on the agent dropdown in the left menu and click **"Create new agent"**.
4. Name your agent: `LegalLink-AI`.
5. Set Default Language to **English - en**.
6. Set Default Timezone to **(GMT+5:00) Asia/Karachi**.
7. Click **"Create"**.

---

### Step 2: Import the Pre-Built LegalLink Intents (1-Click Restore)
We have generated the complete Pakistani legal agent with all intents, training phrases, and legal statutory references in:
`docs/LegalLink_Dialogflow_Agent.zip`

1. In the Dialogflow Console, click the **Settings ⚙️ (Gear Icon)** next to your agent name.
2. Go to the **"Export and Import"** tab.
3. Click **"RESTORE FROM ZIP"**.
4. Select or upload the file: `docs/LegalLink_Dialogflow_Agent.zip`.
5. Type `RESTORE` in the confirmation box and click **Restore**.
6. Click **Done**. Your agent will now have all Pakistani legal intents pre-trained!

---

### Step 3: Get Google Cloud Service Account Credentials
1. In the Dialogflow agent **Settings ⚙️**, under the **General** tab, find **Project ID** (e.g. `legallink-ai-12345`). Note this down.
2. Click on the **Project ID** link — this opens Google Cloud Console for this project.
3. In Google Cloud Console, open the navigation menu $\rightarrow$ **IAM & Admin** $\rightarrow$ **Service Accounts**.
4. Click **"+ CREATE SERVICE ACCOUNT"**.
   - Name: `dialogflow-client`
   - Role: **Dialogflow API Client** (or **Dialogflow Admin**)
5. Click **Done**.
6. In the service accounts list, click the three dots ⋮ on your new service account $\rightarrow$ **Manage keys**.
7. Click **ADD KEY** $\rightarrow$ **Create new key** $\rightarrow$ select **JSON** $\rightarrow$ **Create**.
8. A `.json` file will download to your computer.

---

### Step 4: Configure `backend/.env`
Place the downloaded JSON file into your `backend/` folder (e.g., as `backend/dialogflow-key.json`).

Then open `backend/.env` and add:

```env
# Dialogflow Configuration
DIALOGFLOW_PROJECT_ID=your-google-cloud-project-id
GOOGLE_APPLICATION_CREDENTIALS=dialogflow-key.json
```

*(Alternatively, you can provide inline credentials without saving a file:)*
```env
DIALOGFLOW_PROJECT_ID=your-google-cloud-project-id
DIALOGFLOW_CLIENT_EMAIL=dialogflow-client@your-project.iam.gserviceaccount.com
DIALOGFLOW_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nYourPrivateKeyHere\n-----END PRIVATE KEY-----\n"
```

---

## 3. Testing the Integration

1. Start your backend:
   ```cmd
   cd backend
   npm run dev
   ```
2. Check your NLP status in your browser or Postman:
   `GET http://localhost:5000/api/chat/status`
   
   Response:
   ```json
   {
     "dialogflowConfigured": true,
     "geminiConfigured": true,
     "primaryEngine": "Dialogflow ES",
     "supportedLanguages": ["English", "Roman Urdu"]
   }
   ```
3. Open `http://localhost:3000/chatbot` and type:
   - *"I want to apply for khula from my husband"*
   - or in Roman Urdu: *"kirayedar dukan khali nahi kar raha"*
4. Notice the badge: `⚡ Dialogflow NLP`, the extracted category badge, and the direct action buttons to consult verified lawyers or request NGO aid!
