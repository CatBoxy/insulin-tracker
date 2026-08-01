import { v2 as cloudinary } from "cloudinary";

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

export async function uploadFile(
  buffer: Buffer,
  options: { folder?: string; resourceType?: "image" | "raw" } = {}
): Promise<{ public_id: string; secure_url: string; bytes: number }> {
  const folder = options.folder || "glycofit/checkups";
  const resourceType = options.resourceType || "image";

  return new Promise((resolve, reject) => {
    cloudinary.uploader
      .upload_stream(
        { folder, resource_type: resourceType },
        (error, result) => {
          if (error || !result) return reject(error || new Error("Upload failed"));
          resolve({
            public_id: result.public_id,
            secure_url: result.secure_url,
            bytes: result.bytes,
          });
        }
      )
      .end(buffer);
  });
}

export async function deleteFile(publicId: string, resourceType: "image" | "raw" = "image") {
  await cloudinary.uploader.destroy(publicId, { resource_type: resourceType });
}

export default cloudinary;
