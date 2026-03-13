import 'dotenv/config';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { readFile } from 'fs/promises';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Configure S3 client for Cloudflare R2
const s3Client = new S3Client({
    region: 'auto',
    endpoint: process.env.CLOUDFLARE_R2_ENDPOINT,
    credentials: {
        accessKeyId: process.env.CLOUDFLARE_R2_ACCESS_KEY_ID,
        secretAccessKey: process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY
    }
});

async function uploadFileWithSignedUrl(filePath, bucketKey) {
    try {
        console.log(`📤 Uploading file: ${filePath}`);
        console.log(`🪣 Bucket key: ${bucketKey}`);
        
        // Read the file
        const fileContent = await readFile(filePath);
        const contentType = filePath.endsWith('.jpg') ? 'image/jpeg' : 
                          filePath.endsWith('.png') ? 'image/png' : 
                          'application/octet-stream';
        
        // Create the put command
        const putCommand = new PutObjectCommand({
            Bucket: process.env.CLOUDFLARE_R2_BUCKET_NAME || 'cdn-dev',
            Key: bucketKey,
            ContentType: contentType,
            Body: fileContent
        });
        
        // Generate signed URL
        console.log('🔑 Generating signed URL...');
        const signedUrl = await getSignedUrl(s3Client, putCommand, { expiresIn: 3600 });
        
        console.log(`\n--- Signed Upload URL ---\n${signedUrl}\n`);
        
        // Upload using the signed URL
        console.log('⬆️  Uploading via signed URL...');
        const uploadResponse = await fetch(signedUrl, {
            method: 'PUT',
            headers: {
                'Content-Type': contentType
            },
            body: fileContent
        });
        
        if (!uploadResponse.ok) {
            const errorText = await uploadResponse.text();
            throw new Error(`Upload failed with status ${uploadResponse.status}: ${errorText}`);
        }
        
        console.log('✅ Upload successful!');
        console.log(`📊 File size: ${fileContent.length} bytes`);
        console.log(`🌐 Public URL: https://cdn-dev.datarealities.com/${bucketKey}`);
        console.log(`🔒 Direct URL: ${process.env.CLOUDFLARE_R2_ENDPOINT}/${process.env.CLOUDFLARE_R2_BUCKET_NAME}/${bucketKey}`);
        
        return {
            success: true,
            signedUrl,
            publicUrl: `https://cdn-dev.datarealities.com/${bucketKey}`,
            directUrl: `${process.env.CLOUDFLARE_R2_ENDPOINT}/${process.env.CLOUDFLARE_R2_BUCKET_NAME}/${bucketKey}`,
            fileSize: fileContent.length
        };
        
    } catch (error) {
        console.error('❌ Upload failed:', error.message);
        throw error;
    }
}

// Command line usage
if (import.meta.url === `file://${process.argv[1]}`) {
    const filePath = process.argv[2];
    const bucketKey = process.argv[3];
    
    if (!filePath || !bucketKey) {
        console.log('Usage: node upload-with-signed-url.js <local-file-path> <bucket-key>');
        console.log('');
        console.log('Example:');
        console.log('  node upload-with-signed-url.js ./image.jpg uploads/image.jpg');
        console.log('  node upload-with-signed-url.js ./document.pdf docs/contract.pdf');
        process.exit(1);
    }
    
    uploadFileWithSignedUrl(filePath, bucketKey)
        .then(result => {
            console.log('\n🎉 Upload completed successfully!');
        })
        .catch(error => {
            console.error('\n💥 Upload failed:', error.message);
            process.exit(1);
        });
}

export default uploadFileWithSignedUrl;
