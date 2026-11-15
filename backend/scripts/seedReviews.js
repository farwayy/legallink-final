const mongoose = require('../node_modules/mongoose');
const Review = require('../models/Review');
const Case = require('../models/Case');
const Lawyer = require('../models/Lawyer');
const User = require('../models/User');

async function seed() {
  await mongoose.connect('mongodb://localhost:27017/legallink');
  console.log('Connected to MongoDB.');

  // Find resolved cases
  const resolvedCases = await Case.find({ status: 'resolved' })
    .populate('userId')
    .populate('lawyerId');

  console.log(`Found ${resolvedCases.length} resolved cases.`);

  const reviewTemplates = [
    {
      caseTitleMatch: 'Inheritance & Agricultural Property',
      rating: 5,
      comment: "A complex agricultural inheritance dispute had been pending in the revenue courts for over three years. Adv. Tariq Mehmood stepped in, structured our partition claim with ironclad documentary proof, and concluded the settlement with the partition decree in our favor. Exceptional diligence and transparent counsel."
    },
    {
      caseTitleMatch: 'Unlawful Termination',
      rating: 5,
      comment: "Following an abrupt corporate downsizing, our gratuity and terminal dues were unlawfully withheld. Adv. Ayesha Siddiqui evaluated our employment contract thoroughly, issued formal legal notice under labor laws, and secured our full financial settlement through mediation without prolonged litigation."
    },
    {
      caseTitleMatch: 'Pre-Arrest Bail',
      rating: 5,
      comment: "When facing a wrongful commercial FIR and sudden police harassment, Adv. Tariq Mehmood secured interim pre-arrest bail before the Sessions Court within 24 hours. His courtroom poise and command of criminal procedure safeguarded my constitutional liberties."
    },
    {
      caseTitleMatch: 'Domestic Violence',
      rating: 5,
      comment: "Through LegalLink's pro bono legal clinic, Adv. Ayesha Siddiqui provided compassionate yet unwavering defense, securing an immediate protective injunction and maintenance order from the Family Court. Grateful for her integrity and relentless advocacy."
    }
  ];

  for (const c of resolvedCases) {
    if (!c.userId || !c.lawyerId) continue;

    const existing = await Review.findOne({ caseId: c._id });
    if (existing) {
      console.log(`Review already exists for case "${c.title}"`);
      continue;
    }

    const matchedTemplate = reviewTemplates.find(t => c.title.includes(t.caseTitleMatch)) || {
      rating: 5,
      comment: `Adv. ${c.lawyerId.name} delivered rigorous representation and complete clarity throughout our proceedings. Highly recommend for any complex legal matter.`
    };

    const newRev = new Review({
      userId: c.userId._id,
      targetType: 'lawyer',
      lawyerId: c.lawyerId._id,
      caseId: c._id,
      rating: matchedTemplate.rating,
      comment: matchedTemplate.comment,
      isFlagged: false,
      createdAt: new Date(Date.now() - Math.floor(Math.random() * 10 + 2) * 86400000)
    });

    await newRev.save();
    console.log(`Saved verified review for case "${c.title}" by ${c.userId.name} for ${c.lawyerId.name}`);
  }

  // Recalculate lawyer ratings
  const lawyers = await Lawyer.find();
  for (const l of lawyers) {
    const stats = await Review.aggregate([
      { $match: { lawyerId: l._id, isFlagged: false } },
      { $group: { _id: '$lawyerId', avgRating: { $avg: '$rating' }, count: { $sum: 1 } } }
    ]);
    if (stats.length > 0) {
      await Lawyer.findByIdAndUpdate(l._id, {
        rating: Math.round(stats[0].avgRating * 10) / 10,
        totalReviews: stats[0].count
      });
    }
  }

  console.log('Seeding reviews completed successfully.');
  await mongoose.disconnect();
}

seed().catch(err => {
  console.error('Seeding error:', err);
  process.exit(1);
});
