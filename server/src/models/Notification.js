import mongoose from 'mongoose';
const notificationSchema = new mongoose.Schema({
  user:{type:mongoose.Schema.Types.ObjectId, ref:'User', required:true, index:true},
  title:{type:String,required:true},
  message:String,
  link:String,
  type:{type:String,enum:['application','status','system'],default:'system'},
  read:{type:Boolean,default:false}
},{timestamps:true});
export default mongoose.model('Notification', notificationSchema);
