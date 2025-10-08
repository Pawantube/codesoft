import mongoose from 'mongoose';
const applicationSchema = new mongoose.Schema({
  job:{type:mongoose.Schema.Types.ObjectId, ref:'Job', required:true, index:true},
  candidate:{type:mongoose.Schema.Types.ObjectId, ref:'User', required:true, index:true},
  name:{type:String,required:true},
  email:{type:String,required:true},
  coverLetter:String,
  resumeFileName:String,
  resumePublicPath:String,
  status:{type:String,enum:['submitted','reviewed','accepted','rejected'],default:'submitted'}
},{timestamps:true});
export default mongoose.model('Application', applicationSchema);
