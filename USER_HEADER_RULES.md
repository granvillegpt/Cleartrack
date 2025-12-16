# User Dashboard Header Rules

## Overview
This document defines the structure, styling, and behavior of the user dashboard header for both desktop and mobile views. The mobile implementation uses Style 6 from `hamburger-menu-styles.html`. This header matches the practitioner dashboard header exactly.

## HTML Structure

```html
<header class="header">
    <div class="header-top">
        <div class="logo">
            <img src="assets/images/full%20logo%20CT.png" alt="ClearTrack Logo">
        </div>
        <button class="menu-toggle-style6" id="menuToggle" onclick="toggleMenu('style6')" aria-label="Toggle navigation menu">☰</button>
        <button class="btn btn-outline" onclick="window.location.href='/login.html'" style="background: rgba(255,255,255,0.2); color: #ffffff; border-color: rgba(255,255,255,0.3);" id="desktopLogoutBtn">Logout</button>
    </div>
    <nav class="nav-style6" id="nav-style6">
        <a href="#" class="nav-link active" onclick="handleNavClick('dashboard', event)">Dashboard</a>
        <a href="#" class="nav-link" onclick="handleNavClick('documents', event)">Documents</a>
        <a href="#" class="nav-link" onclick="handleNavClick('vehicles', event)">Vehicles</a>
        <a href="#" class="nav-link" onclick="handleNavClick('expenses', event)">Expenses</a>
        <a href="#" class="nav-link" onclick="handleNavClick('messages', event)">Messages</a>
        <a href="#" class="nav-link" onclick="handleNavClick('connect', event)">Connect</a>
        <a href="#" class="nav-link" onclick="handleNavClick('profile', event)">Profile</a>
    </nav>
</header>
```

## Navigation Links

The user dashboard has 7 navigation links:
1. Dashboard
2. Documents
3. Vehicles
4. Expenses
5. Messages
6. Connect
7. Profile

## Desktop Styles (≥769px)

### Header Container
```css
.header {
    background: #0b7285;
    color: #fff;
    box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    position: sticky;
    top: 0;
    z-index: 100;
    width: 100%;
    box-sizing: border-box;
    display: block;
}
```

### Header Top Section
```css
.header-top {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 1.5rem 2.5rem;
    position: relative;
    width: 100%;
    box-sizing: border-box;
}
```

### Logo (Desktop)
```css
.header .logo {
    display: flex;
    align-items: center;
    position: absolute;
    left: 50%;
    transform: translateX(-50%);
}

.header .logo img {
    height: 48px;
    width: auto;
    filter: brightness(0) invert(1);
    display: block;
}
```
- **Position**: Centered absolutely
- **Logo Height**: 48px
- **Filter**: White logo (brightness(0) invert(1))

### Logout Button (Desktop)
```css
#desktopLogoutBtn {
    display: block;
    margin-left: auto;
}
```
- **Position**: Right side of header
- **Style**: Semi-transparent white background

### Navigation Bar (Desktop)
```css
.nav-style6 {
    display: flex;
    gap: 2rem;
    align-items: center;
    justify-content: center;
    padding: 1rem 2rem;
    background: rgba(255, 255, 255, 0.2);
    border-top: 1px solid rgba(255, 255, 255, 0.3);
    width: 100%;
    box-sizing: border-box;
    position: static;
}

.nav-style6 a {
    color: #e0fbff;
    text-decoration: none;
    font-weight: 500;
    cursor: pointer;
    transition: color 0.2s;
    position: relative;
    padding: 0.5rem 0;
    display: inline-block;
}

.nav-style6 a::after {
    content: '';
    position: absolute;
    bottom: -0.5rem;
    left: 0;
    width: 0;
    height: 2px;
    background: #ffffff;
    transition: width 0.3s ease;
}

.nav-style6 a:hover::after,
.nav-style6 a.active::after {
    width: 100%;
}

.nav-style6 a:hover,
.nav-style6 a.active {
    color: #ffffff;
}
```
- **Layout**: Horizontal navigation bar
- **Background**: Semi-transparent white overlay
- **Links**: Underline animation on hover/active

