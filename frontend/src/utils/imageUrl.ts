/**
 * Converts an image path to a full URL
 * Static files are served at /uploads, not /api/uploads
 */
export function getImageUrl(imagePath: string | null | undefined): string | null {
  if (!imagePath) return null;
  
  // If it's already a full URL, return it
  if (imagePath.startsWith('http')) {
    return imagePath;
  }
  
  // Get the base URL without /api
  const apiBaseUrl = import.meta.env.VITE_API_URL || 'http://localhost:8000/api';
  const baseUrl = apiBaseUrl.replace('/api', '');
  
  // Ensure the path starts with /
  const path = imagePath.startsWith('/') ? imagePath : `/${imagePath}`;
  
  return `${baseUrl}${path}`;
}

/**
 * Fixes image URLs in HTML content to use the correct base URL
 * Static files are served at /uploads, not /api/uploads
 */
export function fixImageUrls(html: string): string {
  if (!html) return html;
  
  // Get the base URL without /api
  const apiBaseUrl = import.meta.env.VITE_API_URL || 'http://localhost:8000/api';
  const baseUrl = apiBaseUrl.replace('/api', '');
  
  // Fix URLs that start with /api/uploads or /uploads
  // Replace /api/uploads with /uploads
  let fixed = html.replace(/src=["']\/api\/uploads\//g, `src="${baseUrl}/uploads/`);
  
  // Fix relative /uploads URLs to use full base URL
  fixed = fixed.replace(/src=["']\/uploads\//g, `src="${baseUrl}/uploads/`);
  
  return fixed;
}
