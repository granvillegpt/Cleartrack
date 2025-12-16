#!/bin/bash

# Script to generate ClearTrack app icons with smaller logo
# The logo will be 70% of the icon size (instead of filling it)

cd "$(dirname "$0")/public"

LOGO_SOURCE="assets/images/icon logo.png"
ICONS_DIR="icons"

# Create icons directory if it doesn't exist
mkdir -p "$ICONS_DIR"

# Check if ImageMagick is installed
if ! command -v convert &> /dev/null; then
    echo "Error: ImageMagick is not installed."
    echo "Install it with: brew install imagemagick (on macOS)"
    echo "Or use an online tool like https://realfavicongenerator.net/"
    exit 1
fi

# Function to generate icon with smaller logo
# Parameters: size, output_filename
generate_icon() {
    local SIZE=$1
    local OUTPUT=$2
    # Calculate logo size (70% of icon size)
    local LOGO_SIZE=$(echo "$SIZE * 0.7" | bc | cut -d. -f1)
    
    echo "Generating $OUTPUT (${SIZE}x${SIZE}) with logo size ${LOGO_SIZE}x${LOGO_SIZE}..."
    
    # Create icon: white background, resize logo to 70%, center it
    convert "$LOGO_SOURCE" \
        -resize "${LOGO_SIZE}x${LOGO_SIZE}" \
        -gravity center \
        -background white \
        -extent "${SIZE}x${SIZE}" \
        "$ICONS_DIR/$OUTPUT"
}

# Generate all icon sizes
generate_icon 72 "cleartrack-72.png"
generate_icon 96 "cleartrack-96.png"
generate_icon 128 "cleartrack-128.png"
generate_icon 144 "cleartrack-144.png"
generate_icon 152 "cleartrack-152.png"
generate_icon 192 "cleartrack-192.png"
generate_icon 384 "cleartrack-384.png"
generate_icon 512 "cleartrack-512.png"

# Generate maskable icon (512x512 with logo at 60% for safe zone)
echo "Generating maskable icon (logo at 60% for safe zone)..."
LOGO_SIZE_MASKABLE=$(echo "512 * 0.6" | bc | cut -d. -f1)
convert "$LOGO_SOURCE" \
    -resize "${LOGO_SIZE_MASKABLE}x${LOGO_SIZE_MASKABLE}" \
    -gravity center \
    -background white \
    -extent "512x512" \
    "$ICONS_DIR/cleartrack-512-maskable.png"

echo ""
echo "✅ All icons generated successfully!"
echo "Icons saved in: $ICONS_DIR/"
echo ""
echo "Next steps:"
echo "1. Review the generated icons"
echo "2. If you want the logo even smaller, edit this script and change 0.7 to a smaller value (e.g., 0.6 for 60%)"
echo "3. Deploy to your server"
echo "4. Clear browser cache and re-add to home screen"




