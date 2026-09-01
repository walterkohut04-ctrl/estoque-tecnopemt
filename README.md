# Controle de Estoque — Tecnopemt

Sistema de controle de estoque de componentes eletrônicos, com login por usuário,
sincronização em tempo real entre todos que acessarem o link (igual ao sistema
da AWP), fotos, busca e histórico de entrada/saída.

## 1. Criar o projeto no Firebase (gratuito)

1. Acesse **https://console.firebase.google.com** e faça login com sua conta Google.
2. Clique em **"Criar projeto"** (ou "Add project").
3. Dê um nome, por exemplo `tecnopemt-estoque`. Pode desativar o Google Analytics
   (não é necessário).
4. Depois que o projeto for criado, no menu lateral clique em **"Compilação" > "Firestore Database"**.
5. Clique em **"Criar banco de dados"**.
   - Escolha a localização mais próxima (ex: `southamerica-east1` — São Paulo).
   - Em "Regras de segurança", escolha **"Iniciar no modo de teste"** por enquanto
     (mais fácil pra começar; ajustamos a segurança depois, veja abaixo).
6. Ainda no console, clique no ícone de **engrenagem** (canto superior esquerdo) >
   **"Configurações do projeto"**.
7. Role até **"Seus apps"** e clique no ícone **`</>`** (Web) para criar um app web.
8. Dê um apelido (ex: `estoque-web`) e clique em **"Registrar app"**.
9. Vai aparecer um bloco de código chamado `firebaseConfig`, parecido com isto:

   ```js
   const firebaseConfig = {
     apiKey: "AIzaSy...",
     authDomain: "tecnopemt-estoque.firebaseapp.com",
     projectId: "tecnopemt-estoque",
     storageBucket: "tecnopemt-estoque.appspot.com",
     messagingSenderId: "123456789",
     appId: "1:123456789:web:abcdef",
   };
   ```

10. Copie esses valores e cole no arquivo **`src/firebase.js`** deste projeto,
    substituindo os textos "COLE_AQUI...".

### Regras de segurança do Firestore (fazer depois de tudo funcionando)

No console do Firebase, em Firestore Database > Regras, você pode trocar pelo
seguinte, que permite leitura/escrita livre (já que o controle de acesso é feito
pelo login dentro do próprio app):

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read, write: if true;
    }
  }
}
```

Isso é equivalente ao "modo de teste", só que sem expirar depois de 30 dias
(o modo de teste padrão do Firebase expira automaticamente).

## 2. Rodar localmente (opcional, pra testar antes de publicar)

Com Node.js instalado no computador:

```bash
npm install
npm run dev
```

Abre em `http://localhost:5173`.

## 3. Publicar no GitHub Pages

1. Crie um repositório novo no GitHub (pode ser público ou privado — funciona
   nos dois, mas GitHub Pages em repositório privado exige plano pago do GitHub).
2. Se o nome do repositório for diferente de `tecnopemt-estoque`, edite o arquivo
   `vite.config.js` e troque `base: '/tecnopemt-estoque/'` pelo nome certo,
   ex: `base: '/nome-do-seu-repo/'`.
3. Envie este projeto pro repositório:

   ```bash
   git init
   git add .
   git commit -m "Primeira versão do sistema de estoque"
   git branch -M main
   git remote add origin https://github.com/SEU-USUARIO/NOME-DO-REPO.git
   git push -u origin main
   ```

4. No GitHub, vá em **Settings > Pages** do repositório.
5. Em **"Build and deployment"**, em "Source", escolha **"GitHub Actions"**.
6. Pronto — o arquivo `.github/workflows/deploy.yml` já está configurado pra
   publicar automaticamente toda vez que você enviar (`git push`) pra branch `main`.
7. Depois do primeiro deploy (leva 1-2 minutos, acompanhe na aba "Actions" do
   repositório), o site fica disponível em:

   `https://SEU-USUARIO.github.io/NOME-DO-REPO/`

## Usuários padrão

Na primeira vez que alguém abrir o site, o sistema cria automaticamente estes
usuários no Firestore (coleção `usuarios`):

| Usuário | Senha |
|---|---|
| Walter Kohut | 053812 |
| Victor Assunção | 123456 |
| Juan Pablo | 123456 |
| Eike Galdino | 123456 |
| Felipe Françoso | 123456 |

Cada pessoa pode trocar a própria senha dentro do app (menu do usuário > "Alterar
minha senha").

## O que mudou em relação à versão anterior (dentro do Claude)

- Fotos: upload direto da câmera/galeria funciona normalmente (sem as travas
  que existiam no ambiente de artifacts do Claude).
- Dados: agora ficam no Firestore, sincronizados em tempo real — se duas pessoas
  abrirem o link ao mesmo tempo, uma vê a alteração da outra na hora, sem precisar
  atualizar a página.
- Removidas as funções de IA (resumo técnico automático e reconhecimento por
  foto), pra manter o sistema simples e sem custo de API.
