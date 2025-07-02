import axios, { type AxiosRequestConfig, type AxiosResponse } from 'axios';

/**
 * HTTP-related utility functions
 * These functions are compatible with both browser and Node.js environments
 * and provide common HTTP operations like downloading and processing remote resources
 */

interface HttpPostOptions<T = any> extends Omit<AxiosRequestConfig, 'method' | 'url' | 'data'> {
  url: string;
  data?: T;
  throwOnError?: boolean;
}

type ImageDownloadResult = {
    base64Data: string;
    mimeType: string;
    arrayBuffer: ArrayBuffer;
};

/**
 * Downloads an image from a URL and converts it to base64 format
 * @param imageUrl The URL of the image to download
 * @param defaultMimeType The default MIME type to use if not provided in the response headers (default: 'image/jpeg')
 * @returns Promise resolving to an object containing the base64 data, MIME type, and original ArrayBuffer
 * @throws Error if the download fails or the response is not OK
 */
export async function downloadImageAsBase64(
    imageUrl: string,
    defaultMimeType: string = 'image/jpeg'
): Promise<ImageDownloadResult> {
    const response = await fetch(imageUrl);
    if (!response.ok) {
        throw new Error(`Failed to download image: ${response.status} ${response.statusText}`);
    }
    
    const arrayBuffer = await response.arrayBuffer();
    const base64Data = Buffer.from(arrayBuffer).toString('base64');
    const mimeType = response.headers.get('content-type') || defaultMimeType;
    
    return { base64Data, mimeType, arrayBuffer };
}

/**
 * Makes an HTTP POST request with consistent error handling
 * @param options HTTP POST options including url, headers, data, etc.
 * @returns Promise resolving to the Axios response
 * @throws Error if the request fails and throwOnError is true
 */
export async function httpPost<T = any, R = any>({
  url,
  data,
  headers = {},
  throwOnError = false,
  ...config
}: HttpPostOptions<T>): Promise<AxiosResponse<R>> {
  const defaultHeaders = {
    'Content-Type': 'application/json',
    ...headers
  };

  const response = await axios({
    method: 'post',
    url,
    data,
    headers: defaultHeaders,
    validateStatus: () => !throwOnError, // Only throw if throwOnError is true
    ...config
  });

  return response;
}
