import ImageKit from "imagekit";
import { env } from "../config/env.js";

let _ik: ImageKit | null = null;

const getClient = (): ImageKit => {
  if (!env.IMAGEKIT_PUBLIC_KEY || !env.IMAGEKIT_PRIVATE_KEY || !env.IMAGEKIT_URL_ENDPOINT) {
    throw new Error("ImageKit credentials not configured (IMAGEKIT_PUBLIC_KEY, IMAGEKIT_PRIVATE_KEY, IMAGEKIT_URL_ENDPOINT)");
  }
  if (!_ik) {
    _ik = new ImageKit({
      publicKey: env.IMAGEKIT_PUBLIC_KEY,
      privateKey: env.IMAGEKIT_PRIVATE_KEY,
      urlEndpoint: env.IMAGEKIT_URL_ENDPOINT
    });
  }
  return _ik;
};

export const uploadToImageKit = async (fileBuffer: Buffer, fileName: string): Promise<string> => {
  const ik = getClient();
  const safeName = fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
  const result = await ik.upload({
    file: fileBuffer,
    fileName: safeName,
    folder: "/tenders",
    useUniqueFileName: true
  });
  console.log("[imagekit] Uploaded:", result.url);
  return result.url;
};
