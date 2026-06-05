# Deploy Synvitta no servidor (GitHub + Docker Compose)

## 1. Enviar o projeto para o GitHub

No seu computador, na pasta do projeto:

```bash
git add .
git commit -m "Sua mensagem"
git push origin main
```

Use **SSH** no seu PC (sem pedir senha do GitHub):

```bash
git remote set-url origin git@github.com:CarlosIvanski/Synvitta_Website.git
```

---

## 2. No servidor (VPS/cloud)

### Pré-requisitos

- Servidor com **Docker** e **Docker Compose** instalados
- Portas **80** (e **443** se usar SSL) liberadas no firewall
- Acesso SSH à VPS (chave ou senha do **servidor**, não do GitHub)

### Configurar variáveis do formulário de contato

```bash
cp .env.example .env
# Edite .env com SMTP_HOST, SMTP_USER, SMTP_PASS, CONTACT_EMAIL
```

### Clone / pull via SSH (sem senha do GitHub)

**Uma vez na VPS** — crie chave SSH só para o GitHub:

```bash
ssh-keygen -t ed25519 -C "synvitta-vps" -f ~/.ssh/id_ed25519_github -N ""
cat ~/.ssh/id_ed25519_github.pub
```

Copie a linha que aparece e adicione em **GitHub → Settings → SSH and GPG keys → New SSH key**.

Configure o Git para usar essa chave:

```bash
mkdir -p ~/.ssh
chmod 700 ~/.ssh
cat >> ~/.ssh/config << 'EOF'
Host github.com
  HostName github.com
  User git
  IdentityFile ~/.ssh/id_ed25519_github
  IdentitiesOnly yes
EOF
chmod 600 ~/.ssh/config
```

Teste (deve responder com seu usuário GitHub):

```bash
ssh -T git@github.com
```

Clone ou troque o remote (se já clonou com HTTPS):

```bash
git clone git@github.com:CarlosIvanski/Synvitta_Website.git
cd Synvitta_Website

# ou, se o repo já existe:
git remote set-url origin git@github.com:CarlosIvanski/Synvitta_Website.git
git remote -v
```

---

## 3. Vídeo SynTREP (~173 MB) — enviar via SCP (recomendado)

O vídeo está no **Git LFS**. Evite `git lfs pull` na VPS se der erro de credencial.

**Do seu Windows** (PowerShell, na pasta do projeto), envie o MP4 direto por SSH:

```powershell
.\scripts\deploy-video.ps1
```

Ou manualmente:

```powershell
scp "C:\Users\losbr\Documents\GitHub\Synvitta_Website\video\Syntrep_Horizontal.mp4" admincarlos@10.0.0.1:/opt/website/Synvitta_Website/video/
```

Na VPS, confirme o tamanho de **ambos** os MP4 (**~173M** e **~13M**, não 134 bytes) e rebuild:

```bash
ls -lh /opt/website/Synvitta_Website/video/*.mp4
docker compose build web
docker compose up -d web
```

Se `video_synvitta.mp4` (hero) ainda tiver ~134 bytes, envie também do PC:

```powershell
scp "C:\Users\losbr\Documents\GitHub\Synvitta_Website\video\video_synvitta.mp4" admincarlos@10.0.0.1:~/video_synvitta.mp4
```

Na VPS:

```bash
sudo cp ~/video_synvitta.mp4 /opt/website/Synvitta_Website/video/video_synvitta.mp4
docker compose build web && docker compose up -d web
```

---

## 4. Subir / atualizar containers

```bash
cd /opt/website/Synvitta_Website
git pull
docker compose up -d --build
```

Se houver **vídeo novo**, rode o `deploy-video.ps1` do PC antes do rebuild (seção 3).

O site: **http://IP_DO_SERVIDOR:1010**. Formulário: **http://IP_DO_SERVIDOR:3000**.

---

## 5. Apontar o domínio

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

## 6. SSL (HTTPS) – depois

Quando quiser ativar HTTPS:

- **Opção A – Certbot (Let’s Encrypt)**  
  Instale o Certbot no servidor e gere o certificado para o domínio. Configure o nginx (ou um proxy reverso) para usar o certificado e redirecionar HTTP → HTTPS.

- **Opção B – Caddy como proxy**  
  Coloque um container **Caddy** na frente do container do site; o Caddy obtém e renova o certificado automaticamente. Nesse caso o `docker-compose` expõe o site em outra porta (ex.: 8080) e o Caddy escuta na 80/443.

Se quiser, no próximo passo podemos montar o `docker-compose` com Caddy + SSL automático para o seu domínio.
