// import mongoose from 'mongoose';
// import bcrypt from 'bcryptjs';
// const userSchema = new mongoose.Schema({
//   name:{type:String,required:true},
//   email:{type:String,required:true,unique:true,lowercase:true,index:true},
//   password:{type:String,required:true,select:false},
//   role:{type:String,enum:['employer','candidate'],required:true},
//   companyName:String,
//   resumeUrl:String
// },{timestamps:true});
// userSchema.pre('save',async function(next){ if(!this.isModified('password')) return next(); const salt=await bcrypt.genSalt(10); this.password=await bcrypt.hash(this.password,salt); next(); });
// userSchema.methods.comparePassword=async function(c){ return bcrypt.compare(c,this.password); };
// export default mongoose.model('User', userSchema);


import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const linkSchema = new mongoose.Schema({
  linkedin: String,
  github: String,
  website: String,
}, { _id: false });

const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true, lowercase: true, index: true },
  password: { type: String, required: true, select: false },
  role: { type: String, enum: ['employer', 'candidate'], required: true },

  // employer
  companyName: String,

  // profile additions
  headline: String,
  bio: String,
  phone: String,
  location: String,
  skills: [String],
  avatarUrl: String,
  links: linkSchema,

  resumeUrl: String, // candidate may still use this
}, { timestamps: true });

userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

userSchema.methods.comparePassword = function (candidate) {
  return bcrypt.compare(candidate, this.password);
};

export default mongoose.model('User', userSchema);
