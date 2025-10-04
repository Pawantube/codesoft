import mongoose from 'mongoose';
const faqSchema = new mongoose.Schema({ q:String, a:String },{_id:false});
const jobSchema = new mongoose.Schema({
  title:{type:String,required:true,index:true},
  company:{type:String,required:true,index:true},
  location:{type:String,required:true,index:true},
  type:{type:String,enum:['Full-Time','Part-Time','Contract','Internship','Remote','On-Site','Hybrid'],default:'Full-Time'},
  description:{type:String,required:true},
  salaryMin:Number, salaryMax:Number,
  minExperience:{type:Number,default:0},
  shift:{type:String,enum:['Day','Night','Rotational','Flexible'],default:'Day'},
  workType:{type:String,enum:['On-Site','Remote','Hybrid'],default:'On-Site'},
  faqs:[faqSchema],
  featured:{type:Boolean,default:false},
  employer:{type:mongoose.Schema.Types.ObjectId,ref:'User',required:true}
},{timestamps:true});
jobSchema.index({ title:'text', description:'text', company:'text', location:'text' });
export default mongoose.model('Job', jobSchema);
