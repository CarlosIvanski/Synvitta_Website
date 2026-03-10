# Synvitta Diagnostics - static site
FROM nginx:alpine

# Remove default nginx static content
RUN rm -rf /usr/share/nginx/html/*

# Copy custom nginx config
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copy static site (HTML, favicon, assets, images, video, pages)
COPY index.html /usr/share/nginx/html/
COPY favicon.ico /usr/share/nginx/html/
COPY pages /usr/share/nginx/html/pages
COPY assets /usr/share/nginx/html/assets
COPY images /usr/share/nginx/html/images
COPY video /usr/share/nginx/html/video

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
