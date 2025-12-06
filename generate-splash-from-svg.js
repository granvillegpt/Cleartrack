#!/usr/bin/env node

/**
 * Script to generate splash screens from SVG design for all device sizes
 */

const fs = require('fs');
const path = require('path');

let sharp;
try {
  sharp = require('sharp');
} catch (e) {
  console.error('Error: sharp package is not installed.');
  console.error('Please install it first: npm install sharp');
  process.exit(1);
}

const SVG_SOURCE = path.join(__dirname, 'public', 'splash', 'splash-design.svg');
const SPLASH_DIR = path.join(__dirname, 'public', 'splash');

// All device sizes
const SPLASH_SIZES = [
  { width: 750, height: 1334, name: 'iphone-se' },
  { width: 828, height: 1792, name: 'iphone-xr' },
  { width: 1125, height: 2436, name: 'iphone-xs' },
  { width: 1170, height: 2532, name: 'iphone-12' },
  { width: 1179, height: 2556, name: 'iphone-14-pro' },
  { width: 1242, height: 2208, name: 'iphone-8-plus' },
  { width: 1242, height: 2688, name: 'iphone-xs-max' },
  { width: 1284, height: 2778, name: 'iphone-12-pro-max' },
  { width: 1290, height: 2796, name: 'iphone-14-pro-max' },
  { width: 1536, height: 2048, name: 'ipad-mini' },
  { width: 1620, height: 2160, name: 'ipad' },
  { width: 1640, height: 2360, name: 'ipad-air' },
  { width: 1668, height: 2388, name: 'ipad-pro-11' },
  { width: 2048, height: 2732, name: 'ipad-pro-12' },
];

async function generateSplashScreen(size) {
  const outputPath = path.join(SPLASH_DIR, `splash-${size.name}.png`);
  
  console.log(`Generating ${size.name} (${size.width}x${size.height})...`);
  
  try {
    // Read SVG and convert to PNG with exact dimensions
    await sharp(SVG_SOURCE)
      .resize(size.width, size.height, {
        fit: 'cover', // Cover the entire area
        background: { r: 255, g: 255, b: 255, alpha: 1 }
      })
      .png()
      .toFile(outputPath);
    
    console.log(`  ✅ Created splash-${size.name}.png`);
  } catch (error) {
    console.error(`  ❌ Error creating ${size.name}:`, error.message);
    throw error;
  }
}

async function main() {
  // Check if SVG exists
  if (!fs.existsSync(SVG_SOURCE)) {
    console.error(`Error: SVG file not found at ${SVG_SOURCE}`);
    console.error('Please ensure the SVG file is in the splash folder.');
    process.exit(1);
  }
  
  if (!fs.existsSync(SPLASH_DIR)) {
    fs.mkdirSync(SPLASH_DIR, { recursive: true });
  }
  
  console.log('Generating splash screens from SVG design...');
  console.log(`SVG source: ${SVG_SOURCE}`);
  console.log(`Output directory: ${SPLASH_DIR}`);
  console.log('');
  
  try {
    // Generate all splash screens
    for (const size of SPLASH_SIZES) {
      await generateSplashScreen(size);
    }
    
    console.log('');
    console.log('✅ All splash screens generated successfully!');
    console.log(`Splash screens saved in: ${SPLASH_DIR}/`);
    console.log('');
    console.log('The splash screens are ready to use. They will be automatically');
    console.log('loaded when users add your app to their home screen.');
  } catch (error) {
    console.error('Error generating splash screens:', error);
    process.exit(1);
  }
}

main();




