import streamifier from "streamifier";
import cloudinary from "../config/cloudinary.js";

export const uploadAvatar = (
  fileBuffer: Buffer,
): Promise<{
  publicId: string;
  secureUrl: string;
}> => {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder: "shared-music-room/avatars",
      },
      (error, result) => {
        if (error || !result) {
          return reject(error);
        }

        resolve({
          publicId: result.public_id,
          secureUrl: result.secure_url,
        });
      }
    );

    streamifier.createReadStream(fileBuffer).pipe(stream);
  });
};

export const deleteFromCloudinary = async (
  publicId: string
) => {
  return cloudinary.uploader.destroy(publicId);
};