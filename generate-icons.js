#!/usr/bin/env node

/**
 * Script to generate ClearTrack app icons with smaller logo
 * The logo will be 70% of the icon size (instead of filling it)
 * 
 * Usage: node generate-icons.js [logo-size-percentage]
 * Example: node generate-icons.js 0.7  (70% of icon size)
 */

const fs = require('fs');
const path = require('path');

// Check if sharp is available, if not, provide instructions
let sharp;
try {
  sharp = require('sharp');
} catch (e) {
  console.error('Error: sharp package is not installed.');
  console.error('');
  console.error('Please install it first:');
  console.error('  npm install sharp');
  console.error('');
  console.error('Or use the ImageMagick script: ./generate-icons.sh');
  process.exit(1);
}

const LOGO_SOURCE = path.join(__dirname, 'public', 'assets', 'images', 'icon logo.png');
const ICONS_DIR = path.join(__dirname, 'public', 'icons');

// Logo size as percentage of icon size (default 70%)
const LOGO_SIZE_PERCENT = parseFloat(process.argv[2]) || 0.7;

// Icon sizes to generate
const ICON_SIZES = [
  { size: 72, name: 'cleartrack-72.png' },
  { size: 96, name: 'cleartrack-96.png' },
  { size: 128, name: 'cleartrack-128.png' },
  { size: 144, name: 'cleartrack-144.png' },
  { size: 152, name: 'cleartrack-152.png' },
  { size: 192, name: 'cleartrack-192.png' },
  { size: 384, name: 'cleartrack-384.png' },
  { size: 512, name: 'cleartrack-512.png' },
];

// Maskable icon (logo at 60% for safe zone)
const MASKABLE_ICON = {
  size: 512,
  name: 'cleartrack-512-maskable.png',
  logoPercent: 0.6
};

async function generateIcon(iconSize, filename, logoPercent = LOGO_SIZE_PERCENT) {
  const logoSize = Math.round(iconSize * logoPercent);
  
  console.log(`Generating ${filename} (${iconSize}x${iconSize}) with logo size ${logoSize}x${logoSize}...`);
  
  try {
    // Create a white background
    const background = sharp({
      create: {
        width: iconSize,
        height: iconSize,
        channels: 4,
        background: { r: 255, g: 255, b: 255, alpha: 1 }
      }
    });
    
    // Resize logo
    const logo = sharp(LOGO_SOURCE)
      .resize(logoSize, logoSize, {
        fit: 'contain',
        background: { r: 255, g: 255, b: 255, alpha: 0 }
      });
    
    // Composite logo on background (centered)
    const outputPath = path.join(ICONS_DIR, filename);
    await sharp({
      create: {
        width: iconSize,
        height: iconSize,
        channels: 4,
        background: { r: 255, g: 255, b: 255, alpha: 1 }
      }
    })
      .composite([{
        input: await logo.toBuffer(),
        top: Math.round((iconSize - logoSize) / 2),
        left: Math.round((iconSize - logoSize) / 2)
      }])
      .png()
      .toFile(outputPath);
    
    console.log(`  ✅ Created ${filename}`);
  } catch (error) {
    console.error(`  ❌ Error creating ${filename}:`, error.message);
    throw error;
  }
}

async function main() {
  // Check if logo exists
  if (!fs.existsSync(LOGO_SOURCE)) {
    console.error(`Error: Logo file not found at ${LOGO_SOURCE}`);
    process.exit(1);
  }
  
  // Create icons directory if it doesn't exist
  if (!fs.existsSync(ICONS_DIR)) {
    fs.mkdirSync(ICONS_DIR, { recursive: true });
  }
  
  console.log(`Generating icons with logo at ${(LOGO_SIZE_PERCENT * 100).toFixed(0)}% of icon size...`);
  console.log(`Logo source: ${LOGO_SOURCE}`);
  console.log(`Output directory: ${ICONS_DIR}`);
  console.log('');
  
  try {
    // Generate all standard icons
    for (const icon of ICON_SIZES) {
      await generateIcon(icon.size, icon.name);
    }
    
    // Generate maskable icon
    console.log(`Generating maskable icon (logo at ${(MASKABLE_ICON.logoPercent * 100).toFixed(0)}% for safe zone)...`);
    await generateIcon(MASKABLE_ICON.size, MASKABLE_ICON.name, MASKABLE_ICON.logoPercent);
    
    console.log('');
    console.log('✅ All icons generated successfully!');
    console.log(`Icons saved in: ${ICONS_DIR}/`);
    console.log('');
    console.log('Next steps:');
    console.log('1. Review the generated icons');
    console.log(`2. If you want the logo smaller, run: node generate-icons.js ${(LOGO_SIZE_PERCENT - 0.1).toFixed(1)}`);
    console.log('3. Deploy to your server');
    console.log('4. Clear browser cache and re-add to home screen');
  } catch (error) {
    console.error('Error generating icons:', error);
    process.exit(1);
  }
}

main();




