# Icon Usage Rules

## CRITICAL RULE: ALWAYS Use Icons from Assets Folder

**MANDATORY: Use ONLY the actual SVG files from `public/assets/icons/`**

**NEVER:**
- Create new icon files
- Use icon definitions from icon-packs.html
- Use inline SVG code
- Guess or create icon content

**ALWAYS:**
1. **List `public/assets/icons/` folder first** - See what SVG files actually exist
2. **Use the EXACT filename** as it appears in the assets folder
3. **Reference icons using:** `<img src="assets/icons/[exact-filename].svg">`
4. **If an icon doesn't exist in assets**, ask the user - DO NOT create it

**The icon-packs.html file is ONLY for reference/showcase - NOT for icon definitions.**

## Icon File Locations

- **Primary location**: `public/assets/icons/*.svg`
- **Secondary location**: `public/assets/images/*.svg` or `*.png`
- **Reference file**: `public/icon-packs.html` (contains icon definitions)

## When Using Icons

1. **Always reference icons from `assets/icons/`** using the format:
   ```html
   <img src="assets/icons/[icon-name].svg" class="icon" alt="[description]">
   ```

2. **If an icon doesn't exist in assets**, check:
   - `icon-packs.html` for icon definitions
   - Ask the user for the icon location
   - DO NOT create new icons without explicit permission

3. **Icon naming convention**:
   - Use lowercase with hyphens: `folder-1439.svg`
   - Match exact filename as it appears in assets folder

## Verification Checklist

Before using any icon:
- [ ] Checked `public/assets/icons/` folder
- [ ] Checked `public/assets/images/` folder  
- [ ] Searched entire `public/assets/` directory
- [ ] Verified exact filename matches
- [ ] Confirmed icon exists before referencing it

## Current Available Icons (as of last check)

From `public/assets/icons/`:
- camera.svg, car.svg, check.svg, clock.svg, document.svg, download.svg
- edit.svg, email.svg, eye.svg, folder.svg, gallery.svg, info.svg
- message.svg, money.svg, percent.svg, phone.svg, refresh.svg
- road.svg, search.svg, star.svg, trash.svg, user.svg, video.svg

