#!/usr/bin/env node

/**
 * Script to generate the final gradient-teal splash screen with:
 * - White logo and text
 * - Smaller spacing between logo and text
 * - Semi-transparent background icons (vehicle, money, etc.)
 */

const fs = require('fs');
const path = require('path');

let sharp;
try {
  sharp = require('sharp');
} catch (e) {
  console.error('Error: sharp package is not installed.');
  process.exit(1);
}

const LOGO_SOURCE = path.join(__dirname, 'public', 'assets', 'images', 'icon logo.png');
const SPLASH_DIR = path.join(__dirname, 'public', 'splash');
const PRIMARY_COLOR = '#0b7285';
const BG_SOFT = '#e5f3f7';

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

// Background icons to use (semi-transparent)
const BACKGROUND_ICONS = [
  { file: 'car.svg', size: 0.15, x: 0.1, y: 0.2, rotation: -15 },
  { file: 'money.svg', size: 0.12, x: 0.85, y: 0.25, rotation: 20 },
  { file: 'document.svg', size: 0.13, x: 0.15, y: 0.75, rotation: 10 },
  { file: 'road.svg', size: 0.14, x: 0.8, y: 0.7, rotation: -25 },
  { file: 'percent.svg', size: 0.11, x: 0.05, y: 0.5, rotation: 15 },
  { file: 'check.svg', size: 0.1, x: 0.9, y: 0.55, rotation: -10 },
];

async function createGradientBackground(width, height) {
  const svg = `
    <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="grad" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" style="stop-color:${PRIMARY_COLOR};stop-opacity:1" />
          <stop offset="100%" style="stop-color:${BG_SOFT};stop-opacity:1" />
        </linearGradient>
      </defs>
      <rect width="${width}" height="${height}" fill="url(#grad)" />
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

async function loadAndPrepareIcon(iconPath, size, rotation, opacity = 0.15) {
  try {
    // Read SVG file
    let svgContent = fs.readFileSync(iconPath, 'utf8');
    
    // Extract viewBox and content from original SVG
    const viewBoxMatch = svgContent.match(/viewBox="([^"]+)"/);
    const viewBox = viewBoxMatch ? viewBoxMatch[1] : '0 0 24 24';
    
    // Replace currentColor with white and add opacity
    svgContent = svgContent.replace(/stroke="currentColor"/g, `stroke="white"`);
    svgContent = svgContent.replace(/fill="currentColor"/g, `fill="white"`);
    
    // Remove SVG tags and get inner content
    const innerContent = svgContent
      .replace(/<svg[^>]*>/, '')
      .replace('</svg>', '')
      .trim();
    
    // Create SVG with rotation and opacity, convert to PNG
    const wrappedSvg = `
      <svg width="${size}" height="${size}" viewBox="${viewBox}" xmlns="http://www.w3.org/2000/svg">
        <g transform="rotate(${rotation} ${size/2} ${size/2})" opacity="${opacity}">
          ${innerContent}
        </g>
      </svg>
    `;
    
    // Convert SVG to PNG buffer
    const pngBuffer = await sharp(Buffer.from(wrappedSvg))
      .resize(size, size)
      .png()
      .toBuffer();
    
    return pngBuffer;
  } catch (error) {
    console.warn(`  Warning: Could not load icon ${iconPath}: ${error.message}`);
    return null;
  }
}

async function generateSplashScreen(size) {
  const outputPath = path.join(SPLASH_DIR, `splash-${size.name}.png`);
  const logoSize = Math.round(size.width * 0.25); // 25% of width
  const textSize = Math.round(size.width * 0.08); // 8% of width
  
  console.log(`Generating ${size.name} (${size.width}x${size.height})...`);
  
  try {
    // Create gradient background
    const background = await createGradientBackground(size.width, size.height);
    
    // Load and prepare background icons
    const iconComposites = [];
    for (const iconConfig of BACKGROUND_ICONS) {
      const iconPath = path.join(__dirname, 'public', 'assets', 'icons', iconConfig.file);
      if (fs.existsSync(iconPath)) {
        const iconSize = Math.round(size.width * iconConfig.size);
        const iconBuffer = await loadAndPrepareIcon(iconPath, iconSize, iconConfig.rotation, 0.12);
        if (iconBuffer) {
          iconComposites.push({
            input: iconBuffer,
            top: Math.round(size.height * iconConfig.y - (iconSize / 2)),
            left: Math.round(size.width * iconConfig.x - (iconSize / 2))
          });
        }
      }
    }
    
    // Load and resize logo, then make it white
    // First, resize the logo
    const logoResized = await sharp(LOGO_SOURCE)
      .resize(logoSize, logoSize, {
        fit: 'contain',
        background: { r: 255, g: 255, b: 255, alpha: 0 }
      })
      .png()
      .toBuffer();
    
    // Make logo white by using greyscale and then tinting white
    const whiteLogoFinal = await sharp(logoResized)
      .greyscale()
      .tint({ r: 255, g: 255, b: 255 })
      .png()
      .toBuffer();
    
    // Create white text and convert to PNG
    const textSvg = await createTextSVG('ClearTrack', textSize, '#ffffff', 400, 120);
    const textWidth = Math.round(size.width * 0.6);
    const textHeight = Math.round(textSize * 1.5);
    const textBuffer = await sharp(textSvg)
      .resize(textWidth, textHeight, {
        fit: 'contain',
        background: { r: 0, g: 0, b: 0, alpha: 0 }
      })
      .png()
      .toBuffer();
    
    // Calculate positions - smaller spacing between logo and text
    const logoY = Math.round((size.height * 0.42) - (logoSize / 2)); // Slightly higher
    const textYPos = Math.round(size.height * 0.52); // Closer to logo (was 0.55)
    const logoX = Math.round((size.width - logoSize) / 2);
    const textX = Math.round(size.width / 2);
    
    // Combine all composites: background icons first, then logo, then text
    const allComposites = [
      ...iconComposites,
      {
        input: whiteLogoFinal,
        top: logoY,
        left: logoX
      },
      {
        input: textBuffer,
        top: textYPos - Math.round(textSize * 0.6),
        left: Math.round(textX - (textWidth / 2))
      }
    ];
    
    await sharp(background)
      .composite(allComposites)
      .png()
      .toFile(outputPath);
    
    console.log(`  ✅ Created splash-${size.name}.png`);
  } catch (error) {
    console.error(`  ❌ Error creating ${size.name}:`, error.message);
    throw error;
  }
}

async function main() {
  if (!fs.existsSync(LOGO_SOURCE)) {
    console.error(`Error: Logo file not found at ${LOGO_SOURCE}`);
    process.exit(1);
  }
  
  if (!fs.existsSync(SPLASH_DIR)) {
    fs.mkdirSync(SPLASH_DIR, { recursive: true });
  }
  
  console.log('Generating final gradient-teal splash screens...');
  console.log(`Logo source: ${LOGO_SOURCE}`);
  console.log(`Output directory: ${SPLASH_DIR}`);
  console.log('Features: White logo & text, smaller spacing, semi-transparent background icons');
  console.log('');
  
  try {
    for (const size of SPLASH_SIZES) {
      await generateSplashScreen(size);
    }
    
    console.log('');
    console.log('✅ All splash screens generated successfully!');
    console.log(`Splash screens saved in: ${SPLASH_DIR}/`);
  } catch (error) {
    console.error('Error generating splash screens:', error);
    process.exit(1);
  }
}

main();

