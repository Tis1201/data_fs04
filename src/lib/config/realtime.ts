export function getSseEndpoint(): string {
  // Prefer Vite env at build time, fallback to runtime global, then default
  const viteValue = (import.meta as any)?.env?.VITE_SSE_PUBLIC_ENDPOINT;
  const runtimeValue = (globalThis as any)?.__SSE_PUBLIC_ENDPOINT__;
  return (typeof viteValue === 'string' && viteValue) || (typeof runtimeValue === 'string' && runtimeValue) || '/api/sse';
}


