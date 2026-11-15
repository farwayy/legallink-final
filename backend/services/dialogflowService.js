const path = require('path');
const fs = require('fs');
const dotenv = require('dotenv');

// Explicitly ensure .env from backend directory is loaded
dotenv.config({ path: path.join(__dirname, '../.env') });

let dialogflow = null;
let sessionClient = null;
let isConfigured = false;
let configuredProjectId = null;
let credentialsType = 'none';
let lastInitError = null;

// Attempt to load the @google-cloud/dialogflow library safely
try {
  dialogflow = require('@google-cloud/dialogflow');
} catch (err) {
  console.warn('[Dialogflow] @google-cloud/dialogflow package is not yet installed or accessible.');
  lastInitError = err.message;
}

/**
 * Initializes Dialogflow session client if credentials and project ID are available.
 */
function initSessionClient() {
  if (!dialogflow) return null;

  dotenv.config({ path: path.join(__dirname, '../.env') });
  let projectId = process.env.DIALOGFLOW_PROJECT_ID;

  // 1. Check if a service account key file path is provided via GOOGLE_APPLICATION_CREDENTIALS
  if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    const rawPath = process.env.GOOGLE_APPLICATION_CREDENTIALS.trim();
    const candidatePaths = [
      path.isAbsolute(rawPath) ? rawPath : null,
      path.resolve(__dirname, '..', rawPath),
      path.resolve(process.cwd(), rawPath),
      path.resolve(process.cwd(), 'backend', rawPath)
    ].filter(Boolean);

    let resolvedKeyPath = null;
    for (const p of candidatePaths) {
      if (fs.existsSync(p)) {
        resolvedKeyPath = p;
        break;
      }
    }

    if (resolvedKeyPath) {
      try {
        const fileContent = fs.readFileSync(resolvedKeyPath, 'utf8');
        const keyData = JSON.parse(fileContent);

        if (!projectId && keyData.project_id) {
          projectId = keyData.project_id;
        }

        sessionClient = new dialogflow.SessionsClient({ keyFilename: resolvedKeyPath });
        isConfigured = true;
        configuredProjectId = projectId;
        credentialsType = 'service_account_file';
        lastInitError = null;
        console.log(`✅ [Dialogflow] Connected using keyfile (${path.basename(resolvedKeyPath)}) for project: ${configuredProjectId}`);
        return sessionClient;
      } catch (err) {
        lastInitError = err.message;
        console.error('❌ [Dialogflow] Failed to initialize with keyFilename:', err.message);
      }
    } else {
      lastInitError = `Key file specified in GOOGLE_APPLICATION_CREDENTIALS not found: "${rawPath}"`;
      console.warn(`⚠️ [Dialogflow] ${lastInitError}`);
    }
  }

  // 2. Check inline credentials
  if (process.env.DIALOGFLOW_CLIENT_EMAIL && process.env.DIALOGFLOW_PRIVATE_KEY) {
    try {
      const privateKey = process.env.DIALOGFLOW_PRIVATE_KEY
        .replace(/\\n/g, '\n')
        .replace(/\r\n/g, '\n');

      sessionClient = new dialogflow.SessionsClient({
        credentials: {
          client_email: process.env.DIALOGFLOW_CLIENT_EMAIL.trim(),
          private_key: privateKey
        }
      });
      isConfigured = true;
      configuredProjectId = projectId;
      credentialsType = 'inline_credentials';
      lastInitError = null;
      console.log(`✅ [Dialogflow] Connected using inline credentials for project: ${configuredProjectId}`);
      return sessionClient;
    } catch (err) {
      lastInitError = err.message;
      console.error('❌ [Dialogflow] Failed to initialize with inline credentials:', err.message);
    }
  }

  // 3. Fallback: ADC
  if (projectId) {
    try {
      sessionClient = new dialogflow.SessionsClient();
      isConfigured = true;
      configuredProjectId = projectId;
      credentialsType = 'application_default_credentials';
      lastInitError = null;
      console.log(`✅ [Dialogflow] Connected using ADC for project: ${configuredProjectId}`);
      return sessionClient;
    } catch (err) {
      lastInitError = err.message;
      return null;
    }
  }

  isConfigured = false;
  return null;
}

initSessionClient();

/**
 * Recursively unwrap a protobuf Struct into plain JavaScript object.
 */
function unwrapValue(val) {
  if (val === null || val === undefined) return null;
  if (val.kind === 'stringValue') return val.stringValue;
  if (val.kind === 'numberValue') return val.numberValue;
  if (val.kind === 'boolValue') return val.boolValue;
  if (val.kind === 'structValue') return unwrapStruct(val.structValue);
  if (val.kind === 'listValue') {
    return (val.listValue.values || []).map(unwrapValue);
  }
  if (typeof val === 'object' && val.fields) {
    return unwrapStruct(val);
  }
  return val;
}

