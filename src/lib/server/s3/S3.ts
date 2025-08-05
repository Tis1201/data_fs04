// utils/s3.ts
import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand, ObjectCannedACL } from '@aws-sdk/client-s3';
import { env } from '$env/dynamic/private';

const s3 = new S3Client({
  region: env.AWS_REGION!,
  credentials: {
    accessKeyId: env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: env.AWS_SECRET_ACCESS_KEY!,
  },
});

const BUCKET_NAME = env.AWS_S3_BUCKET_NAME!;
const AWS_REGION = env.AWS_REGION!

export async function uploadToS3(key: string, body: Buffer | Uint8Array | Blob | string, contentType: string) {
  const command = new PutObjectCommand({
    Bucket: BUCKET_NAME,
    Key: key,
    Body: body,
    ContentType: contentType,
    ACL: ObjectCannedACL.public_read,  // Can be dynamic selected by creator in the future
  });

  await s3.send(command);
}

export async function deleteFromS3(key: string) {
  const command = new DeleteObjectCommand({
    Bucket: BUCKET_NAME,
    Key: key,
  });

  await s3.send(command);
}

export function getObjectUrl(key: string) {
    return `https://${BUCKET_NAME}.s3.${AWS_REGION}.amazonaws.com/${key}`;
}