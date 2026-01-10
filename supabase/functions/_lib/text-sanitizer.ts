/**
 * Text Sanitizer for Edge Functions
 * Cleans text content to prevent ByteString errors in Supabase AI
 */

/**
 * Sanitizes text content by removing invalid UTF-8 characters,
 * null bytes, and other problematic characters that can cause
 * "Value is not a valid ByteString" errors.
 * 
 * @param text - The text to sanitize
 * @returns Sanitized text safe for Supabase AI processing
 */
export function sanitizeText(text: string): string {
  if (!text || typeof text !== 'string') {
    return '';
  }

  try {
    // Remove null bytes
    let cleaned = text.replace(/\0/g, '');
    
    // Remove other control characters except newlines, tabs, and carriage returns
    cleaned = cleaned.replace(/[\x00-\x08\x0B-\x0C\x0E-\x1F\x7F]/g, '');
    
    // Remove invalid Unicode sequences (replacement character)
    cleaned = cleaned.replace(/\uFFFD/g, '');
    
    // Normalize Unicode to NFC form (composed form)
    cleaned = cleaned.normalize('NFC');
    
    // Replace multiple consecutive spaces with a single space
    cleaned = cleaned.replace(/ {2,}/g, ' ');
    
    // Replace multiple consecutive newlines with at most 2 newlines
    cleaned = cleaned.replace(/\n{3,}/g, '\n\n');
    
    // Trim whitespace from start and end
    cleaned = cleaned.trim();
    
    // Ensure the text is not empty after cleaning
    if (!cleaned) {
      return '';
    }
    
    // Final validation: ensure it's valid UTF-8 by encoding and decoding
    // This helps catch any remaining encoding issues
    const encoder = new TextEncoder();
    const decoder = new TextDecoder('utf-8', { fatal: false });
    const encoded = encoder.encode(cleaned);
    cleaned = decoder.decode(encoded);
    
    return cleaned;
  } catch (error) {
    console.error('Error sanitizing text:', error);
    // If all else fails, return a safe fallback
    return text
      .replace(/[^\x20-\x7E\n\r\t]/g, '') // Keep only printable ASCII + whitespace
      .trim();
  }
}

/**
 * Truncates text to a maximum length while trying to preserve word boundaries
 * 
 * @param text - The text to truncate
 * @param maxLength - Maximum length in characters
 * @returns Truncated text
 */
export function truncateText(text: string, maxLength: number): string {
  if (!text || text.length <= maxLength) {
    return text;
  }

  // Try to truncate at a word boundary
  const truncated = text.substring(0, maxLength);
  const lastSpace = truncated.lastIndexOf(' ');
  
  if (lastSpace > maxLength * 0.8) {
    // If we found a space in the last 20% of the text, use it
    return truncated.substring(0, lastSpace).trim() + '...';
  }
  
  // Otherwise, just truncate at the maxLength
  return truncated.trim() + '...';
}

/**
 * Validates that text is safe for AI model processing
 * 
 * @param text - The text to validate
 * @returns Object with validation result and sanitized text
 */
export function validateAndSanitizeText(text: string): {
  isValid: boolean;
  sanitized: string;
  errors: string[];
} {
  const errors: string[] = [];
  
  if (!text) {
    errors.push('Text is empty or undefined');
    return { isValid: false, sanitized: '', errors };
  }
  
  if (typeof text !== 'string') {
    errors.push('Text is not a string');
    return { isValid: false, sanitized: '', errors };
  }
  
  // Check for null bytes
  if (text.includes('\0')) {
    errors.push('Text contains null bytes');
  }
  
  // Check for excessive control characters
  const controlChars = text.match(/[\x00-\x1F\x7F]/g);
  if (controlChars && controlChars.length > text.length * 0.1) {
    errors.push('Text contains excessive control characters');
  }
  
  // Sanitize the text
  const sanitized = sanitizeText(text);
  
  if (!sanitized) {
    errors.push('Text became empty after sanitization');
    return { isValid: false, sanitized, errors };
  }
  
  return {
    isValid: errors.length === 0,
    sanitized,
    errors
  };
}
