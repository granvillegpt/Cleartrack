#!/usr/bin/env node

/**
 * Script to generate creative splash screen variations for ClearTrack PWA
 * Creates multiple design variations with logo and app name
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
const FULL_LOGO_SOURCE = path.join(__dirname, 'public', 'assets', 'images', 'full logo CT.png');
const SPLASH_DIR = path.join(__dirname, 'public', 'splash', 'variations');
const PRIMARY_COLOR = '#0b7285'; // Teal
const PRIMARY_DARK = '#095a69';
const BG_SOFT = '#e5f3f7';

// Sample sizes for variations (iPhone 12/13/14 - most common)
const SAMPLE_SIZE = { width: 1170, height: 2532 };

// Design variations
const VARIATIONS = [
  {
    name: 'gradient-teal',
    description: 'Gradient teal background with centered logo and text',
    bgType: 'gradient'
  },
  {
    name: 'white-with-accent',
    description: 'White background with teal accent bar and logo',
    bgType: 'white-accent'
  },
  {
    name: 'teal-full',
    description: 'Full teal background with white logo and text',
    bgType: 'teal-full'
  },
  {
    name: 'minimal-pattern',
    description: 'Minimal white with subtle pattern and logo',
    bgType: 'pattern'
  },
  {
    name: 'split-design',
    description: 'Split design with teal top and white bottom',
    bgType: 'split'
  }
];

async function createGradientBackground(width, height, color1, color2) {
  // Create SVG gradient
  const svg = `
    <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="grad" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" style="stop-color:${color1};stop-opacity:1" />
          <stop offset="100%" style="stop-color:${color2};stop-opacity:1" />
        </linearGradient>
      </defs>
      <rect width="${width}" height="${height}" fill="url(#grad)" />
    </svg>
  `;
  return Buffer.from(svg);
}

async function createPatternBackground(width, height) {
  // Create subtle pattern SVG
  const svg = `
    <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <pattern id="pattern" x="0" y="0" width="100" height="100" patternUnits="userSpaceOnUse">
          <circle cx="50" cy="50" r="2" fill="${PRIMARY_COLOR}" opacity="0.1"/>
        </pattern>
      </defs>
      <rect width="${width}" height="${height}" fill="#ffffff" />
      <rect width="${width}" height="${height}" fill="url(#pattern)" />
    </svg>
  `;
  return Buffer.from(svg);
}

async function createTextSVG(text, fontSize, color, x, y) {
  const svg = `
    <svg width="800" height="200" xmlns="http://www.w3.org/2000/svg">
      <text x="${x}" y="${y}" font-family="system-ui, -apple-system, sans-serif" 
            font-size="${fontSize}" font-weight="700" fill="${color}" 
            text-anchor="middle" letter-spacing="0.05em">${text}</text>
    </svg>
  `;
  return Buffer.from(svg);
}

async function generateVariation(variation, size) {
  const outputPath = path.join(SPLASH_DIR, `splash-${variation.name}-${size.width}x${size.height}.png`);
  const logoSize = Math.round(size.width * 0.25); // 25% of width
  const textSize = Math.round(size.width * 0.08); // 8% of width
  
  console.log(`Generating ${variation.name}...`);
  
  try {
    let background;
    
    // Create background based on variation type
    switch (variation.bgType) {
      case 'gradient':
        // Gradient from teal to light teal
        background = await createGradientBackground(size.width, size.height, PRIMARY_COLOR, BG_SOFT);
        break;
      case 'white-accent':
        // White with teal accent bar at top
        const accentSvg = `
          <svg width="${size.width}" height="${size.height}" xmlns="http://www.w3.org/2000/svg">
            <rect width="${size.width}" height="${size.height}" fill="#ffffff"/>
            <rect width="${size.width}" height="${size.height * 0.15}" fill="${PRIMARY_COLOR}"/>
          </svg>
        `;
        background = Buffer.from(accentSvg);
        break;
      case 'teal-full':
        // Full teal background
        background = await sharp({
          create: {
            width: size.width,
            height: size.height,
            channels: 4,
            background: { r: 11, g: 114, b: 133, alpha: 1 }
          }
        }).png().toBuffer();
        break;
      case 'pattern':
        // Pattern background
        background = await createPatternBackground(size.width, size.height);
        break;
      case 'split':
        // Split design - teal top, white bottom
        const splitSvg = `
          <svg width="${size.width}" height="${size.height}" xmlns="http://www.w3.org/2000/svg">
            <rect width="${size.width}" height="${size.height * 0.5}" fill="${PRIMARY_COLOR}"/>
            <rect y="${size.height * 0.5}" width="${size.width}" height="${size.height * 0.5}" fill="#ffffff"/>
          </svg>
        `;
        background = Buffer.from(splitSvg);
        break;
      default:
        background = await sharp({
          create: {
            width: size.width,
            height: size.height,
            channels: 4,
            background: { r: 255, g: 255, b: 255, alpha: 1 }
          }
        }).png().toBuffer();
    }
    
    // Load and resize logo
    const logo = sharp(LOGO_SOURCE)
      .resize(logoSize, logoSize, {
        fit: 'contain',
        background: { r: 255, g: 255, b: 255, alpha: 0 }
      });
    
    // Create text
    const textColor = (variation.bgType === 'teal-full' || variation.bgType === 'split') ? '#ffffff' : PRIMARY_COLOR;
    const textY = variation.bgType === 'split' ? 100 : 120;
    const text = await createTextSVG('ClearTrack', textSize, textColor, 400, textY);
    
    // Calculate positions
    const logoY = Math.round((size.height * 0.4) - (logoSize / 2));
    const textYPos = Math.round(size.height * 0.55);
    const logoX = Math.round((size.width - logoSize) / 2);
    const textX = Math.round(size.width / 2);
    
    // Composite everything
    const composites = [
      {
        input: await logo.toBuffer(),
        top: logoY,
        left: logoX
      },
      {
        input: text,
        top: textYPos - 100,
        left: textX - 400
      }
    ];
    
    // For split design, adjust logo position
    if (variation.bgType === 'split') {
      composites[0].top = Math.round((size.height * 0.25) - (logoSize / 2));
      // Make logo white for split design
      const whiteLogo = await sharp(LOGO_SOURCE)
        .resize(logoSize, logoSize, {
          fit: 'contain',
          background: { r: 255, g: 255, b: 255, alpha: 0 }
        })
        .composite([{
          input: Buffer.from(`<svg><rect width="${logoSize}" height="${logoSize}" fill="white"/></svg>`),
          blend: 'multiply'
        }])
        .toBuffer();
      composites[0].input = whiteLogo;
    }
    
    // For teal-full, make logo white
    if (variation.bgType === 'teal-full') {
      const whiteLogo = await sharp(LOGO_SOURCE)
        .resize(logoSize, logoSize, {
          fit: 'contain',
          background: { r: 11, g: 114, b: 133, alpha: 0 }
        })
        .toBuffer();
      composites[0].input = whiteLogo;
    }
    
    await sharp(background)
      .composite(composites)
      .png()
      .toFile(outputPath);
    
    console.log(`  ✅ Created ${variation.name}`);
  } catch (error) {
    console.error(`  ❌ Error creating ${variation.name}:`, error.message);
    throw error;
  }
}

async function main() {
  // Check if logo exists
  if (!fs.existsSync(LOGO_SOURCE)) {
    console.error(`Error: Logo file not found at ${LOGO_SOURCE}`);
    process.exit(1);
  }
  
  // Create splash variations directory
  if (!fs.existsSync(SPLASH_DIR)) {
    fs.mkdirSync(SPLASH_DIR, { recursive: true });
  }
  
  console.log('Generating splash screen variations...');
  console.log(`Logo source: ${LOGO_SOURCE}`);
  console.log(`Output directory: ${SPLASH_DIR}`);
  console.log(`Sample size: ${SAMPLE_SIZE.width}x${SAMPLE_SIZE.height} (iPhone 12/13/14)`);
  console.log('');
  
  try {
    // Generate all variations
    for (const variation of VARIATIONS) {
      await generateVariation(variation, SAMPLE_SIZE);
    }
    
    console.log('');
    console.log('✅ All splash screen variations generated!');
    console.log(`Splash screens saved in: ${SPLASH_DIR}/`);
    console.log('');
    console.log('Variations created:');
    VARIATIONS.forEach(v => {
      console.log(`  - ${v.name}: ${v.description}`);
    });
    console.log('');
    console.log('Review the samples and let me know which design you prefer!');
  } catch (error) {
    console.error('Error generating splash screens:', error);
    process.exit(1);
  }
}

main();




