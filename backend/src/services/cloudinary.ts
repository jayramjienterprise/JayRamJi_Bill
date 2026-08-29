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

export function uploadBufferToCloudinary(
  buffer: Buffer,
  options: {
    folder: string;
    public_id: string;
    resource_type?: 'image' | 'raw' | 'video' | 'auto';
  }
): Promise<{ public_id: string; secure_url: string }> {
  return new Promise((resolve, reject) => {
    if (!isCloudinaryConfigured) {
      if (env.NODE_ENV === 'development' || env.NODE_ENV === 'test') {
        const mockPublicId = `${options.folder}/${options.public_id}`;
        const format = options.resource_type === 'raw' ? 'pdf' : 'png';
        const mockUrl = `https://res.cloudinary.com/mock-cloud/image/upload/v1/${mockPublicId}.${format}`;
        return resolve({
          public_id: mockPublicId,
          secure_url: mockUrl,
        });
      } else {
        return reject(new Error('Cloudinary is not configured. Cloudinary credentials are required in production.'));
      }
    }

    const stream = cloudinary.uploader.upload_stream(
      {
        folder: options.folder,
        public_id: options.public_id,
        resource_type: options.resource_type || 'image',
      },
      (error, result) => {
        if (error || !result) {
          return reject(error || new Error('Upload stream returned undefined result'));
        }
        resolve({
          public_id: result.public_id,
          secure_url: result.secure_url,
        });
      }
    );
    stream.write(buffer);
    stream.end();
  });
}

export default cloudinary;
