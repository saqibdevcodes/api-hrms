import { v2 as cloudinary } from 'cloudinary';
import { config } from './env';

// Configure Cloudinary if credentials are provided
if (config.CLOUDINARY_CLOUD_NAME && config.CLOUDINARY_API_KEY && config.CLOUDINARY_API_SECRET) {
  cloudinary.config({
    cloud_name: config.CLOUDINARY_CLOUD_NAME,
    api_key: config.CLOUDINARY_API_KEY,
    api_secret: config.CLOUDINARY_API_SECRET,
  });
  console.log('✅ Cloudinary configured successfully');
} else {
  console.warn('⚠️  Cloudinary credentials not found. Using local storage for uploads.');
  console.warn('⚠️  This will NOT work on Vercel! Add CLOUDINARY_* env vars for production.');
}

export default cloudinary;

