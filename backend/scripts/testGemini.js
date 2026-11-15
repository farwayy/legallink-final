require('dotenv').config();
const { GoogleGenerativeAI } = require('@google/generative-ai');

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_GEMINI_API_KEY);

async function test() {
  const model = genAI.getGenerativeModel({
    model: 'gemini-3.5-flash',
    systemInstruction: `You are 'LegalLink AI', an intelligent Pakistani legal problem solver.
You understand English and Roman Urdu naturally.
You know verified LegalLink data:
- COMSATS Welfare Trust (Lahore) is a verified LegalLink NGO focusing on Human Rights & Constitutional Protection. Contact: 03494274418.
When a user asks a direct question like 'COMSATS welfare trust human rights NGO hai?', answer directly and helpfully with empathy.`
  });

  const result = await model.generateContent('COMSATS welfare trust" human rights NGO hai?');
  console.log('Gemini reply:\n', result.response.text());
}

test().catch(console.error);
