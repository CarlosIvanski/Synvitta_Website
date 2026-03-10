#!/usr/bin/env bash
set -euo pipefail

# Nome do container que está rodando o site
CONTAINER_NAME="synvitta-web"

# Caminho do nginx.conf DENTRO do container (ajuste se nginx -t mostrar outro)
NGINX_CONF_PATH="/etc/nginx/nginx.conf"

# Caminho do nginx.conf no host (no repo que você já está usando)
HOST_NGINX_CONF="/opt/website/Synvitta_Website/nginx.conf"

echo "==> Verificando se o container ${CONTAINER_NAME} está rodando..."
if ! docker ps --format '{{.Names}}' | grep -q "^${CONTAINER_NAME}$"; then
  echo "ERRO: container ${CONTAINER_NAME} não está em execução."
  exit 1
fi

echo "==> Copiando nginx.conf do host para o container..."
docker cp "${HOST_NGINX_CONF}" "${CONTAINER_NAME}:${NGINX_CONF_PATH}"

echo "==> Testando configuração do Nginx dentro do container..."
docker exec "${CONTAINER_NAME}" nginx -t

echo "==> Tentando recarregar o Nginx dentro do container..."
if docker exec "${CONTAINER_NAME}" nginx -s reload; then
  echo "Reload feito com sucesso."
else
  echo "Reload falhou, reiniciando o container..."
  docker restart "${CONTAINER_NAME}"
fi

echo "==> Concluído. Tente acessar: http://www.app.synvittadiagnostics.com"