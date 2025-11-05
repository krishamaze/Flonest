#!/usr/bin/env node

/**
 * PWA Icon Generator
 * 
 * This script generates simple placeholder PWA icons for your application.
 * For production, use a professional tool like:
 * - https://realfavicongenerator.net/
 * - https://www.pwabuilder.com/imageGenerator
 * 
 * This creates basic colored squares with text as placeholders.
 */

const fs = require('fs');
const path = require('path');

// Configuration
const config = {
  outputDir: path.join(__dirname, '..', 'public'),
  sizes: [192, 512],
  backgroundColor: '#0ea5e9', // Sky blue (matches theme_color in manifest)
  textColor: '#ffffff',
  text: 'INV', // Short text for the icon
  fontFamily: 'Arial, sans-serif'
};

/**
 * Generate SVG icon
 */
function generateSVG(size, text) {
  const fontSize = Math.floor(size * 0.4);
  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">
  <!-- Background -->
  <rect width="${size}" height="${size}" fill="${config.backgroundColor}" rx="${size * 0.1}"/>
  
  <!-- Icon symbol (box/package icon) -->
  <g transform="translate(${size * 0.5}, ${size * 0.5})">
    <!-- Simple box icon -->
    <rect x="${-size * 0.25}" y="${-size * 0.2}" width="${size * 0.5}" height="${size * 0.4}" 
          fill="none" stroke="${config.textColor}" stroke-width="${size * 0.03}" rx="${size * 0.02}"/>
    <line x1="${-size * 0.25}" y1="${-size * 0.2}" x2="${0}" y2="${-size * 0.35}" 
          stroke="${config.textColor}" stroke-width="${size * 0.03}"/>
    <line x1="${size * 0.25}" y1="${-size * 0.2}" x2="${0}" y2="${-size * 0.35}" 
          stroke="${config.textColor}" stroke-width="${size * 0.03}"/>
    <line x1="${0}" y1="${-size * 0.35}" x2="${0}" y2="${size * 0.2}" 
          stroke="${config.textColor}" stroke-width="${size * 0.03}"/>
  </g>
  
  <!-- Text label -->
  <text x="50%" y="${size * 0.85}" 
        font-family="${config.fontFamily}" 
        font-size="${fontSize * 0.35}" 
        font-weight="bold"
        fill="${config.textColor}" 
        text-anchor="middle" 
        dominant-baseline="middle">
    ${text}
  </text>
</svg>`;
  
  return svg;
}

/**
 * Main function
 */
function generateIcons() {
  console.log('🎨 Generating PWA icons...\n');
  
  // Ensure output directory exists
  if (!fs.existsSync(config.outputDir)) {
    fs.mkdirSync(config.outputDir, { recursive: true });
  }
  
  // Generate SVG icons
  config.sizes.forEach(size => {
    const svg = generateSVG(size, config.text);
    const filename = `pwa-${size}x${size}.svg`;
    const filepath = path.join(config.outputDir, filename);
    
    fs.writeFileSync(filepath, svg, 'utf8');
    console.log(`✅ Generated: ${filename}`);
  });
  
  console.log('\n📋 Next Steps:\n');
  console.log('1. SVG icons have been generated as placeholders');
  console.log('2. For production, convert SVG to PNG using:');
  console.log('   - Online: https://cloudconvert.com/svg-to-png');
  console.log('   - Or use a tool like ImageMagick, Inkscape, or Figma');
  console.log('3. Or use a professional PWA icon generator:');
  console.log('   - https://realfavicongenerator.net/');
  console.log('   - https://www.pwabuilder.com/imageGenerator');
  console.log('\n4. Replace the SVG files with PNG files:');
  console.log('   - pwa-192x192.png');
  console.log('   - pwa-512x512.png');
  console.log('\n💡 Tip: You can also use the SVG files directly by updating manifest.webmanifest');
  console.log('   Change "type": "image/png" to "type": "image/svg+xml"');
  console.log('   Change "src": "/pwa-192x192.png" to "src": "/pwa-192x192.svg"');
}

// Run the generator
try {
  generateIcons();
} catch (error) {
  console.error('❌ Error generating icons:', error.message);
  process.exit(1);
}

