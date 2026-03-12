# Deploy Synvitta no servidor (GitHub + Docker Compose)

## 1. Enviar o projeto para o GitHub

No seu computador, na pasta do projeto:

```bash
# Se ainda não inicializou o repositório
git init
git add .
git commit -m "Site Synvitta + Docker"

# Crie um repositório no GitHub (github.com → New repository) e depois:
git remote add origin https://github.com/SEU_USUARIO/synvitta_website.git
git branch -M main
git push -u origin main
```

Substitua `SEU_USUARIO` pelo seu usuário do GitHub e o nome do repositório se for diferente.

---

## 2. No servidor (VPS/cloud)

### Pré-requisitos

- Servidor com **Docker** e **Docker Compose** instalados
- Portas **80** (e **443** se usar SSL) liberadas no firewall

### Configurar variáveis do formulário de contato

Antes de subir os containers, crie o arquivo `.env` com as credenciais SMTP:

```bash
cp .env.example .env
# Edite .env com suas configurações SMTP e CONTACT_EMAIL
```

### Comandos no servidor

```bash
# Clone do repositório (ou, se já clonou antes, apenas git pull)
git clone https://github.com/SEU_USUARIO/synvitta_website.git
cd synvitta_website

# Criar .env a partir do exemplo (se ainda não fez)
cp .env.example .env
# Edite .env com SMTP_HOST, SMTP_USER, SMTP_PASS, CONTACT_EMAIL

# Build das imagens e subir os containers
docker compose up -d --build
```

O site ficará disponível em **http://IP_DO_SERVIDOR:1010** (web). O backend do formulário ficará em **http://IP_DO_SERVIDOR:3000**.

### Atualizar o site e o backend depois de um novo push no GitHub

```bash
cd synvitta_website
git pull
docker compose up -d --build
```

---

## 3. Apontar o domínio

No painel do seu provedor de domínio (Registro.br, GoDaddy, Cloudflare, etc.):

1. Crie registros **A** (ou **AAAA** se usar IPv6):
   - **Nome/host:** `@` ou `www` → IP do servidor (para o site)
   - **Nome/host:** `forms` → IP do servidor (para o endpoint do formulário: `forms.synvittadiagnostics.com`)

2. Aguarde a propagação do DNS (minutos a algumas horas).

Depois disso:
- Site: **http://www.synvittadiagnostics.com** (ou domínio configurado)
- API do formulário: **http://forms.synvittadiagnostics.com**

### Proxy reverso (obrigatório em produção)

O site e o backend precisam estar acessíveis via domínio. Use um proxy reverso (Nginx ou Caddy) no host:

- **www.synvittadiagnostics.com** → `localhost:1010` (container web)
- **forms.synvittadiagnostics.com** → `localhost:3000` (container forms)

Com Caddy ou Nginx na frente, você pode obter SSL (HTTPS) automaticamente. O `forms` subdomínio deve receber CORS das origens permitidas (já configurado no backend para www.synvittadiagnostics.com, app.synvittadiagnostics.com).

---

## 4. SSL (HTTPS) – depois

Quando quiser ativar HTTPS:

- **Opção A – Certbot (Let’s Encrypt)**  
  Instale o Certbot no servidor e gere o certificado para o domínio. Configure o nginx (ou um proxy reverso) para usar o certificado e redirecionar HTTP → HTTPS.

- **Opção B – Caddy como proxy**  
  Coloque um container **Caddy** na frente do container do site; o Caddy obtém e renova o certificado automaticamente. Nesse caso o `docker-compose` expõe o site em outra porta (ex.: 8080) e o Caddy escuta na 80/443.

Se quiser, no próximo passo podemos montar o `docker-compose` com Caddy + SSL automático para o seu domínio.
