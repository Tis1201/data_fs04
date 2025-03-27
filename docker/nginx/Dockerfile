FROM nginx:alpine

# Install logrotate
RUN apk add --no-cache logrotate

# Create log directory with proper permissions
RUN mkdir -p /var/log/nginx && \
    chmod 755 /var/log/nginx

# Copy logrotate configuration
COPY conf.d/logrotate.conf /etc/logrotate.d/nginx

# Create logrotate cron job
RUN echo "0 0 * * * /usr/sbin/logrotate /etc/logrotate.d/nginx > /dev/null 2>&1" > /etc/crontabs/root

# Start cron and nginx
CMD ["/bin/sh", "-c", "crond && nginx -g 'daemon off;'"]