function unwrapStruct(struct) {
  if (!struct) return {};
  const fields = struct.fields || struct;
  const result = {};
  for (const key of Object.keys(fields)) {
    const val = fields[key];
    result[key] = val && typeof val === 'object' && val.kind ? unwrapValue(val) : val;
  }
  return result;
}

/**
 * Maps a Dialogflow intent name to a standardized LegalLink category, urgency, and action.
 */
function mapIntentToLegalCategory(intentName = '') {
  const lower = intentName.toLowerCase();

  // 1. NGO Recommendations / Pro Bono Legal Aid
  if (
    lower.includes('ngo.recommendation') ||
    lower.includes('ngo_recommendation') ||
    lower.includes('ngo_free_aid') ||
    lower.includes('legal.ngo')
  ) {
    return {
      category: "Human Rights & Legal Aid",
      urgency: 'medium',
      suggestedAction: 'ngo',
      actionLabel: 'Browse Verified NGOs Directory'
    };
  }

  // 2. Lawyer Recommendations
  if (
    lower.includes('lawyer.recommendation') ||
    lower.includes('lawyer_recommendation') ||
    lower.includes('legal.lawyer')
  ) {
    return {
      category: "General Legal",
      urgency: 'medium',
      suggestedAction: 'lawyers',
      actionLabel: 'Browse Verified Lawyers'
    };
  }

  // 3. Document Generator Help
  if (lower.includes('documents.generator') || lower.includes('document_generator')) {
    return {
      category: "Legal Documents",
      urgency: 'low',
      suggestedAction: 'documents',
      actionLabel: 'Draft Legal Notice / Affidavit'
    };
  }

  // 4. Platform Help
  if (lower.includes('platform.how_it_works') || lower.includes('how_it_works')) {
    return {
      category: "Platform Guide",
      urgency: 'low',
      suggestedAction: null,
      actionLabel: null
    };
  }

  // 5. Fees & Costs Info
  if (lower.includes('fees.costs') || lower.includes('fees_info')) {
    return {
      category: "Fees & Legal Aid",
      urgency: 'low',
      suggestedAction: 'ngo',
      actionLabel: 'Explore Free Legal Aid'
    };
  }

  // 6. Domestic Violence & Women Rights (High Urgency)
  if (
    lower.includes('domestic') ||
    lower.includes('violence') ||
    lower.includes('abuse') ||
    lower.includes('harassment_women') ||
    lower.includes('marpeet')
  ) {
    return {
      category: "Women's Rights",
      urgency: 'high',
      suggestedAction: 'ngo',
      actionLabel: 'Contact Women Rights NGOs'
    };
  }

  // 7. Child Custody & Maintenance (High Urgency)
  if (lower.includes('custody') || lower.includes('child_custody') || lower.includes('hizanat')) {
    return {
      category: 'Family Law',
      urgency: 'high',
      suggestedAction: 'lawyers',
      actionLabel: 'Consult Child Custody Advocates'
    };
  }

  // 8. Family Law (Khula, Divorce, Procedures)
  if (
    lower.includes('family') ||
    lower.includes('khula') ||
    lower.includes('divorce') ||
    lower.includes('maintenance') ||
    lower.includes('talaq') ||
    lower.includes('marriage') ||
    lower.includes('wali') ||
    lower.includes('husband') ||
    lower.includes('father')
  ) {
    return {
      category: 'Family Law',
      urgency: 'medium',
      suggestedAction: 'lawyers',
      actionLabel: 'Consult Family Lawyers'
    };
  }

  // 9. Criminal Law (FIR, Pre/Post-Arrest Bail, Fraud)
  if (
    lower.includes('criminal') ||
    lower.includes('bail') ||
    lower.includes('fir') ||
    lower.includes('assault') ||
    lower.includes('fraud') ||
    lower.includes('arrest')
  ) {
    return {
      category: 'Criminal Law',
      urgency: 'high',
      suggestedAction: 'lawyers',
      actionLabel: 'Consult Criminal Defense Lawyers'
    };
  }

  // 10. Property & Land Disputes
  if (
    lower.includes('property') ||
    lower.includes('land') ||
    lower.includes('tenant') ||
    lower.includes('rent') ||
    lower.includes('eviction') ||
    lower.includes('dispossession') ||
    lower.includes('qabza')
  ) {
    return {
      category: 'Property Law',
      urgency: 'medium',
      suggestedAction: 'lawyers',
      actionLabel: 'Consult Property Lawyers'
    };
  }

  // 11. Labor & Employment Law
  if (
    lower.includes('labor') ||
    lower.includes('employment') ||
    lower.includes('wages') ||
    lower.includes('salary') ||
    lower.includes('termination')
  ) {
    return {
      category: 'Labor Law',
      urgency: 'medium',
      suggestedAction: 'lawyers',
      actionLabel: 'Consult Labor Law Advocates'
    };
  }

  // 12. Fundamental & Human Rights
  if (
    lower.includes('fundamental') ||
    lower.includes('human_rights') ||
    lower.includes('detention')
  ) {
    return {
      category: 'Human Rights',
      urgency: 'high',
      suggestedAction: 'ngo',
      actionLabel: 'Request Human Rights NGO Aid'
    };
  }

  // Default / Greetings / Fallback
  return {
    category: null,
    urgency: 'low',
    suggestedAction: null,
    actionLabel: null
  };
}

