# Copilot Instructions for AI Coding Agents

## Project Overview
This is a accessible, static web application for image upload and preview, with theme toggling (light/dark) and responsive layout. The codebase consists of three main files:
- `index.html`: Main HTML structure, including header, theme toggle button (SVG icons), file input, image preview, and footer.
- `css/main.css`: All styling, including theme variables, responsive layout, sticky header, and footer positioning.
- `js/main.js`: Handles theme toggling, localStorage for theme persistence, and DOMContentLoaded event for safe initialization.
- The application is designed to be simple, with no external dependencies or frameworks. It uses vanilla HTML, CSS, and JavaScript.
- Pay special attention to accessibility, responsiveness, and user experience.

## Architecture & Data Flow
- No build system, frameworks, or external dependencies. All logic is client-side and runs in the browser.
- Theme toggling is managed via a button in the header. The theme state is stored in `localStorage` and reflected by the `data-theme` attribute on `<html>`.
- The file input allows users to select an image, which is previewed in the `#image-preview` container.
- The user can edit (zoom, pan)the image to fit into a given aspect ratio (1:1).
- The resulting values are then used to generate a new image with the selected aspect ratio, which can be downloaded.
- The layout uses CSS Flexbox to keep the footer at the bottom of the viewport when content is short, and push it down when content is long. The header is sticky.

## Key Patterns & Conventions
- **Theme Toggle**: The button uses SVG icons for sun/moon. CSS rules show/hide icons based on `[data-theme]`.
- **Strict Mode**: JS uses `'use strict';` for better error checking.
- **Initialization**: All JS runs inside a `DOMContentLoaded` event to ensure elements are available.
- **Accessibility**: The file input button is styled to match other buttons using the `::file-selector-button` pseudo-element. The controls for the preview/edit image are accessible via keyboard and screen readers.
- **Responsiveness**: Layout is mobile-friendly, with max-width constraints and padding.
- **No Frameworks**: All code is vanilla HTML/CSS/JS. No npm, package.json, or build tools.


## Developer Workflows
- **Edit HTML/CSS/JS directly**. No build or test commands required.
- **JavaScript Syntax**: Use ES6+ features like `let`, `const`, arrow functions, and template literals. The code is written in a compact style, with minimal comments. Use `ut` as a utility namespace for common functions. Use "let" instead of "const" for variables.
- **CSS Variables**: Use `:root` for theme colors, e.g., `--color-background-light`, `--color-background-dark`, and apply them using `var(--color-name)` in styles.
- **Debug in browser**: Open `index.html` in a browser. Use DevTools for inspection.
- **Add features**: Extend JS in `main.js`, add markup in `index.html`, and style in `main.css`.

## Examples
- To add a new button, use the `.button` class for consistent styling.
- To add new theme-dependent elements, use `[data-theme="dark"]` or `[data-theme="light"]` selectors in CSS.
- For sticky/fixed elements, use `position: sticky` or Flexbox as shown in `main.css`.

## Key Files
- `index.html`: Structure and main UI elements
- `css/main.css`: All styles, including theme, layout, and component styles
- `js/main.js`: Theme logic and initialization

---
If any conventions or workflows are unclear, please provide feedback so this guide can be improved.
