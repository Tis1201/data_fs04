/*************************************************************************************
 * 
 * Tests for Sending Whatsapp Messages
 * 
 *************************************************************************************/

import 'dotenv/config';
import { downloadImageAsBase64, httpPost } from '$lib/utils/http-utils';

/*************************************************************************************
 * 
 * Check required environment variables
 * 
 *************************************************************************************/
const requiredEnvVars = ['USER_API_KEY', 'WHATSAPP_TEST_RECEPIENT_PHONE_NUMBER'];
const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);

if (missingVars.length > 0) {
    console.error(`❌ Error: Missing required environment variables: ${missingVars.join(', ')}`);
    process.exit(1);
}

// Configuration
const USER_API_KEY = process.env.USER_API_KEY!;
const RECIPIENT_PHONE = process.env.WHATSAPP_TEST_RECEPIENT_PHONE_NUMBER!;
const API_URL = 'http://localhost:5173/api/external/whatsapp/send';
const ACCOUNT_ID = 'cmcijjh4g006lley89dgfzczz';

interface WhatsAppRequestOptions {
    to: string;
    message: string;
    type?: string;
    caption?: string;
    filename?: string;
    [key: string]: unknown;
}


/*************************************************************************************
 * 
 * Types
 * 
 *************************************************************************************/
interface SendMessageOptions {
    to: string;
    message: string;
    type?: 'text' | 'image' | 'document' | 'audio' | 'video' | 'location';
    caption?: string;
    filename?: string;
    mimeType?: string;
}

/*************************************************************************************
 * 
 * Sends a WhatsApp message using the API
 * 
 * @param options - Message options including recipient, content, and type
 * @returns The API response data
 * 
 *************************************************************************************/
async function sendWhatsAppMessage(options: SendMessageOptions) {
   
    const response = await httpPost({
        url: `${API_URL}/${ACCOUNT_ID}`,
        headers: {
            'x-api-key': USER_API_KEY
        },
        data: {
            to: options.to,
            message: options.message,
            type: options.type || 'text',
            ...(options.caption && { caption: options.caption }),
            ...(options.filename && { filename: options.filename })
        },
        throwOnError: true
    });

    // Log the full response for debugging
    console.log('Response status:', response.status);
    console.log('Response headers:', response.headers);
    console.log('Response json:', response.data);

    console.log('✅ Message sent successfully:', response.data);
    return response.data;

}

/*************************************************************************************
 * 
 * Test sending a text message
 * 
 * @returns Promise that resolves when the test is complete
 * 
 *************************************************************************************/
async function testSendTextMessage() {
    console.log('\n📝 Sending text message...');
    await sendWhatsAppMessage({
        to: RECIPIENT_PHONE,
        message: 'Hello from the API! This is a test message.',
        type: 'text'
    });
}

/*************************************************************************************
 * 
 * Test sending an image message
 * 
 * @returns Promise that resolves when the test is complete
 * 
 *************************************************************************************/
async function testSendImageUrlMessage() {
    console.log('\n🖼️ Sending image from URL...');
    const imageUrl = 'https://picsum.photos/800/600';

    console.log(`Sending image from URL: ${imageUrl}`);

    await sendWhatsAppMessage({
        to: RECIPIENT_PHONE,
        message: imageUrl,
        type: 'image',
        mimeType: 'image/jpeg',
        caption: 'This is a test image sent via URL!'
    });

    console.log('✅ Image sent successfully!');
}

/*************************************************************************************
 * 
 * Test sending an image file message
 * 
 * @returns Promise that resolves when the test is complete
 * 
 *************************************************************************************/
async function testSendImageFileMessage() {
    console.log('\n🖼️ Sending image from URL as base64...');
    const imageUrl = 'https://picsum.photos/800/600';

    try {
        // Download the image and convert to base64 using utility function
        console.log(`Downloading image from: ${imageUrl}`);
        const { base64Data, mimeType, arrayBuffer } = await downloadImageAsBase64(imageUrl);

        // Create data URL
        const dataUrl = `data:${mimeType};base64,${base64Data}`;

        console.log(`Sending image (${(arrayBuffer.byteLength / 1024).toFixed(2)} KB) as base64`);

        await sendWhatsAppMessage({
            to: RECIPIENT_PHONE,
            message: dataUrl,
            type: 'image',
            mimeType: mimeType,
            caption: 'This is a test image sent as base64!'
        });

        console.log('✅ Image sent successfully as base64!');
    } catch (error) {
        console.error('❌ Error sending image:', error instanceof Error ? error.message : String(error));
        throw error;
    }
}


/*************************************************************************************
 * 
 * Test function to demonstrate sending different types of messages
 * 
 * @returns Promise that resolves when all tests are complete
 * 
 *************************************************************************************/
async function testSendMessage() {

    //await testSendTextMessage();
    // await testSendImageUrlMessage();
    await testSendImageFileMessage();



    // Example 3: Send document
    // console.log('\n📄 Sending document...');
    // await sendWhatsAppMessage({
    //   to: '11111111111',
    //   message: 'https://example.com/document.pdf',
    //   type: 'document',
    //   filename: 'test_document.pdf'
    // });

}

// Run the test
testSendMessage().catch(console.error);

export { sendWhatsAppMessage };
