# Local HTML Editing Guide

## How to Edit Your App Directly

### Step 1: Open HTML Files
1. Open Finder
2. Go to: `/Users/granville/Desktop/Cleartrack App 2/public/`
3. Double-click any HTML file:
   - `practitioner-dashboard.html`
   - `user-dashboard.html`
   - `login.html`
   - `index.html`

### Step 2: Edit Files
- Open the HTML file in your code editor (VS Code, Cursor, etc.)
- Make changes to HTML, CSS, or JavaScript
- Save the file

### Step 3: See Changes
- Go back to your browser
- Press **F5** or **Cmd+R** to refresh
- See your changes instantly!

## Your Workflow

```
1. Double-click HTML file → Opens in browser
2. Edit file in code editor → Save
3. Refresh browser → See changes
4. Repeat!
```

## Notes

- **CSS/JS files**: Edit them the same way - save and refresh
- **Images**: Already work with relative paths
- **Firebase**: May have limited functionality when opening files directly (but UI editing works fine)
- **Links**: Some absolute paths (`/login.html`) might not work - use relative paths (`./login.html` or `login.html`)

## Quick Access

You can also:
- Drag HTML files to your browser
- Right-click → Open With → Browser
- Set your default browser to open HTML files

## Tips

- Keep your code editor and browser open side-by-side
- Use browser DevTools (F12) to inspect elements
- Changes are instant - just refresh!




