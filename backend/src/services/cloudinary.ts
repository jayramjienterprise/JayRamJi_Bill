import { v2 as cloudinary } from 'cloudinary';
import { env } from '../config/env';

let isCloudinaryConfigured = false;

const hasCloudinaryEnv =
  env.CLOUDINARY_CLOUD_NAME &&
  env.CLOUDINARY_API_KEY &&
  env.CLOUDINARY_API_SECRET;

if (hasCloudinaryEnv) {
  try {
    cloudinary.config({
      cloud_name: env.CLOUDINARY_CLOUD_NAME,
      api_key: env.CLOUDINARY_API_KEY,
      api_secret: env.CLOUDINARY_API_SECRET,
      secure: true,
    });
    isCloudinaryConfigured = true;
    console.log('☁️ Cloudinary integration initialized successfully');
  } catch (error) {
    console.error('⚠️ Error configuring Cloudinary. Falling back to mock/offline mode:', error);
  }
} else {
  console.warn(
    '⚠️ Cloudinary credentials are not set in the environment. Asset upload APIs will operate in fallback/mock mode.'
  );
}

export { cloudinary, isCloudinaryConfigured };
export default cloudinary;
