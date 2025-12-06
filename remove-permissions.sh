#!/bin/bash
# Script to remove special permissions from practitioner-dashboard.html

cd "/Users/user1/Desktop/Cleartrack App 2/public"

echo "Removing extended attributes from practitioner-dashboard.html..."

# Remove all extended attributes
xattr -c practitioner-dashboard.html 2>/dev/null || echo "Could not clear all attributes"

# Remove specific common attributes
xattr -d com.apple.quarantine practitioner-dashboard.html 2>/dev/null
xattr -d com.apple.metadata:kMDItemWhereFroms practitioner-dashboard.html 2>/dev/null
xattr -d com.apple.FinderInfo practitioner-dashboard.html 2>/dev/null

# Reset file permissions
chmod 644 practitioner-dashboard.html

# Check if attributes are gone
if ls -la@ practitioner-dashboard.html | grep -q "@"; then
    echo "⚠️  File still has extended attributes. You may need to:"
    echo "   1. Close the file if it's open in an editor"
    echo "   2. Check macOS System Settings > Privacy & Security > Full Disk Access"
    echo "   3. Or manually remove attributes using: xattr -c practitioner-dashboard.html"
else
    echo "✓ Extended attributes removed successfully!"
    echo "✓ File permissions reset to 644"
fi



