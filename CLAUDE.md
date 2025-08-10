# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a personal homepage/resume website for Tian Qijia, hosted on GitHub Pages. It's a static website showcasing education, projects, internships, honors, and skills with bilingual support (English/Chinese).

## Development Commands

Since this is a static HTML/CSS/JavaScript website, no build tools or package managers are required. Development is straightforward:

- **Local Development**: Open `index.html` in a web browser or use a local server like `python3 -m http.server 8000`
- **File Watching**: No automated build process - changes to HTML/CSS/JS are immediately visible
- **Deployment**: Files are automatically served via GitHub Pages from the main branch

## Project Architecture

### File Structure
- `index.html` - Main homepage with complete resume content
- `script.js` - Interactive features (language toggle, navigation, keyboard shortcuts)
- `styles.css` - Styling and layout
- `certificates.html` - Certificate showcase page
- `fyp.html` - Final year project details with GitHub API integration
- `other/simple.html` - Alternative simple version
- Image assets: `photo.jpeg`, `FYP.png`, `RMUA.jpeg`, `c1.png`, `c2.png`, `presentation.png`, `train.gif`

### Key Features
- **Bilingual Support**: All content elements have `data-en` and `data-zh` attributes for English/Chinese toggle
- **Interactive Navigation**: Sticky navigation bar with smooth scrolling and active state management
- **Keyboard Shortcuts**: 
  - 'h' - Hide navigation and appendix sections
  - 'j' - Show navigation and appendix sections  
  - '0' - Toggle header style between colored and resume-print mode
- **GitHub Integration**: `fyp.html` fetches live repository data via GitHub API
- **Responsive Design**: Mobile-friendly layout with flexible navigation

### Code Conventions
- HTML uses semantic structure with section IDs for navigation
- CSS follows component-based organization with clear section separation
- JavaScript uses modern DOM APIs and event handling
- Bilingual content managed through data attributes rather than separate files

## Important Notes

- This is a **static website** - no server-side processing or build steps required
- Content updates require editing HTML directly (no CMS or template system)
- Images are directly committed to the repository (consider optimization for large files)
- GitHub Pages serves from the main branch automatically