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
 * Downloads a file from a URL and converts it to base64 format
 * @param fileUrl The URL of the file to download
 * @param defaultMimeType The default MIME type to use if not provided in the response headers (default: 'application/octet-stream')
 * @returns Promise resolving to an object containing the base64 data, MIME type, and original ArrayBuffer
 * @throws Error if the download fails or the response is not OK
 */
export async function downloadFileAsBase64(
    fileUrl: string,
    defaultMimeType: string = 'application/octet-stream'
): Promise<ImageDownloadResult> {
    const response = await fetch(fileUrl);
    if (!response.ok) {
        throw new Error(`Failed to download file: ${response.status} ${response.statusText}`);
    }
    
    const arrayBuffer = await response.arrayBuffer();
    const base64Data = Buffer.from(arrayBuffer).toString('base64');
    const mimeType = response.headers.get('content-type') || defaultMimeType;
    
    return { base64Data, mimeType, arrayBuffer };
}

/** @deprecated Use downloadFileAsBase64 instead */
export const downloadImageAsBase64 = downloadFileAsBase64;

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
