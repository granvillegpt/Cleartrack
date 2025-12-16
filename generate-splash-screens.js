#!/usr/bin/env node

/**
 * Script to generate iOS splash screens for ClearTrack PWA
 * Creates splash screens with logo centered on white background
 */

const fs = require('fs');
const path = require('path');

// Check if sharp is available
let sharp;
try {
  sharp = require('sharp');
} catch (e) {
  console.error('Error: sharp package is not installed.');
  console.error('Please install it first: npm install sharp');
  process.exit(1);
}

const LOGO_SOURCE = path.join(__dirname, 'public', 'assets', 'images', 'icon logo.png');
const SPLASH_DIR = path.join(__dirname, 'public', 'splash');
const BACKGROUND_COLOR = '#ffffff'; // White background
const LOGO_SIZE_PERCENT = 0.4; // Logo will be 40% of screen width

// Common iOS splash screen sizes (width x height)
const SPLASH_SIZES = [
  // iPhone sizes
  { width: 750, height: 1334, name: 'iphone-se', device: 'iPhone SE' },
  { width: 828, height: 1792, name: 'iphone-xr', device: 'iPhone XR / 11' },
  { width: 1125, height: 2436, name: 'iphone-xs', device: 'iPhone X / XS / 11 Pro' },
  { width: 1170, height: 2532, name: 'iphone-12', device: 'iPhone 12 / 13 / 14' },
  { width: 1179, height: 2556, name: 'iphone-14-pro', device: 'iPhone 14 Pro' },
  { width: 1242, height: 2208, name: 'iphone-8-plus', device: 'iPhone 8 Plus' },
  { width: 1242, height: 2688, name: 'iphone-xs-max', device: 'iPhone XS Max / 11 Pro Max' },
  { width: 1284, height: 2778, name: 'iphone-12-pro-max', device: 'iPhone 12/13/14 Pro Max' },
  { width: 1290, height: 2796, name: 'iphone-14-pro-max', device: 'iPhone 14 Pro Max' },
  
  // iPad sizes
  { width: 1536, height: 2048, name: 'ipad-mini', device: 'iPad Mini' },
  { width: 1620, height: 2160, name: 'ipad', device: 'iPad' },
  { width: 1640, height: 2360, name: 'ipad-air', device: 'iPad Air' },
  { width: 1668, height: 2388, name: 'ipad-pro-11', device: 'iPad Pro 11"' },
  { width: 2048, height: 2732, name: 'ipad-pro-12', device: 'iPad Pro 12.9"' },
];

async function generateSplashScreen(size) {
  const logoSize = Math.round(size.width * LOGO_SIZE_PERCENT);
  const outputPath = path.join(SPLASH_DIR, `splash-${size.name}.png`);
  
  console.log(`Generating ${size.name} (${size.width}x${size.height}) - ${size.device}...`);
  
  try {
    // Load and resize logo
    const logo = sharp(LOGO_SOURCE)
      .resize(logoSize, logoSize, {
        fit: 'contain',
        background: { r: 255, g: 255, b: 255, alpha: 0 }
      });
    
    // Create white background
    const background = sharp({
      create: {
        width: size.width,
        height: size.height,
        channels: 4,
        background: { r: 255, g: 255, b: 255, alpha: 1 }
      }
    });
    
    // Composite logo centered on background
    await sharp({
      create: {
        width: size.width,
        height: size.height,
        channels: 4,
        background: { r: 255, g: 255, b: 255, alpha: 1 }
      }
    })
      .composite([{
        input: await logo.toBuffer(),
        top: Math.round((size.height - logoSize) / 2),
        left: Math.round((size.width - logoSize) / 2)
      }])
      .png()
      .toFile(outputPath);
    
    console.log(`  ✅ Created splash-${size.name}.png`);
  } catch (error) {
    console.error(`  ❌ Error creating ${size.name}:`, error.message);
    throw error;
  }
}

async function main() {
  // Check if logo exists
  if (!fs.existsSync(LOGO_SOURCE)) {
    console.error(`Error: Logo file not found at ${LOGO_SOURCE}`);
    process.exit(1);
  }
  
  // Create splash directory if it doesn't exist
  if (!fs.existsSync(SPLASH_DIR)) {
    fs.mkdirSync(SPLASH_DIR, { recursive: true });
  }
  
  console.log('Generating iOS splash screens...');
  console.log(`Logo source: ${LOGO_SOURCE}`);
  console.log(`Output directory: ${SPLASH_DIR}`);
  console.log(`Logo size: ${(LOGO_SIZE_PERCENT * 100).toFixed(0)}% of screen width`);
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
    console.log('Next steps:');
    console.log('1. Add splash screen meta tags to your HTML files');
    console.log('2. Deploy to your server');
  } catch (error) {
    console.error('Error generating splash screens:', error);
    process.exit(1);
  }
}

main();




