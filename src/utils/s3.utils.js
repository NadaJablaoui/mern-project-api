import { PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { s3 } from "../config/s3.js";
import crypto from "crypto";

export async function generatePresignedUploadUrl(folder, contentType, filename, userId) {
  // Force server-generated filename
  const finalFilename = crypto.randomUUID();

  const key = `${folder}/${userId}/${finalFilename}`;

  const command = new PutObjectCommand({
    Bucket: process.env.ETH_LEAF_S3_BUCKET,
    Key: key,
    ContentType: contentType,
  });

  const signedUrl = await getSignedUrl(s3, command, {
    expiresIn: 60 * 5 // 5 minutes
  });

  return {
    upload_url: signedUrl,
    file_url: `${process.env.ETH_LEAF_S3_SERVER}/${key}`
  };
}
