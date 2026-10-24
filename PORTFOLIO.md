# Thanuj Guptha Alavala — Personal Portfolio

A modern, responsive personal portfolio built with plain HTML, CSS, and JavaScript — no frameworks, no build step. It includes a home/hero section, about me, skills, projects with filtering, education and credentials, and a validated contact form.

## Features

- **Responsive layout** — fluid typography and grids that adapt from small phones to wide desktop screens.
- **Dark & light themes** — toggle in the header, remembers your choice in `localStorage`, and respects your OS preference on first visit.
- **Smooth animations** — scroll-reveal sections, animated skill bars, a typing effect, core-stack chips, and a scroll progress bar.
- **Sticky, mobile-friendly navigation** — blurs on scroll, highlights the active section, and collapses into an accessible slide-down menu.
- **Project filtering** — filter by All, AI & ML, or Web apps (with keyboard arrow support).
- **Contact form validation** — inline errors, accessible focus handling, and a success confirmation (front-end only).
- **Accessibility-minded** — skip link, semantic landmarks, visible focus styles, ARIA labels, and full `prefers-reduced-motion` support.

## Project structure

```
.
├── index.html          # All page content and sections
├── css/
│   └── styles.css      # Design tokens, layout, components, responsive rules
├── js/
│   └── main.js         # Theme, nav, reveals, typing, filters, form validation
├── assets/
│   ├── favicon.svg                        # Gradient "TG" monogram favicon
│   └── Thanuj_Guptha_Alavala_Resume.pdf   # Downloadable résumé
└── README.md
```

## Run the website locally

### Option 1 — Open the file directly (quickest)

Double-click `index.html`, or right-click it in File Explorer and choose **Open with → your browser**.

Everything works, but fonts load from Google Fonts, so keep an internet connection for the intended typography.

### Option 2 — Use VS Code Live Server (recommended while editing)

1. Install [Visual Studio Code](https://code.visualstudio.com/).
2. Install the **Live Server** extension by Ritwick Dey.
3. Open this project folder in VS Code.
4. Right-click `index.html` and choose **Open with Live Server**.

Your browser opens at something like `http://127.0.0.1:5500` and refreshes automatically when you save changes.

### Option 3 — Python's built-in server

Open a terminal in this project folder and run:

```bash
# Python 3
python -m http.server 8000
```

Then visit `http://localhost:8000` in your browser. Stop the server with `Ctrl + C`.

### Option 4 — Node.js

If you have Node.js installed:

```bash
npx serve .
```

Visit the URL it prints (usually `http://localhost:3000`).

## Customize it

- **Name, role, and copy** — the content lives in `index.html`: hero, logo, about, skills, projects, education, contact, and footer.
- **Links** — the résumé does not include profile URLs, so the GitHub/LinkedIn links currently point to `https://github.com` and `https://linkedin.com`. Replace them (hero socials, contact section, project source links) with your real profiles. Project demo buttons point to `https://example.com` until you have live links.
- **Résumé** — the download button links to `assets/Thanuj_Guptha_Alavala_Resume.pdf`. Replace that file (keeping the name) or update the `href` in the About section.
- **Portrait** — the about section uses a stylized "TG" monogram. To use a photo, replace the `.portrait` contents with an `<img>` and adjust the CSS in the `.portrait` rules.
- **Colors** — edit the CSS custom properties at the top of `css/styles.css` (`--primary`, `--primary-2`, `--bg`, etc.). Both themes are defined there.
- **Projects** — duplicate a `.project` article. Set `data-category` to `ml` or `web`, and set the card's accent colors with `style="--accent: #7c6cff; --accent-2: #22d3ee"`.
- **Skills** — change the text and both the visible percentage and `--level` inline variable on each `.skill`.
- **Contact form** — the demo only validates in the browser. To receive real messages, create a free [Formspree](https://formspree.io/) form and set it on the `<form>`:

  ```html
  <form class="contact-form" id="contact-form" action="https://formspree.io/f/YOUR_ID" method="POST">
  ```

  Then remove `event.preventDefault()` / the fake success block from the submit handler in `js/main.js` (or keep the validation and let the browser submit after it passes by calling `form.submit()`).

  Netlify Forms works too: add `netlify` and `name="contact"` to the form tag when deploying to Netlify.

## Deploy

This is a static site, so you can host it for free on:

- **GitHub Pages** — push the files to a repository, then enable Pages (Settings → Pages → Deploy from branch).
- **Netlify / Vercel** — drag and drop the folder, or connect the repository; no build command is needed.
- **Cloudflare Pages** — same idea: upload the static files.

## Notes

- The Google Fonts link requires internet access. Offline, the site falls back to system fonts and still works.
- All animations are disabled for visitors who enable "reduce motion" in their operating system.
- This is a front-end site: nothing is stored or sent anywhere by default.
