// Import required modules
import 'dotenv/config';
import axios from 'axios';
import type { AxiosError } from 'axios';

// Configuration
const USER_API_KEY = process.env.USER_API_KEY || '';
const API_URL = 'http://localhost:5173/api/external/whatsapp/send';

// Types
interface SendMessageOptions {
  to: string;
  message: string;
  type?: 'text' | 'image' | 'document' | 'audio' | 'video' | 'location';
  caption?: string;
  filename?: string;
}

/**
 * Sends a WhatsApp message using the API
 */
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
  } catch (error) {
    const axiosError = error as AxiosError;
    if (axiosError.response) {
      // The request was made and the server responded with a status code
      // that falls out of the range of 2xx
      console.error('❌ Request failed with status:', axiosError.response.status);
      console.error('Response data:', axiosError.response.data);
      throw new Error(`Request failed with status ${axiosError.response.status}`);
    } else if (axiosError.request) {
      // The request was made but no response was received
      console.error('❌ No response received from server');
      throw new Error('No response received from server');
    } else {
      // Something happened in setting up the request that triggered an Error
      console.error('❌ Error setting up request:', axiosError.message);
      throw error;
    }
  }
}

/**
 * Test function to demonstrate sending different types of messages
 */
async function testSendMessage() {
  if (!USER_API_KEY) {
    console.error('❌ Error: USER_API_KEY is not set. Please create a .env file with your API key.');
    console.log('Example .env file:');
    console.log('USER_API_KEY=your_api_key_here');
    return;
  }

  try {
    // Example 1: Send text message
    console.log('\n📝 Sending text message...');
    await sendWhatsAppMessage({
      to: '85298710992',  // Replace with actual number
      message: 'Hello from the API! This is a test message.',
      type: 'text'
    });

    // Example 2: Send image with caption
    // console.log('\n🖼️ Sending image...');
    // await sendWhatsAppMessage({
    //   to: '11111111111',
    //   message: 'https://example.com/image.jpg',
    //   type: 'image',
    //   caption: 'This is a test image sent via API!'
    // });

    // // Example 3: Send document
    // console.log('\n📄 Sending document...');
    // await sendWhatsAppMessage({
    //   to: '11111111111',
    //   message: 'https://example.com/document.pdf',
    //   type: 'document',
    //   filename: 'test_document.pdf'
    // });

    console.log('\n✨ All test messages sent successfully!');
  } catch (error) {
    console.error('\n❌ Test failed:', error instanceof Error ? error.message : error);
  }
}

// Run the test
testSendMessage().catch(console.error);

export { sendWhatsAppMessage };
