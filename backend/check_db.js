const mongoose = require('mongoose');

const MONGO_URI = 'mongodb+srv://abhijeetroy20:%40Please990@cluster0.c2dovsj.mongodb.net/';
const tenderSchema = new mongoose.Schema({ title: String, tenderNumber: { type: String, unique: true } });
const Tender = mongoose.model('Tender', tenderSchema);

mongoose.connect(MONGO_URI, { serverSelectionTimeoutMS: 5000 }).then(async () => {
  const count = await Tender.countDocuments({});
  console.log('DB Tenders:', count);
  process.exit(0);
}).catch(e => { console.error(e.message); process.exit(1); });