### Mobile Menu Toggle (Desktop)
```css
.menu-toggle-style6 {
    display: none;
}
```
- **Visibility**: Hidden on desktop

## Mobile Styles (≤768px) - Style 6 Implementation

### Header Container
```css
.header {
    background: #0b7285;
    color: #fff;
    padding: 1rem 1.5rem;
    display: flex;
    align-items: center;
    justify-content: space-between;
    position: relative;
}
```
- **Padding**: 1rem 1.5rem (reduced from desktop)
- **Layout**: Flex container

### Header Top Section
```css
.header-top {
    padding: 0 !important;
    display: flex !important;
    align-items: center;
    justify-content: space-between !important;
    width: 100%;
    position: static !important;
}
```
- **Padding**: 0 (transparent pass-through)
- **Layout**: Flex with space-between for logo (left) and hamburger (right)

### Logo (Mobile)
```css
.header .logo {
    font-weight: 700;
    font-size: 1.2rem;
    position: static !important;
    left: auto !important;
    right: auto !important;
    transform: none !important;
    display: flex !important;
    align-items: center;
}

.header .logo img {
    height: 44px !important;
    width: auto !important;
    max-width: none !important;
    object-fit: contain !important;
}
```
- **Position**: Static (left side, participates in flexbox)
- **Logo Height**: 44px
- **Aspect Ratio**: Maintained with object-fit: contain

### Logout Button (Mobile)
```css
#desktopLogoutBtn {
    display: none !important;
}
```
- **Visibility**: Hidden on mobile

### Mobile Menu Toggle (Hamburger)
```css
.menu-toggle-style6 {
    background: transparent;
    border: none;
    color: #e0fbff;
    cursor: pointer;
    font-size: 1.6rem;
    display: flex !important;
    align-items: center;
    justify-content: center;
    width: 44px;
    height: 44px;
    transition: transform 0.3s ease;
}

.menu-toggle-style6:hover {
    transform: scale(1.1);
}

.menu-toggle-style6.active {
    transform: rotate(90deg);
}
```
- **Size**: 44px × 44px
- **Font Size**: 1.6rem
- **Position**: Right side
- **Animation**: Rotates 90deg when active

### Navigation Dropdown (Mobile - Style 6)
```css
.nav-style6 {
    /* Reset desktop styles */
    display: block;
    gap: 0;
    align-items: stretch;
    justify-content: flex-start;
    padding: 0;
    background: white;
    border-top: none;
    width: auto;
    box-sizing: border-box;
    
    /* Style 6 dropdown styles */
    position: absolute;
    top: calc(100% + 0.5rem);
    right: 1.5rem;
    border-radius: 12px;
    box-shadow: 0 8px 24px rgba(0,0,0,0.2);
    min-width: 220px;
    max-height: 0;
    overflow: hidden;
    transition: max-height 0.3s ease, opacity 0.3s ease;
    opacity: 0;
    z-index: 1000;
}

.nav-style6.active {
    max-height: 500px;
    opacity: 1;
    display: flex;
    flex-direction: column;
}

.nav-style6 a {
    color: #1f2933;
    text-decoration: none;
    padding: 0.75rem 1.25rem;
    display: block;
    font-size: 0.95rem;
    transition: all 0.2s;
    font-weight: normal;
    position: static;
    width: auto;
}

.nav-style6 a::after {
    display: none;
}

.nav-style6 a:hover {
    background: #f5f7fa;
    color: #0b7285;
    padding-left: 1.5rem;
}

.nav-style6 a.active {
    background: #e0f7fb;
    color: #0b7285;
    font-weight: 600;
}

.nav-style6 a:first-child {
    border-radius: 12px 12px 0 0;
}

.nav-style6 a:last-child {
    border-radius: 0 0 12px 12px;
}
```
- **Position**: Absolute, right side, below header
- **Size**: 220px width (compact dropdown)
- **Max Height**: 500px (accommodates all 7 navigation links)
- **Background**: White
- **Animation**: Max-height and opacity transition
- **Links**: Dark text, light background on hover/active

## Small Mobile Styles (≤480px)

