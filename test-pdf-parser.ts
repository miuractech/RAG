/**
 * Local test script for PDF parser
 * 
 * This script tests the PDF parser locally before deployment.
 * Uses unpdf - a lightweight PDF parser designed for edge environments.
 * 
 * Run with: deno run --allow-read --allow-net test-pdf-parser.ts <path-to-pdf>
 */

import { processPdf } from './supabase/functions/_lib/pdf-parser.ts';

async function testPdfParser(filePath: string) {
  console.log('🧪 Testing PDF Parser');
  console.log('====================\n');
  
  try {
    // Read the PDF file
    console.log(`📖 Reading file: ${filePath}`);
    const fileData = await Deno.readFile(filePath);
    console.log(`✅ File loaded (${fileData.length} bytes)\n`);
    
    // Process the PDF
    console.log('🔄 Processing PDF...');
    const startTime = performance.now();
    const result = await processPdf(fileData);
    const endTime = performance.now();
    
    console.log(`✅ Processing complete in ${(endTime - startTime).toFixed(2)}ms\n`);
    
    // Display results
    console.log('📊 Results:');
    console.log(`   - Sections extracted: ${result.sections.length}`);
    
    if (result.sections.length > 0) {
      console.log('\n📄 Section Details:');
      result.sections.forEach((section, index) => {
        console.log(`\n   Section ${index + 1}:`);
        console.log(`   - Page: ${section.pageNumber || 'N/A'}`);
        console.log(`   - Heading: ${section.heading || 'None'}`);
        console.log(`   - Content length: ${section.content.length} characters`);
        if (section.part && section.total) {
          console.log(`   - Part: ${section.part} of ${section.total}`);
        }
        
        // Show first 200 characters of content
        const preview = section.content.substring(0, 200).replace(/\n/g, ' ');
        console.log(`   - Preview: ${preview}...`);
      });
      
      // Statistics
      const totalChars = result.sections.reduce((sum, s) => sum + s.content.length, 0);
      const avgChars = Math.round(totalChars / result.sections.length);
      const maxChars = Math.max(...result.sections.map(s => s.content.length));
      const minChars = Math.min(...result.sections.map(s => s.content.length));
      
      console.log('\n📈 Statistics:');
      console.log(`   - Total characters: ${totalChars}`);
      console.log(`   - Average section size: ${avgChars} chars`);
      console.log(`   - Largest section: ${maxChars} chars`);
      console.log(`   - Smallest section: ${minChars} chars`);
    } else {
      console.log('\n⚠️  Warning: No sections extracted from PDF');
    }
    
    console.log('\n✅ Test completed successfully!');
    
  } catch (error) {
    console.error('\n❌ Error during test:');
    console.error(error);
    Deno.exit(1);
  }
}

// Main execution
if (import.meta.main) {
  const args = Deno.args;
  
  if (args.length === 0) {
    console.log('Usage: deno run --allow-read --allow-net test-pdf-parser.ts <path-to-pdf>');
    console.log('\nExample:');
    console.log('  deno run --allow-read --allow-net test-pdf-parser.ts sample.pdf');
    Deno.exit(1);
  }
  
  const filePath = args[0];
  
  // Check if file exists
  try {
    const fileInfo = await Deno.stat(filePath);
    if (!fileInfo.isFile) {
      console.error(`❌ Error: ${filePath} is not a file`);
      Deno.exit(1);
    }
  } catch (error) {
    console.error(`❌ Error: Cannot access file ${filePath}`);
    console.error(error.message);
    Deno.exit(1);
  }
  
  await testPdfParser(filePath);
}

