import { v2 as cloudinary } from 'cloudinary';


const CLOUDINARY_URL = "cloudinary://637547871777381:nnHsk07OHZXSwrie0749CoIQiZY@djmqatpls";
const CLOUDINARY_CLOUD_NAME = "djmqatpls";
const CLOUDINARY_API_KEY = "637547871777381";
const CLOUDINARY_API_SECRET = "nnHsk07OHZXSwrie0749CoIQiZY";

// Configure Cloudinary
cloudinary.config({
  cloud_name: CLOUDINARY_CLOUD_NAME,
  api_key: CLOUDINARY_API_KEY,
  api_secret: CLOUDINARY_API_SECRET,
  secure: true,
});
console.log("✅ Cloudinary configured successfully");
console.log("Cloud Name:", CLOUDINARY_CLOUD_NAME);
console.log("API Key:", CLOUDINARY_API_KEY);
// ⚠️ Do NOT log API secret in production

if (CLOUDINARY_URL) {
  // When CLOUDINARY_URL is present, the SDK reads it from process.env automatically.
  // We only set secure mode.
  cloudinary.config({ secure: true });
} else if (CLOUDINARY_CLOUD_NAME && CLOUDINARY_API_KEY && CLOUDINARY_API_SECRET) {
  cloudinary.config({
    cloud_name: CLOUDINARY_CLOUD_NAME,
    api_key: CLOUDINARY_API_KEY,
    api_secret: CLOUDINARY_API_SECRET,
    secure: true,
  });
}

export default cloudinary;
