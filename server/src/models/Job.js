import mongoose from 'mongoose';
import Emb from '../services/embeddingsService.js';

const faqSchema = new mongoose.Schema(
  { q: String, a: String },
  { _id: false }
);

const jobSchema = new mongoose.Schema(
  {
    title:      { type: String, required: true, index: true },
    company:    { type: String, required: true, index: true },
    location:   { type: String, required: true, index: true },
    type:       { type: String, enum: ['Full-Time','Part-Time','Contract','Internship','Remote','On-Site','Hybrid'], default: 'Full-Time' },
    description:{ type: String, required: true },
    salaryMin:  Number,
    salaryMax:  Number,
    minExperience: { type: Number, default: 0 },
    shift:      { type: String, enum: ['Day','Night','Rotational','Flexible'], default: 'Day' },
    workType:   { type: String, enum: ['On-Site','Remote','Hybrid'], default: 'On-Site' },
    // referral bounty settings
    bountyActive: { type: Boolean, default: false },
    bountyAmount: { type: Number, default: 0 },
    bountyCurrency: { type: String, enum: ['USD','INR','EUR','GBP'], default: 'USD' },
    faqs:       [faqSchema],
    featured:   { type: Boolean, default: false },

    // recruiter (job owner)
    employer:   { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },

    // employees allowed to chat with candidate
    team:       [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }]
  },
  { timestamps: true }
);

jobSchema.index({ title: 'text', description: 'text', company: 'text', location: 'text' });

// Upsert embedding after create/update (must be before model compile)
jobSchema.post('save', async function(doc) {
  try { await Emb.upsertJobEmbedding(doc._id); } catch {}
});

export default mongoose.model('Job', jobSchema);
