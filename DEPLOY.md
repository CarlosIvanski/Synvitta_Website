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
- Porta **80** liberada no firewall

### Comandos no servidor

```bash
# Clone do repositório (ou, se já clonou antes, apenas git pull)
git clone https://github.com/SEU_USUARIO/synvitta_website.git
cd synvitta_website

# Build da imagem e subir o container
docker compose up -d --build
```

O site ficará disponível em **http://IP_DO_SERVIDOR** (porta 80).

### Atualizar o site depois de um novo push no GitHub

```bash
cd synvitta_website
git pull
docker compose up -d --build
```

---

## 3. Apontar o domínio

No painel do seu provedor de domínio (Registro.br, GoDaddy, Cloudflare, etc.):

1. Crie um registro **A** (ou **AAAA** se usar IPv6):
   - **Nome/host:** `@` (para raiz, ex: synvitta.com) e/ou `www` (para www.synvitta.com)
   - **Valor/apontamento:** IP do seu servidor

2. Aguarde a propagação do DNS (minutos a algumas horas).

Depois disso, acesse **http://seudominio.com** (sem SSL por enquanto).

---

## 4. SSL (HTTPS) – depois

Quando quiser ativar HTTPS:

- **Opção A – Certbot (Let’s Encrypt)**  
  Instale o Certbot no servidor e gere o certificado para o domínio. Configure o nginx (ou um proxy reverso) para usar o certificado e redirecionar HTTP → HTTPS.

- **Opção B – Caddy como proxy**  
  Coloque um container **Caddy** na frente do container do site; o Caddy obtém e renova o certificado automaticamente. Nesse caso o `docker-compose` expõe o site em outra porta (ex.: 8080) e o Caddy escuta na 80/443.

Se quiser, no próximo passo podemos montar o `docker-compose` com Caddy + SSL automático para o seu domínio.