```css
.nav-style6.active {
    right: 0.75rem !important;
    min-width: 200px !important;
}

.nav-style6 a {
    font-size: 0.9rem;
    padding: 0.625rem 1rem;
}
```
- **Dropdown Position**: Adjusted for smaller screens
- **Width**: 200px minimum
- **Text Size**: Slightly smaller

## JavaScript Functions

### Toggle Menu
```javascript
window.toggleMenu = function(style) {
    const nav = document.getElementById(`nav-${style}`);
    const toggle = document.querySelector(`.menu-toggle-${style}`);
    
    if (nav) {
        nav.classList.toggle('active');
    }
    if (toggle) {
        toggle.classList.toggle('active');
    }
};
```

### Handle Navigation Click
```javascript
window.handleNavClick = function(sectionName, event) {
    if (event) {
        event.preventDefault();
    }
    
    // ALWAYS close mobile menu first
    const nav = document.getElementById("nav-style6");
    const toggle = document.querySelector(".menu-toggle-style6");
    if (nav && nav.classList.contains("active")) {
        nav.classList.remove("active");
        if (toggle) toggle.classList.remove("active");
    }
    
    // Show section and update active states
    showSection(sectionName);
    // ... active state management
}
```

### Click Outside Handler
```javascript
document.addEventListener('click', function(event) {
    const nav = document.getElementById('nav-style6');
    const toggle = document.querySelector('.menu-toggle-style6');
    const header = toggle?.closest('.header');
    
    if (nav && nav.classList.contains('active')) {
        if (header && !header.contains(event.target)) {
            nav.classList.remove('active');
            if (toggle) toggle.classList.remove('active');
        }
    }
});
```

### Escape Key Handler
```javascript
document.addEventListener('keydown', function(event) {
    if (event.key === 'Escape') {
        const nav = document.getElementById('nav-style6');
        const toggle = document.querySelector('.menu-toggle-style6');
        if (nav && nav.classList.contains('active')) {
            nav.classList.remove('active');
            if (toggle) toggle.classList.remove('active');
        }
    }
});
```

## Key Rules

1. **Desktop Header**:
   - Logo centered absolutely
   - Horizontal navigation bar below header
   - Logout button on right
   - Hamburger menu hidden

2. **Mobile Header (Style 6)**:
   - Logo on LEFT (static position, participates in flexbox)
   - Hamburger menu on RIGHT
   - Compact dropdown menu (220px) on right side
   - Max height: 500px (accommodates all 7 navigation links)
   - No horizontal nav bar visible
   - Logo size: 44px height (maintains aspect ratio)
   - Hamburger size: 44px × 44px, 1.6rem font

3. **Navigation Behavior**:
   - Desktop: Always visible horizontal bar
   - Mobile: Hidden by default, shows on hamburger click
   - Menu closes automatically when link is clicked
   - Menu closes when clicking outside
   - Menu closes when pressing Escape key

4. **CSS Specificity**:
   - Mobile styles use `!important` where needed to override desktop
   - Logo positioning must be `static` on mobile to participate in flexbox
   - All desktop nav styles must be reset in mobile media query

5. **No Code Duplication**:
   - Single `.nav-style6` element serves both desktop and mobile
   - Desktop styles in base CSS
   - Mobile styles completely override in media query
   - Clean separation without duplication

6. **All Navigation Links Visible**:
   - Dropdown max-height set to 500px to accommodate all 7 links
   - `display: flex` and `flex-direction: column` ensure proper stacking
   - No overflow issues

## Maintenance Notes

- **DO NOT** change the HTML structure without updating this document
- **DO NOT** modify mobile styles without ensuring desktop compatibility
- **DO NOT** add conflicting CSS that breaks the flexbox layout
- **ALWAYS** test both desktop and mobile views after changes
- **ALWAYS** maintain Style 6 exact implementation for mobile
- **ENSURE** all 7 navigation links are visible in the dropdown

## Reference Files

- Style 6 Reference: `hamburger-menu-styles.html` (lines 533-614)
- Implementation: `public/user-dashboard.html`
- Related Rules: `USER_DASHBOARD_RULES.md`, `PRACTITIONER_HEADER_RULES.md`

