const dialogflow = require('@google-cloud/dialogflow');
const path = require('path');

process.env.GOOGLE_APPLICATION_CREDENTIALS = path.resolve(__dirname, '../dialogflow-key.json');
const projectId = 'legallink-ai-gekd';
const intentsClient = new dialogflow.IntentsClient();
const agentPath = intentsClient.projectAgentPath(projectId);

async function enrichAgent() {
  console.log('Fetching existing intents from Dialogflow agent...');
  const [existingIntents] = await intentsClient.listIntents({
    parent: agentPath,
    intentView: 'INTENT_VIEW_FULL'
  });

  const intentMap = new Map();
  existingIntents.forEach(i => intentMap.set(i.displayName, i));

  // 1. UPDATE legal.procedure.bail_fir_info
  const bailProcedureIntent = intentMap.get('legal.procedure.bail_fir_info');
  if (bailProcedureIntent) {
    const newPhrases = [
      'how to get bail',
      'how can I get bail',
      'how do I get bail in Pakistan',
      'how to apply for bail',
      'what is the process to get bail',
      'procedure for bail in Pakistan',
      'bail kaise milti hai',
      'bail lene ka kya tareeqa hai',
      'zamanat kaise karwayen',
      'zamanat ka tareeqa kya hai'
    ];

    const currentPhrases = bailProcedureIntent.trainingPhrases.map(tp => 
      tp.parts.map(p => p.text).join('')
    );

    newPhrases.forEach(text => {
      if (!currentPhrases.includes(text)) {
        bailProcedureIntent.trainingPhrases.push({
          type: 'EXAMPLE',
          parts: [{ text }]
        });
      }
    });

    await intentsClient.updateIntent({
      intent: bailProcedureIntent,
      languageCode: 'en'
    });
    console.log('✓ Updated legal.procedure.bail_fir_info with direct bail queries');
  }

  // 2. DEFINE NEW FAQ INTENTS
  const newFaqIntents = [
    {
      displayName: 'legal.faq.father_child_maintenance',
      trainingPhrases: [
        'does father have to pay child maintenance after divorce',
        'is father responsible for child maintenance in Pakistan',
        'kya talaq ke baad baap bachon ka kharcha dega',
        'shohar bachon ka kharcha dene ka paband hai',
        'can father refuse to pay child support',
        'kya baap bachon ka kharcha rok sakta hai',
        'can mother claim child maintenance from ex husband',
        'child maintenance law in Pakistan',
        'who pays for child expenses after khula',
        'bachon ka naan o nafaqah kon dega'
      ],
      responseText: 'Yes, absolutely. Under Section 9 of the Muslim Family Laws Ordinance 1961 and binding Supreme Court precedents, a father has an absolute, non-negotiable statutory obligation to provide maintenance (Kharcha-e-Naan-o-Nafaqah) for his minor children. This legal duty applies until sons attain majority (18 years) and daughters get married, regardless of whether custody is with the mother or whether divorce occurred by Khula. If the father refuses or defaults, the Family Court can order interim maintenance, attach his salary/bank accounts, or issue civil jail arrest warrants.'
    },
    {
      displayName: 'legal.faq.verbal_talaq',
      trainingPhrases: [
        'is verbal talaq valid in Pakistan',
        'does oral talaq work without paperwork',
        'kya zubani talaq ho jati hai',
        'shohar ne zubani 3 bar talaq bol diya',
        'is written notice mandatory for divorce in Pakistan',
        'without union council certificate is divorce valid',
        'zubani talaq ki qanooni hasiyat kya hai'
      ],
      responseText: 'Under Section 7 of the Muslim Family Laws Ordinance 1961, any pronouncement of Talaq (even if verbally pronounced three times) MUST be notified in writing to the Chairman of the local Union Council / Arbitration Council, with a copy dispatched to the wife via registered mail. Talaq does NOT become legally effective until 90 days after formal receipt of this written notice by the Union Council, during which mandatory reconciliation proceedings are held. Without the official NADRA / Union Council Talaq Certificate, parties remain legally married in the eyes of Pakistani statutory law.'
    },
    {
      displayName: 'legal.faq.woman_marriage_without_wali',
      trainingPhrases: [
        'can a woman marry without wali in Pakistan',
        'can adult girl marry without parent permission',
        'court marriage without wali legal in Pakistan',
        'kya larki bina wali ki marzi ke shadi kar sakti hai',
        'is parent consent required for court marriage',
        'adult female court marriage validity Pakistan'
      ],
      responseText: 'Yes. Under Pakistani civil and Islamic family law (affirmed by the Supreme Court in the landmark Hafiz Abdul Waheed v. Asma Jahangir case and Federal Shariat Court jurisprudence), an adult, sane Muslim woman who has attained puberty/majority has the full autonomous legal right to contract a valid marriage of her own free will without requiring the permission, presence, or consent of a Wali (father/guardian). Any forced marriage or restraint is a criminal offence under Section 498-B of the Pakistan Penal Code.'
    },
    {
      displayName: 'legal.faq.landlord_rent_increase',
      trainingPhrases: [
        'can landlord increase rent anytime',
        'how much rent can landlord increase in Pakistan',
        'kya malik makan har saal kiraya barha sakta hai',
        'landlord demanding double rent suddenly',
        'rent increase rules under rent restriction act',
        'punjab rented premises act rent increment rules'
      ],
      responseText: 'No, a landlord cannot increase rent arbitrarily or at will. Under the Punjab Rented Premises Act 2009 (and provincial tenancy laws across Sindh, KP, and ICT), rent can only be increased strictly according to the agreed terms in the registered tenancy agreement. If no specific escalation clause was stipulated, provincial laws generally restrict increases up to an automatic statutory cap (typically 25% every three years upon lease renewal). A landlord cannot demand unjustified sudden increments or harass a tenant for higher rent.'
    }
  ];

  for (const item of newFaqIntents) {
    if (intentMap.has(item.displayName)) {
      console.log(`Intent ${item.displayName} already exists, skipping creation.`);
      continue;
    }

    const intentPayload = {
      displayName: item.displayName,
      trainingPhrases: item.trainingPhrases.map(phrase => ({
        type: 'EXAMPLE',
        parts: [{ text: phrase }]
      })),
      messages: [
        {
          text: {
            text: [item.responseText]
          }
        }
      ]
    };

    const [created] = await intentsClient.createIntent({
      parent: agentPath,
      intent: intentPayload,
      languageCode: 'en'
    });
    console.log(`✓ Created intent: ${created.displayName}`);
  }

  console.log('Dialogflow agent enrichment completed successfully!');
}

enrichAgent().catch(err => {
  console.error('Error enriching agent:', err);
  process.exit(1);
});
