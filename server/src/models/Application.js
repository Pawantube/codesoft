import mongoose from 'mongoose';
const interviewSchema = new mongoose.Schema({
  at: { type: Date },
  status: { type: String, enum: ['scheduled', 'canceled', 'completed'], default: 'scheduled' },
  notes: { type: String },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, { _id: false });

const applicationSchema = new mongoose.Schema({
  job:{type:mongoose.Schema.Types.ObjectId, ref:'Job', required:true, index:true},
  candidate:{type:mongoose.Schema.Types.ObjectId, ref:'User', required:true, index:true},
  name:{type:String,required:true},
  email:{type:String,required:true},
  coverLetter:String,
  resumeFileName:String,
  resumePublicPath:String,
  status:{type:String,enum:['submitted','reviewed','accepted','rejected'],default:'submitted'},
  interview: { type: interviewSchema, default: null }
},{timestamps:true});
export default mongoose.model('Application', applicationSchema);
