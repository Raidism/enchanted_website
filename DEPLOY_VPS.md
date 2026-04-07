# The Enchanted Summit — VPS Deployment

## 1) DNS Setup
Point your domain (`enchantedsummit.org`) to your VPS IP via your DNS provider (Cloudflare, Namecheap, etc.):
- `A` record: `@` → VPS public IP
- `A` record: `www` → VPS public IP

## 2) Server setup (Ubuntu)
```bash
sudo apt update && sudo apt upgrade -y
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs nginx
```

## 3) Clone project to VPS
```bash
mkdir -p /var/www/vps_files
cd /var/www/vps_files
git clone https://github.com/Raidism/enchanted_website.git
```

## 4) Install dependencies and run server
```bash
cd /var/www/vps_files/enchanted_website
npm install
npm start
```

The app serves both frontend and API on port `8080` by default.

## 5) Run with PM2 (recommended)
```bash
sudo npm install -g pm2
cd /var/www/vps_files/enchanted_website
pm2 start server/index.js --name enchanted_website
pm2 save
pm2 startup
```

## 6) Nginx reverse proxy
Create `/etc/nginx/sites-available/enchanted`:
```nginx
server {
    listen 80;
    server_name enchantedsummit.org www.enchantedsummit.org;

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
sudo ln -s /etc/nginx/sites-available/enchanted /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

## 7) HTTPS
Use Cloudflare SSL/TLS **Full (strict)** with an origin certificate, or use Certbot:
```bash
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d enchantedsummit.org -d www.enchantedsummit.org
```

## 8) Data persistence
Server-side data is stored in `server/data/`. Back up regularly.

## 9) Quick VPS update script
```bash
cd /var/www/vps_files/enchanted_website
chmod +x update-vps.sh
./update-vps.sh --restart
```

During updates, the script automatically:
- Turns maintenance mode on
- Writes live deployment progress to `server/data/deploy_status.json`
- Restarts PM2
- Turns maintenance off when complete

Defaults used by the script:
- `APP_DIR=/var/www/vps_files/enchanted_website`
- `REMOTE=origin`
- `BRANCH=main`
- `PM2_APP=enchanted_website`

Example overriding defaults:
```bash
APP_DIR=~/enchanted_website BRANCH=main PM2_APP=enchanted_website ./update-vps.sh --restart
```
