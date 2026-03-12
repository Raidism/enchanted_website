# Imperium MUN VPS Deployment (Namecheap + Cloudflare)

## 1) Move DNS to Cloudflare
1. Create a Cloudflare account and add your domain.
2. In Namecheap, change nameservers to the two Cloudflare nameservers shown in your Cloudflare dashboard.
3. Wait for Cloudflare to show the domain as active.

## 2) DNS records in Cloudflare
- Add `A` record:
  - Name: `@`
  - IPv4 address: your VPS public IP
  - Proxy status: Proxied (orange cloud)
- Add `A` record:
  - Name: `www`
  - IPv4 address: your VPS public IP
  - Proxy status: Proxied

## 3) Server setup (Ubuntu example)
```bash
sudo apt update && sudo apt upgrade -y
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs nginx
```

## 4) Upload project to VPS
- Copy this project to `/var/www/imperium_website`.

## 5) Install dependencies and run server
```bash
cd /var/www/imperium_website
npm install
npm start
```

The app serves both frontend and API on port `8080` by default.

## 6) Run with PM2 (recommended)
```bash
sudo npm install -g pm2
cd /var/www/imperium_website
pm2 start server/index.js --name imperium-web
pm2 save
pm2 startup
```

## 7) Nginx reverse proxy
Create `/etc/nginx/sites-available/imperium`:
```nginx
server {
    listen 80;
    server_name yourdomain.com www.yourdomain.com;

    location / {
        proxy_pass http://127.0.0.1:8080;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

Enable and reload:
```bash
sudo ln -s /etc/nginx/sites-available/imperium /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

## 8) HTTPS
In Cloudflare, set SSL/TLS mode to **Full (strict)** after installing an origin certificate on Nginx, or use Cloudflare Tunnel if preferred.

## 9) Data persistence
Server-side data is stored in:
- `server/data/users.json`
- `server/data/sessions.json`
- `server/data/site_settings.json`
- `server/data/waitlist_entries.json`
- `server/data/waitlist_deleted.json`
- `server/data/analytics_logs.json`
- `server/data/login_history.json`

Back up `server/data/` regularly.

## 10) Quick VPS update script
Use the included script to pull latest code from GitHub and reinstall dependencies:

```bash
cd /var/www/imperium_website
chmod +x update-vps.sh
./update-vps.sh
```

If you want it to restart PM2 automatically after update:

```bash
./update-vps.sh --restart
```

Defaults used by the script:
- `APP_DIR=/var/www/imperium_website`
- `REMOTE=origin`
- `BRANCH=main`
- `PM2_APP=imperium-web`

Example overriding defaults:

```bash
APP_DIR=~/imperium_website BRANCH=main PM2_APP=imperium-web ./update-vps.sh --restart
```
