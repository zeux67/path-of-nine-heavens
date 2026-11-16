import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { viteSingleFile } from 'vite-plugin-singlefile';

// Reconstructed packaging (Nov 16, 2026): the recovered 0.2 source archive
// shipped no build configuration; this is a new, labeled reconstruction that
// bundles the game into one self-contained HTML file for GitHub Pages.
export default defineConfig({
  base: './',
  plugins: [react(), viteSingleFile()],
});
