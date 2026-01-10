import { extractText } from 'unpdf';

export type Section = {
  content: string;
  heading?: string;
  part?: number;
  total?: number;
  pageNumber?: number;
};

export type ProcessedPdf = {
  sections: Section[];
};

/**
 * Extracts text from PDF and chunks it for embedding.
 * Uses unpdf - a lightweight PDF parser designed for edge environments.
 * 
 * @param pdfBuffer - The PDF file as an ArrayBuffer or Uint8Array
 * @param maxSectionLength - Maximum length of each section in characters (default: 2500)
 * @returns ProcessedPdf object containing sections
 */
export async function processPdf(
  pdfBuffer: ArrayBuffer | Uint8Array,
  maxSectionLength = 2500
): Promise<ProcessedPdf> {
  try {
    // Convert to Uint8Array if needed
    const uint8Array = pdfBuffer instanceof Uint8Array 
      ? pdfBuffer 
      : new Uint8Array(pdfBuffer);
    
    // Extract text from PDF using unpdf
    const { text } = await extractText(uint8Array, { mergePages: true });
    
    if (!text || text.trim().length === 0) {
      console.warn('No text extracted from PDF');
      return { sections: [] };
    }
    
    const sections: Section[] = [];
    const fullText = text.trim();
    
    // Chunk the entire text
    if (fullText.length > maxSectionLength) {
      const numberChunks = Math.ceil(fullText.length / maxSectionLength);
      const chunkSize = Math.ceil(fullText.length / numberChunks);
      
      for (let i = 0; i < numberChunks; i++) {
        const startIdx = i * chunkSize;
        const endIdx = Math.min((i + 1) * chunkSize, fullText.length);
        const chunk = fullText.substring(startIdx, endIdx).trim();
        
        if (chunk) {
          sections.push({
            content: chunk,
            part: i + 1,
            total: numberChunks,
          });
        }
      }
    } else {
      sections.push({
        content: fullText,
      });
    }
    
    return {
      sections,
    };
  } catch (error) {
    console.error('Error processing PDF:', error);
    return {
      sections: [],
    };
  }
}

/**
 * Alternative: Extract text with better formatting preservation
 * Attempts to preserve paragraph structure by processing page by page
 */
export async function processPdfWithFormatting(
  pdfBuffer: ArrayBuffer | Uint8Array,
  maxSectionLength = 2500
): Promise<ProcessedPdf> {
  try {
    const uint8Array = pdfBuffer instanceof Uint8Array 
      ? pdfBuffer 
      : new Uint8Array(pdfBuffer);
    
    // Extract text page by page to preserve structure
    const result = await extractText(uint8Array, { mergePages: false });
    const pages = Array.isArray(result.text) ? result.text : [result.text];
    
    // Combine all pages into one text
    const fullText = pages.join('\n\n').trim();
    
    if (!fullText || fullText.length === 0) {
      return { sections: [] };
    }
    
    // Split by double newlines to preserve paragraphs
    const paragraphs = fullText.split(/\n\n+/).filter((p: string) => p.trim().length > 0);
    const sections: Section[] = [];
    let currentChunk = '';
    
    for (const paragraph of paragraphs) {
      const trimmedParagraph = paragraph.trim();
      
      // If adding this paragraph would exceed max length, save current chunk
      if (currentChunk && (currentChunk.length + trimmedParagraph.length + 2) > maxSectionLength) {
        sections.push({
          content: currentChunk.trim(),
        });
        currentChunk = trimmedParagraph;
      } else {
        currentChunk += (currentChunk ? '\n\n' : '') + trimmedParagraph;
      }
    }
    
    // Add final chunk
    if (currentChunk.trim()) {
      sections.push({
        content: currentChunk.trim(),
      });
    }
    
    return {
      sections,
    };
  } catch (error) {
    console.error('Error processing PDF:', error);
    return {
      sections: [],
    };
  }
}

