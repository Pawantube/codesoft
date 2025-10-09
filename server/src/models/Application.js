import mongoose from 'mongoose';
const interviewSchema = new mongoose.Schema({
  at: { type: Date },
  status: { type: String, enum: ['scheduled', 'canceled', 'completed'], default: 'scheduled' },
  notes: { type: String },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, { _id: false });

const taskSchema = new mongoose.Schema({
  _id: { type: mongoose.Schema.Types.ObjectId, auto: true },
  title: { type: String, required: true },
  description: { type: String },
  attachments: [{ url: String, name: String }],
  dueAt: { type: Date },
  status: { type: String, enum: ['assigned', 'submitted', 'reviewed'], default: 'assigned' },
  submittedAt: { type: Date },
  submissionText: { type: String },
  submissionLinks: [{ type: String }],
  reviewerNotes: { type: String },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, { _id: false, timestamps: true });

const applicationSchema = new mongoose.Schema({
  job:{type:mongoose.Schema.Types.ObjectId, ref:'Job', required:true, index:true},
  candidate:{type:mongoose.Schema.Types.ObjectId, ref:'User', required:true, index:true},
  name:{type:String,required:true},
  email:{type:String,required:true},
  coverLetter:String,
  resumeFileName:String,
  resumePublicPath:String,
  status:{
    type:String,
    enum:['submitted','reviewed','on_hold','shortlisted','task_assigned','accepted','rejected'],
    default:'submitted'
  },
  interview: { type: interviewSchema, default: null },
  tasks: { type: [taskSchema], default: [] },
  matchScore: { type: Number, default: 0 }
},{timestamps:true});
export default mongoose.model('Application', applicationSchema);
