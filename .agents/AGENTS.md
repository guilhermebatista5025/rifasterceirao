# Diretrizes de Arquitetura - Projetos Modulares

Sempre siga esta estrutura de organização de arquivos nos projetos:

1. **Arquivo Principal**:
   - Mantenha o arquivo `index.html` na raiz do projeto.

2. **Páginas HTML**:
   - Todas as páginas secundárias HTML (como admin, perfil, painéis, etc.) devem ser armazenadas na pasta `pages/` (ex: `pages/admin.html`, `pages/user.html`).

3. **Arquivos CSS**:
   - Todos os arquivos CSS (globais ou específicos de páginas) devem ficar na pasta `styles/` (ex: `styles/style.css`, `styles/admin.css`, `styles/user.css`, `styles/rifas.css`).

4. **Arquivos JavaScript**:
   - Todos os arquivos de lógica JavaScript (globais ou específicos de páginas) devem ficar na pasta `js/` (ex: `js/app.js`, `js/admin.js`, `js/rifas.js`, `js/user.js`).
