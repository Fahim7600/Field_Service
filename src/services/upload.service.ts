import cloudinary from '../config/cloudinary';

export interface UploadResult {
  url: string;
  publicId: string;
}

export const uploadPrivateImage = async (buffer: Buffer, folder: string): Promise<UploadResult> => {
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder,
        resource_type: 'image',
        type: 'authenticated',
      },
      (error, result) => {
        if (error || !result) {
          return reject(error || new Error('Upload failed'));
        }
        resolve({
          url: result.secure_url,
          publicId: result.public_id,
        });
      },
    );

    uploadStream.end(buffer);
  });
};

export const deleteAsset = async (publicId: string): Promise<unknown> => {
  return cloudinary.uploader.destroy(publicId, {
    resource_type: 'image',
    type: 'authenticated',
  });
};

export const getSignedImageUrl = (publicId: string, storedUrl: string): string => {
  const ext = storedUrl.split('.').pop()?.split('?')[0] || 'jpg';
  return cloudinary.url(publicId, {
    resource_type: 'image',
    type: 'authenticated',
    sign_url: true,
    secure: true,
    format: ext,
  });
};
