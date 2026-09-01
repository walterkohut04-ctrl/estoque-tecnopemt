import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// IMPORTANTE: troque 'tecnopemt-estoque' pelo nome exato do seu repositório
// no GitHub, se for diferente. Isso define o caminho base do site publicado
// em https://SEU-USUARIO.github.io/NOME-DO-REPOSITORIO/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  base: '/tecnopemt-estoque/',
})
