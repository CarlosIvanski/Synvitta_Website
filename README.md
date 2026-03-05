## Synvitta Diagnostics Website

This repository contains a static, SEO-friendly website for **Synvitta Diagnostics**, designed to match the visual and UX standards of premium international biotechnology companies.

### Stack

- Static HTML
- Modern, responsive CSS (no framework)
- Lightweight vanilla JavaScript for micro-interactions and scroll animations

### Structure

```
├── index.html              # Homepage (hero, About, Technology, Products, Pipeline, Contact)
├── pages/                  # Páginas secundárias
│   ├── news.html          # News & Updates
│   ├── publications.html # Scientific Publications
│   ├── regulatory.html    # Regulatory & Certifications
│   └── portal.html        # B2B / Partner Portal
├── assets/
│   ├── css/styles.css     # Estilos globais, layout, animações
│   └── js/main.js         # Header, scroll, formulário de contato
├── images/                # Imagens do site
│   ├── synvitta.png
│   ├── molecular-abstract.jpg
│   └── Modern biotechnology laboratory environment.jpg
└── video/
    └── video_synvitta.mp4 # Vídeo de fundo do hero
```

The header includes a non-interactive `EN / PT` language toggle to indicate that **English is primary** and a **Portuguese version is planned**. Future localization can be implemented via separate HTML files or a more advanced framework if needed.

### Running Locally

Install dependencies and start the dev server:

```bash
npm install
npm run dev
```

The site will open at `http://localhost:4173/` (port configurable in `vite.config.js`).

- **`npm run dev`** – development server with fast refresh  
- **`npm run build`** – build for production (output in `dist/`)  
- **`npm run preview`** – serve the production build locally  

The site is static and can be deployed behind any standard HTTPS-capable web server or CDN.

