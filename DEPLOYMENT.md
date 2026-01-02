# Production Deployment Guide

This guide covers deploying the Recipe Tracking App to a Linux production environment.

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [System Requirements](#system-requirements)
3. [Backend Deployment](#backend-deployment)
4. [Frontend Deployment](#frontend-deployment)
5. [Database Setup](#database-setup)
6. [Web Server Configuration](#web-server-configuration)
7. [Process Management](#process-management)
8. [SSL/HTTPS Setup](#sslhttps-setup)
9. [Security Considerations](#security-considerations)
10. [Monitoring and Maintenance](#monitoring-and-maintenance)

## Prerequisites

- Linux server (Ubuntu 20.04+ or similar)
- Root or sudo access
- Domain name (optional, for SSL)
- Basic knowledge of Linux command line

## System Requirements

### Minimum Requirements
- **CPU**: 2 cores
- **RAM**: 2GB
- **Storage**: 10GB free space
- **Network**: Public IP address

### Recommended Requirements
- **CPU**: 4+ cores
- **RAM**: 4GB+
- **Storage**: 20GB+ free space
- **Network**: Static IP address

## Backend Deployment

### 1. Install System Dependencies

```bash
# Update system packages
sudo apt update && sudo apt upgrade -y

# Install Python 3.13 and pip
sudo apt install -y python3.13 python3.13-venv python3-pip

# Install PostgreSQL (recommended for production) or SQLite
sudo apt install -y postgresql postgresql-contrib

# Install Nginx
sudo apt install -y nginx

# Install other dependencies
sudo apt install -y build-essential libpq-dev
```

### 2. Create Application User

```bash
# Create a dedicated user for the application
sudo useradd -m -s /bin/bash recipes-app
sudo su - recipes-app
```

### 3. Clone and Setup Backend

```bash
# Clone repository (or copy files)
cd /home/recipes-app
git clone <your-repo-url> recipes-app
# OR copy your project files to /home/recipes-app/recipes-app

cd recipes-app/backend

# Create virtual environment
python3.13 -m venv venv
source venv/bin/activate

# Install dependencies
pip install --upgrade pip
pip install -r requirements.txt
```

### 4. Configure Environment Variables

Create `/home/recipes-app/recipes-app/backend/.env`:

```bash
# Database
DATABASE_URL=postgresql://recipes_user:your_secure_password@localhost/recipes_db
# OR for SQLite (not recommended for production):
# DATABASE_URL=sqlite:///./recipes.db

# Security
SECRET_KEY=your-very-secure-secret-key-here-generate-with-openssl-rand-hex-32
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=30

# File Upload
UPLOAD_DIR=/home/recipes-app/recipes-app/backend/uploads
MAX_UPLOAD_SIZE=10485760
ALLOWED_IMAGE_EXTENSIONS=[".jpg",".jpeg",".png",".gif",".webp"]

# CORS - Update with your frontend domain
CORS_ORIGINS=["https://yourdomain.com","https://www.yourdomain.com"]
```

**Generate a secure secret key:**
```bash
openssl rand -hex 32
```

### 5. Setup PostgreSQL Database (Recommended)

```bash
# Switch to postgres user
sudo -u postgres psql

# In PostgreSQL prompt:
CREATE DATABASE recipes_db;
CREATE USER recipes_user WITH PASSWORD 'your_secure_password';
GRANT ALL PRIVILEGES ON DATABASE recipes_db TO recipes_user;
\q
```

### 6. Initialize Database

```bash
cd /home/recipes-app/recipes-app/backend
source venv/bin/activate

# Run database migrations (if using Alembic) or create tables
python -c "from app.database import engine, Base; Base.metadata.create_all(bind=engine)"

# Run cover_image migration if needed
python scripts/add_cover_image.py
```

### 7. Create Uploads Directory

```bash
mkdir -p /home/recipes-app/recipes-app/backend/uploads
chmod 755 /home/recipes-app/recipes-app/backend/uploads
```

## Frontend Deployment

### 1. Install Node.js

```bash
# Install Node.js 18+ (using NodeSource repository)
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install -y nodejs

# Verify installation
node --version
npm --version
```

### 2. Build Frontend

```bash
cd /home/recipes-app/recipes-app/frontend

# Install dependencies
npm install

# Create production .env file
cat > .env.production << EOF
VITE_API_URL=https://api.yourdomain.com/api
EOF

# Build for production
npm run build
```

The build output will be in `frontend/dist/` directory.

## Database Setup

### PostgreSQL (Recommended for Production)

1. **Create database and user** (see step 5 in Backend Deployment)

2. **Update database URL in .env**:
   ```
   DATABASE_URL=postgresql://recipes_user:password@localhost/recipes_db
   ```

3. **Test connection**:
   ```bash
   cd /home/recipes-app/recipes-app/backend
   source venv/bin/activate
   python -c "from app.database import engine; engine.connect(); print('Connected!')"
   ```

### SQLite (Not Recommended for Production)

If using SQLite, ensure the database file has proper permissions:
```bash
touch /home/recipes-app/recipes-app/backend/recipes.db
chmod 644 /home/recipes-app/recipes-app/backend/recipes.db
```

## Web Server Configuration

### Nginx Configuration

**Note**: On Fedora/RHEL/CentOS, nginx uses `/etc/nginx/conf.d/` instead of `sites-available/sites-enabled`.  
On Debian/Ubuntu, use `/etc/nginx/sites-available/` and symlink to `sites-enabled/`.

**For Fedora/RHEL/CentOS**, create `/etc/nginx/conf.d/recipes-app.conf`:

**For Debian/Ubuntu**, create `/etc/nginx/sites-available/recipes-app`:

```nginx
# Backend API
server {
    listen 80;
    server_name api.yourdomain.com;

    # Redirect HTTP to HTTPS
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name api.yourdomain.com;

    ssl_certificate /etc/letsencrypt/live/api.yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/api.yourdomain.com/privkey.pem;

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;

    # API proxy
    location /api {
        proxy_pass http://127.0.0.1:8001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }

    # Static file uploads
    location /uploads {
        alias /home/recipes-app/recipes-app/backend/uploads;
        expires 30d;
        add_header Cache-Control "public, immutable";
    }

    # Health check
    location /health {
        proxy_pass http://127.0.0.1:8001;
        access_log off;
    }
}

# Frontend
server {
    listen 80;
    server_name yourdomain.com www.yourdomain.com;

    # Redirect HTTP to HTTPS
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name yourdomain.com www.yourdomain.com;

    ssl_certificate /etc/letsencrypt/live/yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/yourdomain.com/privkey.pem;

    root /home/recipes-app/recipes-app/frontend/dist;
    index index.html;

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;

    # Gzip compression
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_types text/plain text/css text/xml text/javascript application/x-javascript application/xml+rss application/json;

    # Serve static files
    location / {
        try_files $uri $uri/ /index.html;
    }

    # Cache static assets
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}
```

**For Fedora/RHEL/CentOS**, the file is automatically loaded from `/etc/nginx/conf.d/`:
```bash
# Copy config file
sudo cp recipes-app.conf /etc/nginx/conf.d/recipes-app.conf

# Test configuration
sudo nginx -t

# Reload nginx
sudo systemctl reload nginx
```

**For Debian/Ubuntu**, enable the site:
```bash
sudo ln -s /etc/nginx/sites-available/recipes-app /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

## Process Management

### Systemd Service for Backend

Create `/etc/systemd/system/recipes-app-backend.service`:

```ini
[Unit]
Description=Recipes App Backend API
After=network.target postgresql.service

[Service]
Type=simple
User=recipes-app
Group=recipes-app
WorkingDirectory=/home/recipes-app/recipes-app/backend
Environment="PATH=/home/recipes-app/recipes-app/backend/venv/bin"
Environment="PYTHONPATH=/home/recipes-app/recipes-app/backend"
ExecStart=/home/recipes-app/recipes-app/backend/venv/bin/uvicorn app.main:app --host 127.0.0.1 --port 8001 --workers 4
Restart=always
RestartSec=10

# Security settings
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=strict
# Allow writes to the application directory
ReadWritePaths=/home/recipes-app/recipes-app/backend/uploads /home/recipes-app/recipes-app/backend
# Don't use ProtectHome=read-only as it conflicts with ReadWritePaths

[Install]
WantedBy=multi-user.target
```

Enable and start the service:
```bash
sudo systemctl daemon-reload
sudo systemctl enable recipes-app-backend
sudo systemctl start recipes-app-backend
sudo systemctl status recipes-app-backend
```

### View Logs

```bash
# View logs
sudo journalctl -u recipes-app-backend -f

# View last 100 lines
sudo journalctl -u recipes-app-backend -n 100
```

## SSL/HTTPS Setup

### Using Let's Encrypt (Free SSL)

```bash
# Install Certbot
sudo apt install -y certbot python3-certbot-nginx

# Obtain certificates
sudo certbot --nginx -d yourdomain.com -d www.yourdomain.com
sudo certbot --nginx -d api.yourdomain.com

# Auto-renewal (already set up by certbot)
sudo certbot renew --dry-run
```

Certificates will auto-renew. Check renewal with:
```bash
sudo certbot renew --dry-run
```

## Security Considerations

### 1. Firewall Configuration

```bash
# Install UFW
sudo apt install -y ufw

# Allow SSH, HTTP, HTTPS
sudo ufw allow 22/tcp
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp

# Enable firewall
sudo ufw enable
sudo ufw status
```

### 2. File Permissions

```bash
# Set proper ownership
sudo chown -R recipes-app:recipes-app /home/recipes-app/recipes-app

# Set secure permissions
chmod 700 /home/recipes-app/recipes-app/backend
chmod 600 /home/recipes-app/recipes-app/backend/.env
chmod 755 /home/recipes-app/recipes-app/backend/uploads
```

### 3. Environment Variables Security

- Never commit `.env` files to version control
- Use strong, randomly generated secret keys
- Rotate secrets periodically
- Restrict file permissions on `.env` files

### 4. Database Security

- Use strong database passwords
- Limit database user privileges
- Enable PostgreSQL SSL connections in production
- Regular database backups

### 5. Application Security

- Keep dependencies updated: `pip list --outdated`
- Regularly update system packages
- Monitor application logs for suspicious activity
- Implement rate limiting (consider using nginx rate limiting)

## Monitoring and Maintenance

### 1. Log Management

**Backend logs** (systemd):
```bash
sudo journalctl -u recipes-app-backend -f
```

**Nginx logs**:
```bash
# Access logs
sudo tail -f /var/log/nginx/access.log
# Error logs
sudo tail -f /var/log/nginx/error.log
```

### 2. Health Checks

Create a simple health check script `/home/recipes-app/health-check.sh`:

```bash
#!/bin/bash
# Check if backend is responding
curl -f http://localhost:8001/health || exit 1

# Check if database is accessible
# Add your database check here
```

Make it executable and add to cron:
```bash
chmod +x /home/recipes-app/health-check.sh
```

### 3. Backup Strategy

**Database Backup (PostgreSQL)**:
```bash
# Create backup script
cat > /home/recipes-app/backup-db.sh << 'EOF'
#!/bin/bash
BACKUP_DIR="/home/recipes-app/backups"
DATE=$(date +%Y%m%d_%H%M%S)
mkdir -p $BACKUP_DIR
pg_dump -U recipes_user recipes_db > $BACKUP_DIR/recipes_db_$DATE.sql
# Keep only last 30 days
find $BACKUP_DIR -name "recipes_db_*.sql" -mtime +30 -delete
EOF

chmod +x /home/recipes-app/backup-db.sh

# Add to cron (daily at 2 AM)
(crontab -l 2>/dev/null; echo "0 2 * * * /home/recipes-app/backup-db.sh") | crontab -
```

**File Uploads Backup**:
```bash
# Backup uploads directory
cat > /home/recipes-app/backup-uploads.sh << 'EOF'
#!/bin/bash
BACKUP_DIR="/home/recipes-app/backups"
DATE=$(date +%Y%m%d_%H%M%S)
mkdir -p $BACKUP_DIR
tar -czf $BACKUP_DIR/uploads_$DATE.tar.gz /home/recipes-app/recipes-app/backend/uploads
# Keep only last 7 days
find $BACKUP_DIR -name "uploads_*.tar.gz" -mtime +7 -delete
EOF

chmod +x /home/recipes-app/backup-uploads.sh

# Add to cron (daily at 3 AM)
(crontab -l 2>/dev/null; echo "0 3 * * * /home/recipes-app/backup-uploads.sh") | crontab -
```

### 4. Update Procedure

**Backend Updates**:
```bash
cd /home/recipes-app/recipes-app/backend
source venv/bin/activate
git pull  # or copy new files
pip install -r requirements.txt
sudo systemctl restart recipes-app-backend
```

**Frontend Updates**:
```bash
cd /home/recipes-app/recipes-app/frontend
git pull  # or copy new files
npm install
npm run build
sudo systemctl reload nginx
```

### 5. Performance Tuning

**Backend (Uvicorn workers)**:
- Adjust `--workers` count based on CPU cores (typically 2-4x CPU cores)
- Monitor with: `htop` or `top`

**Database (PostgreSQL)**:
- Tune `postgresql.conf` for your workload
- Monitor with: `SELECT * FROM pg_stat_activity;`

**Nginx**:
- Enable gzip compression (already in config)
- Adjust `worker_processes` in `/etc/nginx/nginx.conf` to match CPU cores

## Troubleshooting

### Backend not starting
```bash
# Check service status
sudo systemctl status recipes-app-backend

# Check logs
sudo journalctl -u recipes-app-backend -n 50

# Test manually
cd /home/recipes-app/recipes-app/backend
source venv/bin/activate
export PYTHONPATH=/home/recipes-app/recipes-app/backend
uvicorn app.main:app --host 127.0.0.1 --port 8001
```

### ModuleNotFoundError: No module named 'app'
If you see this error, it means Python can't find the `app` module. Solutions:

1. **Ensure PYTHONPATH is set in systemd service** (already in the service file above)
2. **Verify the working directory**:
   ```bash
   # Check if app directory exists
   ls -la /home/recipes-app/recipes-app/backend/app/
   # Should show __init__.py, main.py, etc.
   ```

3. **Alternative: Use python -m uvicorn** (modify systemd service):
   ```ini
   ExecStart=/home/recipes-app/recipes-app/backend/venv/bin/python -m uvicorn app.main:app --host 127.0.0.1 --port 8001 --workers 4
   ```

4. **After fixing, reload systemd**:
   ```bash
   sudo systemctl daemon-reload
   sudo systemctl restart recipes-app-backend
   ```

### Database connection issues
```bash
# Test PostgreSQL connection
sudo -u postgres psql -c "SELECT version();"

# Check if database exists
sudo -u postgres psql -l | grep recipes_db

# Test connection from app user
psql -U recipes_user -d recipes_db -h localhost
```

### Nginx issues
```bash
# Test configuration
sudo nginx -t

# Check error logs
sudo tail -f /var/log/nginx/error.log

# Reload configuration
sudo systemctl reload nginx
```

### Permission issues
```bash
# Fix ownership
sudo chown -R recipes-app:recipes-app /home/recipes-app/recipes-app

# Fix uploads directory
sudo chmod 755 /home/recipes-app/recipes-app/backend/uploads
```

## Quick Reference

### Service Management
```bash
# Backend
sudo systemctl start recipes-app-backend
sudo systemctl stop recipes-app-backend
sudo systemctl restart recipes-app-backend
sudo systemctl status recipes-app-backend

# Nginx
sudo systemctl start nginx
sudo systemctl stop nginx
sudo systemctl reload nginx
sudo systemctl status nginx

# PostgreSQL
sudo systemctl start postgresql
sudo systemctl stop postgresql
sudo systemctl status postgresql
```

### Important File Locations
- Backend code: `/home/recipes-app/recipes-app/backend`
- Frontend build: `/home/recipes-app/recipes-app/frontend/dist`
- Environment file: `/home/recipes-app/recipes-app/backend/.env`
- Uploads: `/home/recipes-app/recipes-app/backend/uploads`
- Logs: `sudo journalctl -u recipes-app-backend`
- Nginx config: `/etc/nginx/sites-available/recipes-app`
- Systemd service: `/etc/systemd/system/recipes-app-backend.service`

## Post-Deployment Checklist

- [ ] Backend service is running
- [ ] Frontend is accessible
- [ ] SSL certificates are installed and auto-renewing
- [ ] Database is accessible and backed up
- [ ] File uploads directory has correct permissions
- [ ] Firewall is configured
- [ ] Monitoring/health checks are set up
- [ ] Backup scripts are configured and tested
- [ ] Environment variables are secure
- [ ] Logs are being collected
- [ ] Performance is acceptable

## Support

For issues or questions:
1. Check application logs: `sudo journalctl -u recipes-app-backend -f`
2. Check Nginx logs: `sudo tail -f /var/log/nginx/error.log`
3. Verify service status: `sudo systemctl status recipes-app-backend`
4. Test database connectivity
5. Verify file permissions
