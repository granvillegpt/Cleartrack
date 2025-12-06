# Modal Style Rules - Premium Standard

This document defines the standard modal style for the Cleartrack application. All modals must follow these guidelines to maintain consistency and premium appearance.

## Base CSS Classes

### `.modal-overlay`
- **Position**: Fixed, covering entire viewport
- **Background**: `rgba(0, 0, 0, 0.75)` with `backdrop-filter: blur(8px)`
- **Display**: Flex, centered
- **Z-index**: 1000
- **Animation**: Opacity and visibility transitions (0.3s ease)
- **Padding**: 20px

**States:**
- Hidden: `opacity: 0`, `visibility: hidden`
- Visible: `opacity: 1`, `visibility: visible` (when `.hidden` class is removed)

### `.modal`
- **Background**: White
- **Border-radius**: 20px
- **Max-width**: 600px (can be overridden with inline style for specific modals)
- **Width**: 90%
- **Max-height**: 90vh
- **Overflow**: Hidden
- **Display**: Flex, column direction
- **Box-shadow**: `0 25px 50px rgba(0,0,0,0.5)`
- **Animation**: Scale and translate transform (0.3s ease)
  - Initial: `scale(0.9) translateY(20px)`
  - Active: `scale(1) translateY(0)`

### `.modal-header`
- **Background**: Linear gradient `135deg, #0b7285 0%, #0891b2 100%` (teal)
- **Color**: White
- **Padding**: 24px
- **Border-radius**: `20px 20px 0 0` (rounded top corners only)
- **Display**: Flex
- **Justify-content**: Space-between
- **Align-items**: Center
- **Width**: 100%
- **Box-sizing**: Border-box
- **Flex-shrink**: 0
- **Border-bottom**: None
- **Margin-bottom**: 0

### `.modal-title`
- **Font-size**: 20px
- **Font-weight**: 600
- **Color**: White
- **Margin**: 0

### `.modal-close`
- **Background**: `rgba(255,255,255,0.2)`
- **Border**: None
- **Color**: White
- **Width**: 36px
- **Height**: 36px
- **Border-radius**: 50% (circular)
- **Font-size**: 24px
- **Cursor**: Pointer
- **Display**: Flex
- **Align-items**: Center
- **Justify-content**: Center
- **Transition**: All 0.2s ease
- **Line-height**: 1
- **Flex-shrink**: 0

**Hover State:**
- **Background**: `rgba(255,255,255,0.3)`
- **Transform**: `rotate(90deg)`

### `.modal-body`
- **Padding**: 24px
- **Overflow-y**: Auto
- **Flex**: 1
- **Width**: 100%
- **Box-sizing**: Border-box

## HTML Structure

All modals must follow this structure:

```html
<div id="modalId" class="modal-overlay hidden" onclick="closeModalOnOverlay(event)">
    <div class="modal" onclick="event.stopPropagation()">
        <div class="modal-header">
            <h3 class="modal-title">Modal Title</h3>
            <button onclick="closeModal()" class="modal-close">&times;</button>
        </div>
        <div class="modal-body">
            <!-- Modal content here -->
        </div>
    </div>
</div>
```

## JavaScript Functions

### Opening Modal
```javascript
function openModal() {
    const modal = document.getElementById('modalId');
    modal.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
}
```

### Closing Modal
```javascript
function closeModal() {
    const modal = document.getElementById('modalId');
    modal.classList.add('hidden');
    document.body.style.overflow = '';
}
```

### Overlay Click Handler
```javascript
function closeModalOnOverlay(event) {
    if (event.target.id === 'modalId') {
        closeModal();
    }
}
```

## Important Rules

1. **NO INLINE STYLES**: Do not add inline styles to `.modal-header`, `.modal-title`, or `.modal-close`. Use the base CSS classes.

2. **Consistent Colors**: 
   - Header gradient: Always use `#0b7285` to `#0891b2`
   - Text: Always white in header
   - Close button: Always white with semi-transparent background

3. **Animation**: All modals must use the standard fade-in and scale animation.

4. **Body Scroll Lock**: Always lock body scroll when modal is open, unlock when closed.

5. **Overlay Click**: Modals should close when clicking the overlay (but not when clicking inside the modal).

6. **Keyboard Support**: Consider adding ESC key support:
```javascript
document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') {
        const modal = document.getElementById('modalId');
        if (modal && !modal.classList.contains('hidden')) {
            closeModal();
        }
    }
});
```

## Customization

If a modal needs a different max-width, you can override it with inline style on the `.modal` element:
```html
<div class="modal" style="max-width: 800px; width: 90%;">
```

**DO NOT** override:
- Header background color
- Header text color
- Close button style
- Border-radius
- Animation properties
- Padding values (unless absolutely necessary)

## Examples

### Standard Modal
```html
<div id="exampleModal" class="modal-overlay hidden" onclick="closeExampleModalOnOverlay(event)">
    <div class="modal" onclick="event.stopPropagation()">
        <div class="modal-header">
            <h3 class="modal-title">Example Modal</h3>
            <button onclick="closeExampleModal()" class="modal-close">&times;</button>
        </div>
        <div class="modal-body">
            <p>Modal content goes here.</p>
        </div>
    </div>
</div>
```

### Wide Modal
```html
<div id="wideModal" class="modal-overlay hidden" onclick="closeWideModalOnOverlay(event)">
    <div class="modal" style="max-width: 900px; width: 90%;" onclick="event.stopPropagation()">
        <div class="modal-header">
            <h3 class="modal-title">Wide Modal</h3>
            <button onclick="closeWideModal()" class="modal-close">&times;</button>
        </div>
        <div class="modal-body">
            <p>Wide modal content goes here.</p>
        </div>
    </div>
</div>
```

## Maintenance

- When creating new modals, always reference this document
- If changes are needed to the standard style, update this document and all existing modals
- Test modals on mobile devices to ensure responsive behavior
- Ensure all modals follow accessibility best practices

