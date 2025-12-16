# Clean Style 6 Mobile Menu Implementation

## CSS Implementation

```css
/* ============================================
   STYLE 6: Compact Dropdown Menu
   ============================================ */
.menu-toggle-style6 {
    display: none;
    background: transparent;
    border: none;
    color: #e0fbff;
    cursor: pointer;
    font-size: 1.3rem;
    align-items: center;
    justify-content: center;
    width: 36px;
    height: 36px;
    min-width: 36px;
    min-height: 36px;
    transition: transform 0.3s ease;
    padding: 0;
}

.menu-toggle-style6:hover {
    transform: scale(1.1);
}

.menu-toggle-style6.active {
    transform: rotate(90deg);
}

/* Desktop Navigation */
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
}

.header-top {
    padding: 1.5rem 2.5rem;
}

/* Desktop: Hide toggle, show navigation */
@media (min-width: 769px) {
    .menu-toggle-style6 {
        display: none;
    }
    
    .nav-style6 {
        display: flex;
        position: static;
        background: rgba(255, 255, 255, 0.2);
        border-radius: 0;
        box-shadow: none;
        flex-direction: row;
    }
    
    .nav-style6 a {
        color: #e0fbff;
        padding: 0.5rem 0;
        width: auto;
        display: inline-block;
    }
}

/* Mobile: Show toggle, hide navigation */
@media (max-width: 768px) {
    .header {
        position: relative;
    }
    
    .header-top {
        padding: 0.875rem 1rem;
        position: relative;
    }
    
    .menu-toggle-style6 {
        display: flex;
        flex-shrink: 0;
        order: 1;
        z-index: 2;
    }
    
    .nav {
        display: none;
    }
    
    .nav-style6 {
        display: none;
        position: absolute;
        top: calc(100% + 0.5rem);
        right: 1rem;
        background: white;
        border-radius: 12px;
        box-shadow: 0 8px 24px rgba(0,0,0,0.2);
        min-width: 220px;
        max-height: 0;
        overflow: hidden;
        transition: max-height 0.3s ease, opacity 0.3s ease;
        opacity: 0;
        z-index: 1000;
        flex-direction: column;
        align-items: stretch;
        gap: 0;
        padding: 0;
    }
    
    .nav-style6.active {
        display: flex;
        max-height: 400px;
        opacity: 1;
    }
    
    .nav-style6 a {
        width: 100%;
        color: #1f2933;
        padding: 0.75rem 1.25rem;
        font-size: 0.95rem;
        display: block;
        transition: all 0.2s;
        text-decoration: none;
    }
    
    .nav-style6 a:hover {
        background: #f5f7fa;
        color: #0b7285;
        padding-left: 1.5rem;
    }
    
    .nav-style6 a:first-child {
        border-radius: 12px 12px 0 0;
    }
    
    .nav-style6 a:last-child {
        border-radius: 0 0 12px 12px;
    }
    
    .header .logo {
        position: absolute;
        left: 50%;
        top: 50%;
        transform: translate(-50%, -50%);
        z-index: 1;
    }
    
    .header .logo img {
        height: 32px;
        max-width: 120px;
    }
    
    #desktopLogoutBtn {
        display: none;
    }
}

@media (max-width: 480px) {
    .nav-style6.active {
        right: 0.75rem;
        min-width: 200px;
    }
    
    .nav-style6 a {
        font-size: 0.9rem;
        padding: 0.625rem 1rem;
    }
}
```

## JavaScript Implementation

```javascript
function toggleMenuStyle6() {
    const menuToggle = document.getElementById('menuToggle');
    const mainNav = document.getElementById('mainNav');
    
    if (menuToggle && mainNav) {
        menuToggle.classList.toggle('active');
        mainNav.classList.toggle('active');
    }
}

// Close Style 6 menu when clicking outside
document.addEventListener('click', function(event) {
    const menuToggle = document.getElementById('menuToggle');
    const mainNav = document.getElementById('mainNav');
    
    if (mainNav && mainNav.classList.contains('active')) {
        if (!mainNav.contains(event.target) && !menuToggle.contains(event.target)) {
            menuToggle.classList.remove('active');
            mainNav.classList.remove('active');
        }
    }
});

// Close Style 6 menu when pressing Escape key
document.addEventListener('keydown', function(event) {
    const menuToggle = document.getElementById('menuToggle');
    const mainNav = document.getElementById('mainNav');
    if (event.key === 'Escape' && mainNav && mainNav.classList.contains('active')) {
        menuToggle.classList.remove('active');
        mainNav.classList.remove('active');
    }
});
```

