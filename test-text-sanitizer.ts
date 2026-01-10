/**
 * Test script for text sanitizer
 * Run with: deno run test-text-sanitizer.ts
 */

// Import the sanitizer (adjust path as needed)
import { sanitizeText, truncateText, validateAndSanitizeText } from './supabase/functions/_lib/text-sanitizer.ts';

console.log('Testing Text Sanitizer...\n');

// Test 1: Null bytes
console.log('Test 1: Null bytes');
const textWithNulls = 'Hello\x00World\x00Test';
const sanitized1 = sanitizeText(textWithNulls);
console.log(`Input:  "${textWithNulls.replace(/\x00/g, '\\0')}"`);
console.log(`Output: "${sanitized1}"`);
console.log(`✓ Null bytes removed: ${!sanitized1.includes('\x00')}\n`);

// Test 2: Control characters
console.log('Test 2: Control characters');
const textWithControls = 'Hello\x01\x02\x03World\x07Test';
const sanitized2 = sanitizeText(textWithControls);
console.log(`Input:  "${textWithControls.replace(/[\x01-\x07]/g, '\\x')}"`);
console.log(`Output: "${sanitized2}"`);
console.log(`✓ Control chars removed: ${sanitized2 === 'HelloWorldTest'}\n`);

// Test 3: Invalid Unicode
console.log('Test 3: Invalid Unicode replacement character');
const textWithInvalidUnicode = 'Hello\uFFFDWorld';
const sanitized3 = sanitizeText(textWithInvalidUnicode);
console.log(`Input:  "Hello�World"`);
console.log(`Output: "${sanitized3}"`);
console.log(`✓ Invalid Unicode removed: ${!sanitized3.includes('\uFFFD')}\n`);

// Test 4: Multiple spaces
console.log('Test 4: Multiple spaces');
const textWithSpaces = 'Hello    World     Test';
const sanitized4 = sanitizeText(textWithSpaces);
console.log(`Input:  "${textWithSpaces}"`);
console.log(`Output: "${sanitized4}"`);
console.log(`✓ Multiple spaces normalized: ${sanitized4 === 'Hello World Test'}\n`);

// Test 5: Multiple newlines
console.log('Test 5: Multiple newlines');
const textWithNewlines = 'Hello\n\n\n\nWorld\n\n\n\nTest';
const sanitized5 = sanitizeText(textWithNewlines);
console.log(`Input:  "Hello\\n\\n\\n\\nWorld\\n\\n\\n\\nTest"`);
console.log(`Output: "${sanitized5.replace(/\n/g, '\\n')}"`);
console.log(`✓ Multiple newlines normalized: ${(sanitized5.match(/\n/g) || []).length <= 6}\n`);

// Test 6: PDF-like text with mixed issues
console.log('Test 6: Complex PDF-like text');
const pdfText = 'This is a\x00PDF with\x01special\uFFFD    chars\n\n\n\nand   spacing';
const sanitized6 = sanitizeText(pdfText);
console.log(`Input:  Complex text with nulls, controls, and spacing issues`);
console.log(`Output: "${sanitized6}"`);
console.log(`✓ All issues cleaned: ${
  !sanitized6.includes('\x00') && 
  !sanitized6.includes('\x01') && 
  !sanitized6.includes('\uFFFD') &&
  !sanitized6.includes('    ')
}\n`);

// Test 7: Truncate text
console.log('Test 7: Text truncation');
const longText = 'This is a very long text that needs to be truncated at some point to avoid exceeding limits.';
const truncated = truncateText(longText, 50);
console.log(`Input:  "${longText}"`);
console.log(`Output: "${truncated}"`);
console.log(`✓ Truncated correctly: ${truncated.length <= 53 && truncated.endsWith('...')}\n`);

// Test 8: Validation
console.log('Test 8: Validation with errors');
const badText = 'Text with\x00nulls and\uFFFDinvalid unicode';
const validation = validateAndSanitizeText(badText);
console.log(`Input:  Text with issues`);
console.log(`Valid:  ${validation.isValid}`);
console.log(`Errors: ${validation.errors.join(', ')}`);
console.log(`Output: "${validation.sanitized}"`);
console.log(`✓ Validation detected issues: ${validation.errors.length > 0}\n`);

// Test 9: Empty or whitespace-only text
console.log('Test 9: Empty text handling');
const emptyText = '   \n\n  \t  ';
const sanitized9 = sanitizeText(emptyText);
console.log(`Input:  "   \\n\\n  \\t  "`);
console.log(`Output: "${sanitized9}"`);
console.log(`✓ Empty text handled: ${sanitized9 === ''}\n`);

// Test 10: Normal text (should pass through mostly unchanged)
console.log('Test 10: Normal text');
const normalText = 'This is a normal sentence with punctuation! Numbers 123. And unicode: 你好世界';
const sanitized10 = sanitizeText(normalText);
console.log(`Input:  "${normalText}"`);
console.log(`Output: "${sanitized10}"`);
console.log(`✓ Normal text preserved: ${normalText === sanitized10}\n`);

console.log('All tests completed! ✓');
