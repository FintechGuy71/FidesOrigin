const sharp = require('sharp');
const fs = require('fs');

const inputFile = '/root/.openclaw/workspace/fidesorigin-demo/brand/og-image.png';
const outputFile = '/root/.openclaw/workspace/fidesorigin-demo/brand/og-image.png';

(async () => {
  try {
    const metadata = await sharp(inputFile).metadata();
    console.log('Original metadata:', metadata.width, 'x', metadata.height, metadata.format);
    
    // Resize to 1200x630 (standard OG size) with compression
    await sharp(inputFile)
      .resize(1200, 630, { fit: 'inside', withoutEnlargement: true })
      .png({ quality: 80, compressionLevel: 9, adaptiveFiltering: true })
      .toFile(outputFile + '.tmp');
    
    const originalSize = fs.statSync(inputFile).size;
    const newSize = fs.statSync(outputFile + '.tmp').size;
    const savings = ((originalSize - newSize) / originalSize * 100).toFixed(1);
    
    console.log(`Original: ${(originalSize / 1024 / 1024).toFixed(2)} MB`);
    console.log(`Optimized: ${(newSize / 1024 / 1024).toFixed(2)} MB`);
    console.log(`Savings: ${savings}%`);
    
    // Replace original with optimized
    fs.renameSync(outputFile + '.tmp', outputFile);
    console.log('Done!');
  } catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
  }
})();
