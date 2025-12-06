#!/usr/bin/env node

/**
 * Script to generate advanced splash screen variations with loading indicators
 * and more creative designs
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
const SPLASH_DIR = path.join(__dirname, 'public', 'splash', 'variations');
const PRIMARY_COLOR = '#0b7285';
const PRIMARY_DARK = '#095a69';
const BG_SOFT = '#e5f3f7';

const SAMPLE_SIZE = { width: 1170, height: 2532 };

// Advanced variations with loading indicators
const ADVANCED_VARIATIONS = [
  {
    name: 'loading-dots',
    description: 'Gradient background with animated-style loading dots',
    bgType: 'gradient',
    hasLoading: true,
    loadingType: 'dots'
  },
  {
    name: 'loading-bar',
    description: 'Teal background with progress bar at bottom',
    bgType: 'teal-full',
    hasLoading: true,
    loadingType: 'bar'
  },
  {
    name: 'geometric-shapes',
    description: 'White background with geometric teal shapes',
    bgType: 'geometric',
    hasLoading: false
  },
  {
    name: 'wave-design',
    description: 'Wave pattern with teal gradient',
    bgType: 'wave',
    hasLoading: false
  },
  {
    name: 'modern-minimal',
    description: 'Modern minimal with subtle shadow and loading spinner',
    bgType: 'white',
    hasLoading: true,
    loadingType: 'spinner'
  }
];

async function createLoadingDotsSVG(size, color) {
  const dotSize = size * 0.02;
  const spacing = dotSize * 2;
  const svg = `
    <svg width="${size * 0.3}" height="${dotSize * 2}" xmlns="http://www.w3.org/2000/svg">
      <circle cx="${dotSize}" cy="${dotSize}" r="${dotSize * 0.4}" fill="${color}" opacity="0.6"/>
      <circle cx="${dotSize + spacing}" cy="${dotSize}" r="${dotSize * 0.4}" fill="${color}" opacity="0.8"/>
      <circle cx="${dotSize + spacing * 2}" cy="${dotSize}" r="${dotSize * 0.4}" fill="${color}" opacity="1"/>
    </svg>
  `;
  return Buffer.from(svg);
}

async function createLoadingBarSVG(width, height, color) {
  const barHeight = height * 0.01;
  const barWidth = width * 0.6;
  const svg = `
    <svg width="${width}" height="${height * 0.15}" xmlns="http://www.w3.org/2000/svg">
      <rect x="${(width - barWidth) / 2}" y="${(height * 0.15 - barHeight) / 2}" 
            width="${barWidth}" height="${barHeight}" rx="${barHeight / 2}" 
            fill="${color}" opacity="0.3"/>
      <rect x="${(width - barWidth) / 2}" y="${(height * 0.15 - barHeight) / 2}" 
            width="${barWidth * 0.7}" height="${barHeight}" rx="${barHeight / 2}" 
            fill="${color}"/>
    </svg>
  `;
  return Buffer.from(svg);
}

async function createLoadingSpinnerSVG(size, color) {
  const radius = size * 0.03;
  const svg = `
    <svg width="${size * 0.15}" height="${size * 0.15}" xmlns="http://www.w3.org/2000/svg">
      <circle cx="${size * 0.075}" cy="${size * 0.075}" r="${radius}" 
              fill="none" stroke="${color}" stroke-width="${radius * 0.2}" 
              stroke-dasharray="${radius * 2}" stroke-dashoffset="${radius}" 
              opacity="0.6">
        <animate attributeName="stroke-dashoffset" 
                 values="${radius};${-radius * 3};${radius}" 
                 dur="1.5s" repeatCount="indefinite"/>
      </circle>
    </svg>
  `;
  return Buffer.from(svg);
}

async function createGeometricShapesSVG(width, height) {
  const svg = `
    <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="shapeGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" style="stop-color:${PRIMARY_COLOR};stop-opacity:0.1" />
          <stop offset="100%" style="stop-color:${PRIMARY_COLOR};stop-opacity:0.05" />
        </linearGradient>
      </defs>
      <rect width="${width}" height="${height}" fill="#ffffff"/>
      <polygon points="${width * 0.1},${height * 0.1} ${width * 0.3},${height * 0.1} ${width * 0.2},${height * 0.25}" 
               fill="url(#shapeGrad)"/>
      <circle cx="${width * 0.85}" cy="${height * 0.15}" r="${width * 0.08}" 
              fill="url(#shapeGrad)"/>
      <rect x="${width * 0.7}" y="${height * 0.8}" width="${width * 0.15}" height="${width * 0.15}" 
            rx="${width * 0.02}" fill="url(#shapeGrad)"/>
    </svg>
  `;
  return Buffer.from(svg);
}

async function createWaveDesignSVG(width, height) {
  const svg = `
    <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="waveGrad" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" style="stop-color:${PRIMARY_COLOR};stop-opacity:1" />
          <stop offset="50%" style="stop-color:${BG_SOFT};stop-opacity:1" />
          <stop offset="100%" style="stop-color:#ffffff;stop-opacity:1" />
        </linearGradient>
      </defs>
      <rect width="${width}" height="${height}" fill="url(#waveGrad)"/>
      <path d="M 0,${height * 0.3} Q ${width * 0.25},${height * 0.25} ${width * 0.5},${height * 0.3} T ${width},${height * 0.3} L ${width},0 L 0,0 Z" 
            fill="${PRIMARY_COLOR}" opacity="0.1"/>
      <path d="M 0,${height * 0.6} Q ${width * 0.25},${height * 0.55} ${width * 0.5},${height * 0.6} T ${width},${height * 0.6} L ${width},${height * 0.3} L 0,${height * 0.3} Z" 
            fill="${PRIMARY_COLOR}" opacity="0.05"/>
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

async function generateAdvancedVariation(variation, size) {
  const outputPath = path.join(SPLASH_DIR, `splash-${variation.name}-${size.width}x${size.height}.png`);
  const logoSize = Math.round(size.width * 0.25);
  const textSize = Math.round(size.width * 0.08);
  
  console.log(`Generating ${variation.name}...`);
  
  try {
    let background;
    
    switch (variation.bgType) {
      case 'gradient':
        const gradSvg = `
          <svg width="${size.width}" height="${size.height}" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <linearGradient id="grad" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" style="stop-color:${PRIMARY_COLOR};stop-opacity:1" />
                <stop offset="100%" style="stop-color:${BG_SOFT};stop-opacity:1" />
              </linearGradient>
            </defs>
            <rect width="${size.width}" height="${size.height}" fill="url(#grad)" />
          </svg>
        `;
        background = Buffer.from(gradSvg);
        break;
      case 'teal-full':
        background = await sharp({
          create: {
            width: size.width,
            height: size.height,
            channels: 4,
            background: { r: 11, g: 114, b: 133, alpha: 1 }
          }
        }).png().toBuffer();
        break;
      case 'geometric':
        background = await createGeometricShapesSVG(size.width, size.height);
        break;
      case 'wave':
        background = await createWaveDesignSVG(size.width, size.height);
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
    
    // Load logo
    const logo = sharp(LOGO_SOURCE)
      .resize(logoSize, logoSize, {
        fit: 'contain',
        background: { r: 255, g: 255, b: 255, alpha: 0 }
      });
    
    // Determine text color
    const textColor = (variation.bgType === 'teal-full' || variation.bgType === 'gradient') ? '#ffffff' : PRIMARY_COLOR;
    const text = await createTextSVG('ClearTrack', textSize, textColor, 400, 120);
    
    // Calculate positions
    const logoY = Math.round((size.height * 0.4) - (logoSize / 2));
    const textYPos = Math.round(size.height * 0.55);
    const logoX = Math.round((size.width - logoSize) / 2);
    const textX = Math.round(size.width / 2);
    
    const composites = [
      {
        input: await logo.toBuffer(),
        top: logoY,
        left: logoX
      },
      {
        input: text,
        top: textYPos - 100,
        left: Math.round(textX - 400)
      }
    ];
    
    // Add loading indicator
    if (variation.hasLoading) {
      const loadingY = Math.round(size.height * 0.7);
      const loadingX = Math.round(size.width / 2);
      
      if (variation.loadingType === 'dots') {
        const dots = await createLoadingDotsSVG(size.width, textColor);
        composites.push({
          input: dots,
          top: loadingY,
          left: Math.round(loadingX - (size.width * 0.15))
        });
      } else if (variation.loadingType === 'bar') {
        const bar = await createLoadingBarSVG(size.width, size.height, '#ffffff');
        composites.push({
          input: bar,
          top: Math.round(size.height * 0.85),
          left: 0
        });
      } else if (variation.loadingType === 'spinner') {
        const spinner = await createLoadingSpinnerSVG(size.width, PRIMARY_COLOR);
        composites.push({
          input: spinner,
          top: loadingY,
          left: Math.round(loadingX - (size.width * 0.075))
        });
      }
    }
    
    // For teal backgrounds, make logo white
    if (variation.bgType === 'teal-full' || variation.bgType === 'gradient') {
      // Keep logo as is for now, or invert if needed
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
  if (!fs.existsSync(LOGO_SOURCE)) {
    console.error(`Error: Logo file not found at ${LOGO_SOURCE}`);
    process.exit(1);
  }
  
  if (!fs.existsSync(SPLASH_DIR)) {
    fs.mkdirSync(SPLASH_DIR, { recursive: true });
  }
  
  console.log('Generating advanced splash screen variations...');
  console.log(`Sample size: ${SAMPLE_SIZE.width}x${SAMPLE_SIZE.height} (iPhone 12/13/14)`);
  console.log('');
  
  try {
    for (const variation of ADVANCED_VARIATIONS) {
      await generateAdvancedVariation(variation, SAMPLE_SIZE);
    }
    
    console.log('');
    console.log('✅ All advanced splash screen variations generated!');
    console.log(`Splash screens saved in: ${SPLASH_DIR}/`);
    console.log('');
    console.log('Advanced variations created:');
    ADVANCED_VARIATIONS.forEach(v => {
      console.log(`  - ${v.name}: ${v.description}`);
    });
  } catch (error) {
    console.error('Error generating splash screens:', error);
    process.exit(1);
  }
}

main();