/**
 * Send a query to Dialogflow and detect intent with multi-turn context support.
 */
async function detectDialogflowIntent(text, sessionId = 'default-session', languageCode = 'en', inputContexts = []) {
  const client = sessionClient || initSessionClient();
  const projectId = configuredProjectId || process.env.DIALOGFLOW_PROJECT_ID;

  if (!client || !projectId) {
    return {
      success: false,
      configured: false,
      message: 'Dialogflow is not configured with valid project ID and credentials.',
      error: lastInitError || 'Client uninitialized'
    };
  }

  try {
    const sessionPath = client.projectAgentSessionPath(projectId, sessionId);

    const request = {
      session: sessionPath,
      queryInput: {
        text: {
          text: text,
          languageCode: languageCode
        }
      }
    };

    if (Array.isArray(inputContexts) && inputContexts.length > 0) {
      request.queryParams = {
        contexts: inputContexts.map(ctx => {
          const rawName = ctx.name || ctx.contextName || '';
          const contextPath = rawName.includes('/contexts/')
            ? rawName
            : client.projectAgentSessionContextPath(projectId, sessionId, rawName);

          return {
            name: contextPath,
            lifespanCount: ctx.lifespanCount !== undefined ? ctx.lifespanCount : 5,
            parameters: ctx.parameters || {}
          };
        })
      };
    }

    const responses = await client.detectIntent(request);
    const result = responses[0].queryResult;

    const intentName = result.intent ? result.intent.displayName : 'Unknown';
    const isFallback = result.intent ? Boolean(result.intent.isFallback) : true;
    const confidence = typeof result.intentDetectionConfidence === 'number'
      ? Math.round(result.intentDetectionConfidence * 100) / 100
      : 0;
    const fulfillmentText = result.fulfillmentText || '';

    const unwrappedParams = result.parameters ? unwrapStruct(result.parameters) : {};

    const outputContexts = (result.outputContexts || []).map(ctx => {
      const parts = (ctx.name || '').split('/');
      const shortName = parts.length > 0 ? parts[parts.length - 1] : ctx.name;
      return {
        name: ctx.name,
        contextName: shortName,
        lifespanCount: ctx.lifespanCount,
        parameters: ctx.parameters ? unwrapStruct(ctx.parameters) : {}
      };
    });

    const mapping = mapIntentToLegalCategory(intentName);

    return {
      success: true,
      configured: true,
      source: 'dialogflow_nlp',
      intent: intentName,
      isFallback: isFallback,
      confidence: confidence,
      reply: fulfillmentText,
      category: mapping.category,
      urgency: mapping.urgency,
      suggestedAction: mapping.suggestedAction,
      actionLabel: mapping.actionLabel,
      parameters: unwrappedParams,
      contexts: outputContexts
    };
  } catch (error) {
    console.error('❌ [Dialogflow detectIntent Error]:', error.message);
    return {
      success: false,
      configured: true,
      error: error.message,
      code: error.code || null
    };
  }
}

function getDialogflowStatus() {
  const active = Boolean(sessionClient && (configuredProjectId || process.env.DIALOGFLOW_PROJECT_ID));
  return {
    dialogflowActive: active,
    projectId: configuredProjectId || process.env.DIALOGFLOW_PROJECT_ID || null,
    credentialsType: credentialsType,
    nlpModel: active ? 'Dialogflow ES (Cloud NLP)' : 'Local Legal NLP Classifier',
    error: active ? null : lastInitError
  };
}

module.exports = {
  detectDialogflowIntent,
  mapIntentToLegalCategory,
  isDialogflowConfigured: () => Boolean(sessionClient && (configuredProjectId || process.env.DIALOGFLOW_PROJECT_ID)),
  getDialogflowStatus,
  initSessionClient
};
