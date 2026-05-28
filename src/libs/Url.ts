// import 'react-native-url-polyfill/auto';

/**
 * Add / to the end of any URL if not present
 */
function addTrailingForwardSlash(url: string): string {
  if (!url.endsWith('/')) {
    return `${url}/`;
  }
  return url;
}

/**
 * Get path from URL string
 */
function getPathFromURL(url: string): string {
  try {
    const parsedUrl = new URL(url);
    const path = parsedUrl.pathname + parsedUrl.search + parsedUrl.hash;
    return path.substring(1); // Remove the leading '/'
  } catch (error) {
    console.error('Error parsing URL:', error);
    return ''; // Return empty string for invalid URLs
  }
}

/**
 * Whether two URLs share the same origin (protocol + host + port)
 */
function hasSameOrigin(url1: string, url2: string): boolean {
  try {
    return new URL(url1).origin === new URL(url2).origin;
  } catch {
    return false;
  }
}

export {addTrailingForwardSlash, getPathFromURL, hasSameOrigin};
