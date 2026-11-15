const mongoose = require('mongoose');

async function test() {
  try {
    await mongoose.connect('mongodb://localhost:27017/legallink');
    const Lawyer = mongoose.model('Lawyer', new mongoose.Schema({}, { strict: false }));
    const Review = mongoose.model('Review', new mongoose.Schema({}, { strict: false }));
    const Case = mongoose.model('Case', new mongoose.Schema({}, { strict: false }));

    const lawyers = await Lawyer.find({});
    console.log('Total lawyers in DB:', lawyers.length);
    for (const l of lawyers) {
      const revs = await Review.find({ lawyerId: l._id });
      console.log('Lawyer:', l.name, '| id:', l._id.toString(), '| doc rating:', l.rating, '| totalReviews doc:', l.totalReviews, '| actual reviews count in Review col:', revs.length);
    }
    const allReviews = await Review.find({});
    console.log('Total reviews in DB:', allReviews.length);
    allReviews.forEach(r => {
      console.log('Review:', r.comment ? r.comment.slice(0, 40) : '', '| lawyerId:', r.lawyerId, '| rating:', r.rating);
    });
    await mongoose.disconnect();
  } catch (e) {
    console.error('Error:', e);
  }
}
test();
