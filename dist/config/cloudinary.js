"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const cloudinary_1 = require("cloudinary");
const env_1 = require("./env");
// Configure Cloudinary if credentials are provided
if (env_1.config.CLOUDINARY_CLOUD_NAME && env_1.config.CLOUDINARY_API_KEY && env_1.config.CLOUDINARY_API_SECRET) {
    cloudinary_1.v2.config({
        cloud_name: env_1.config.CLOUDINARY_CLOUD_NAME,
        api_key: env_1.config.CLOUDINARY_API_KEY,
        api_secret: env_1.config.CLOUDINARY_API_SECRET,
    });
    console.log('✅ Cloudinary configured successfully');
}
else {
    console.warn('⚠️  Cloudinary credentials not found. Using local storage for uploads.');
    console.warn('⚠️  This will NOT work on Vercel! Add CLOUDINARY_* env vars for production.');
}
exports.default = cloudinary_1.v2;
