// Genera un único HTML autocontenido de la app en modo local (demostración).
// Uso: npm run build:demo   → dist/mascota-demo.html
import { build } from 'esbuild';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';

const js = await build({ entryPoints: ['src/app/main.js'], bundle: true, format: 'iife', minify: true, write: false, target: 'es2020' });
const css = readFileSync('styles/app.css', 'utf8');
const html = readFileSync('index.html', 'utf8');
const body = html.slice(html.indexOf('<body>') + 6, html.indexOf('<script type="module"'));
mkdirSync('dist', { recursive: true });
const out = `<title>Mushu</title>
<meta name="claude:viewport-fit-sides" content="cover">
<meta name="theme-color" content="#ffa8fd">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Baloo+2:wght@600;800&family=Nunito:wght@600;700;800&display=swap">
<style>${css}</style>
${body}
<script>window.__MASCOTA_DEMO__ = true;</script>
<script>${js.outputFiles[0].text}</script>
`;
writeFileSync('dist/mascota-demo.html', out);
console.log('dist/mascota-demo.html', (out.length / 1024).toFixed(1) + ' KB');
