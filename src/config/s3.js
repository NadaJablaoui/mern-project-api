import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'

import dotenv from 'dotenv'
dotenv.config()

export const s3 = new S3Client({
    region: process.env.ETH_LEAF_S3_REGION,
    credentials: {
        accessKeyId: process.env.ETH_LEAF_S3_ACCESS_KEY_ID,
        secretAccessKey: process.env.ETH_LEAF_S3_SECRET_ACCESS_KEY,
    },
})
