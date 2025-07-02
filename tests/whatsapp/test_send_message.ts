/*************************************************************************************
 * 
 * Tests for Sending Whatsapp Messages
 * 
 *************************************************************************************/

import 'dotenv/config';
import axios from 'axios';
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
  try {
    if (!USER_API_KEY) {
      throw new Error('API key is required. Please set USER_API_KEY in your .env file');
    }

    //API_URL to add int the account_id e.g. /xxxxxx
    const account_id = 'cmcijjh4g006lley89dgfzczz';

    const SEND_URL = `${API_URL}/${account_id}`;

    const response = await axios({
      method: 'post',
      url: SEND_URL,
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': `${USER_API_KEY}`
      },
      data: {
        to: options.to,
        message: options.message,
        type: options.type || 'text',
        ...(options.caption && { caption: options.caption }),
        ...(options.filename && { filename: options.filename })
      },
      validateStatus: () => true // Don't throw on HTTP error status
    });

    // Log the full response for debugging
    console.log('Response status:', response.status);
    console.log('Response headers:', response.headers);
    
    // Check if response is JSON
    const contentType = response.headers['content-type'] || '';
    if (!contentType.includes('application/json')) {
      console.error('❌ Unexpected response format. Expected JSON but got:', contentType);
      console.error('Response data (first 500 chars):', 
        String(response.data).substring(0, 500));
      throw new Error(`Unexpected response format. Expected JSON but got ${contentType}`);
    }

    if (response.status >= 400) {
      const errorMsg = response.data?.error?.message || 
                     response.data?.message || 
                     `Request failed with status ${response.status}`;
      throw new Error(errorMsg);
    }

    console.log('✅ Message sent successfully:', response.data);
    return response.data;
  } catch (error: any) {
    const errorMessage = error.response
      ? `Request failed with status ${error.response.status}: ${JSON.stringify(error.response.data)}`
      : error.request
        ? 'No response received from server'
        : `Request setup error: ${error.message}`;
    
    console.error(`❌ ${errorMessage}`);
    throw new Error(errorMessage);
  }
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
    console.log('\n🖼️ Sending image from file...');
    const imagePath = 'path/to/your/image.jpg';
    
    console.log(`Sending image from file: ${imagePath}`);
    
    await sendWhatsAppMessage({
      to: RECIPIENT_PHONE,
      message: imagePath,
      type: 'image',
      mimeType: 'image/jpeg',
      caption: 'This is a test image sent from a file!'
    });
    
    console.log('✅ Image sent successfully!');
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
