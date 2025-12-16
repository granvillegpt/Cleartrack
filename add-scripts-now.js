#!/usr/bin/env node
// Run this script to add the fix scripts to practitioner-dashboard.html
// Usage: node add-scripts-now.js

const fs = require('fs');
const path = require('path');

const htmlFile = path.join(__dirname, 'public', 'practitioner-dashboard.html');

console.log('Adding fix scripts to practitioner-dashboard.html...\n');

try {
    // Read file
    const content = fs.readFileSync(htmlFile, 'utf8');
    
    // Check if already added
    if (content.includes('practitioner-code-fix.js')) {
        console.log('✓ Scripts already added!');
        process.exit(0);
    }
    
    // Pattern 1: Insert before color-scheme comment
    const pattern1 = /(<!-- Color scheme - force light mode for Android)/;
    if (pattern1.test(content)) {
        const newScripts = '    <!-- Prevent automatic reloads and fix practitioner code loading -->\n    <script src="/prevent-auto-reload.js"></script>\n    <script src="/practitioner-code-fix.js"></script>\n    \n';
        const newContent = content.replace(pattern1, newScripts + '$1');
        fs.writeFileSync(htmlFile, newContent, 'utf8');
        console.log('✓ Successfully added scripts before color-scheme comment!');
        process.exit(0);
    }
    
    // Pattern 2: Insert after PWA script closes
    const pattern2 = /(\s*<\/script>\s*)(\n\s*<!--|<\/head>)/;
    if (pattern2.test(content)) {
        const newScripts = '\n    <!-- Prevent automatic reloads and fix practitioner code loading -->\n    <script src="/prevent-auto-reload.js"></script>\n    <script src="/practitioner-code-fix.js"></script>';
        const newContent = content.replace(pattern2, '$1' + newScripts + '$2');
        fs.writeFileSync(htmlFile, newContent, 'utf8');
        console.log('✓ Successfully added scripts after PWA script!');
        process.exit(0);
    }
    
    // Pattern 3: Insert before </head>
    const pattern3 = /(\s*)(<\/head>)/;
    if (pattern3.test(content)) {
        const newScripts = '    <!-- Prevent automatic reloads and fix practitioner code loading -->\n    <script src="/prevent-auto-reload.js"></script>\n    <script src="/practitioner-code-fix.js"></script>\n';
        const newContent = content.replace(pattern3, newScripts + '$1$2');
        fs.writeFileSync(htmlFile, newContent, 'utf8');
        console.log('✓ Successfully added scripts before </head>!');
        process.exit(0);
    }
    
    console.error('✗ Could not find insertion point');
    console.error('Please manually add these lines to the <head> section:');
    console.error('\n    <!-- Prevent automatic reloads and fix practitioner code loading -->');
    console.error('    <script src="/prevent-auto-reload.js"></script>');
    console.error('    <script src="/practitioner-code-fix.js"></script>\n');
    process.exit(1);
    
} catch (error) {
    console.error('✗ Error:', error.message);
    if (error.code === 'EACCES' || error.code === 'EPERM') {
        console.error('\nPermission denied. Please:');
        console.error('1. Close the file if it\'s open in an editor');
        console.error('2. Check file permissions');
        console.error('3. Or manually add the scripts as shown above');
    }
    process.exit(1);
}



