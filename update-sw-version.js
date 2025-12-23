#!/usr/bin/env node
/**
 * Auto-version update script for service worker
 * Updates the cache version in sw.js automatically
 * Run this before deploying to ensure fresh cache
 */

const fs = require('fs');
const path = require('path');

const swPath = path.join(__dirname, 'public', 'sw.js');

// Generate version based on current date/time
const now = new Date();
const year = now.getFullYear();
const month = String(now.getMonth() + 1).padStart(2, '0');
const day = String(now.getDate()).padStart(2, '0');
const hour = String(now.getHours()).padStart(2, '0');
const minute = String(now.getMinutes()).padStart(2, '0');
const version = `${year}${month}${day}-${hour}${minute}`;

try {
  // Read current sw.js
  let swContent = fs.readFileSync(swPath, 'utf8');
  
  // Replace the CACHE_VERSION line
  const versionRegex = /const CACHE_VERSION = ['"]([^'"]+)['"];?/;
  const newVersionLine = `const CACHE_VERSION = '${version}';`;
  
  if (versionRegex.test(swContent)) {
    swContent = swContent.replace(versionRegex, newVersionLine);
    fs.writeFileSync(swPath, swContent, 'utf8');
    console.log(`✅ Service worker version updated to: ${version}`);
  } else {
    // If pattern not found, try to add it after the comment
    const commentMatch = swContent.match(/\/\/ Auto-versioning:.*?\n/);
    if (commentMatch) {
      const insertPos = commentMatch.index + commentMatch[0].length;
      const before = swContent.slice(0, insertPos);
      const after = swContent.slice(insertPos);
      swContent = before + newVersionLine + '\n' + after;
      fs.writeFileSync(swPath, swContent, 'utf8');
      console.log(`✅ Service worker version added: ${version}`);
    } else {
      console.error('❌ Could not find version pattern in sw.js');
      process.exit(1);
    }
  }
} catch (error) {
  console.error('❌ Error updating service worker version:', error.message);
  process.exit(1);
}

