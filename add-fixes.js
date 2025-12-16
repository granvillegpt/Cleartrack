#!/usr/bin/env node
// Script to add the fix scripts to practitioner-dashboard.html
// Run this with: node add-fixes.js

const fs = require('fs');
const path = require('path');

const htmlFile = path.join(__dirname, 'public', 'practitioner-dashboard.html');

console.log('Adding fix scripts to practitioner-dashboard.html...');

try {
    // Read the file
    let content = fs.readFileSync(htmlFile, 'utf8');
    
    // Check if already added
    if (content.includes('practitioner-code-fix.js')) {
        console.log('✓ Scripts already added!');
        process.exit(0);
    }
    
    // Find the insertion point - after the PWA Features script closes
    // Look for the pattern: </script> followed by something that indicates we're past PWA Features
    const pwaEndPattern = /(\s*<\/script>\s*)(\n\s*<!-- Color scheme|<\/head>|<script|<\/html>)/;
    const match = content.match(pwaEndPattern);
    
    if (match) {
        const insertPos = match.index + match[1].length;
        const newScripts = '\n    <!-- Prevent automatic reloads and fix practitioner code loading -->\n    <script src="/prevent-auto-reload.js"></script>\n    <script src="/practitioner-code-fix.js"></script>\n';
        
        content = content.substring(0, insertPos) + newScripts + content.substring(insertPos);
        
        // Write back
        fs.writeFileSync(htmlFile, content, 'utf8');
        console.log('✓ Successfully added fix scripts!');
        console.log('  - prevent-auto-reload.js');
        console.log('  - practitioner-code-fix.js');
    } else {
        // Try alternative: find any </script> in the head section
        const headEnd = content.indexOf('</head>');
        if (headEnd > 0) {
            const headContent = content.substring(0, headEnd);
            const lastScript = headContent.lastIndexOf('</script>');
            
            if (lastScript > 0) {
                const insertPos = lastScript + 9; // After </script>
                const newScripts = '\n    <!-- Prevent automatic reloads and fix practitioner code loading -->\n    <script src="/prevent-auto-reload.js"></script>\n    <script src="/practitioner-code-fix.js"></script>\n';
                
                content = content.substring(0, insertPos) + newScripts + content.substring(insertPos);
                fs.writeFileSync(htmlFile, content, 'utf8');
                console.log('✓ Successfully added fix scripts (alternative method)!');
            } else {
                console.error('✗ Could not find insertion point');
                process.exit(1);
            }
        } else {
            console.error('✗ Could not find </head> tag');
            process.exit(1);
        }
    }
} catch (error) {
    console.error('✗ Error:', error.message);
    console.error('\nPlease run this script with proper permissions, or manually add these lines to practitioner-dashboard.html:');
    console.log('\n<!-- Prevent automatic reloads and fix practitioner code loading -->');
    console.log('<script src="/prevent-auto-reload.js"></script>');
    console.log('<script src="/practitioner-code-fix.js"></script>');
    console.log('\nAdd them in the <head> section, right after the PWA Features script.');
    process.exit(1);
}



