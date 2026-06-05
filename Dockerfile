# Synvitta Diagnostics - static site
FROM nginx:alpine

# Remove default nginx static content
RUN rm -rf /usr/share/nginx/html/*

# Copy custom nginx config
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copy static site (HTML, favicon, assets, images, video, pages)
COPY index.html /usr/share/nginx/html/
COPY favicon.ico /usr/share/nginx/html/
COPY googlef1ad2c88ec2c1241.html /usr/share/nginx/html/
COPY pages /usr/share/nginx/html/pages
COPY assets /usr/share/nginx/html/assets
COPY images /usr/share/nginx/html/images
COPY video /usr/share/nginx/html/video

# Fail the build if Git LFS pointers were copied instead of real MP4 files
RUN for f in /usr/share/nginx/html/video/*.mp4; do \
      test -f "$f" || continue; \
      head -c 120 "$f" | grep -q 'git-lfs' && \
      echo "ERROR: $f is a Git LFS pointer. On the server run: git lfs pull && docker compose build web" && \
      exit 1; \
    done

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
