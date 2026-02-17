# HTTPS Setup for Guitar Assistant

This application now supports HTTPS for secure microphone access across your local network.

## How It Works

- **nginx** acts as a reverse proxy with SSL/TLS termination
- **HTTP (port 80)**: Automatically redirects to HTTPS
- **HTTPS (port 443)**: Secure connection with self-signed certificate
- **Next.js app**: Runs on internal port 3000, proxied by nginx

## Access the App

### From the host machine:
```
https://localhost
```

### From other devices on your network:
1. Find your machine's local IP address:
   ```bash
   # Linux/Mac
   ip addr show | grep "inet " | grep -v 127.0.0.1

   # Or
   hostname -I
   ```

2. Access from other devices:
   ```
   https://192.168.1.100  (replace with your IP)
   ```

## Browser Security Warning

Because we're using a **self-signed certificate**, your browser will show a security warning. This is normal for local development.

### To bypass the warning:

**Chrome/Brave:**
1. Click "Advanced"
2. Click "Proceed to localhost (unsafe)" or "Proceed to [your-ip] (unsafe)"

**Firefox:**
1. Click "Advanced"
2. Click "Accept the Risk and Continue"

**Safari:**
1. Click "Show Details"
2. Click "visit this website"

### Optional: Trust the certificate (removes warnings)

**Linux:**
```bash
sudo cp nginx/ssl/cert.pem /usr/local/share/ca-certificates/guitar-assistant.crt
sudo update-ca-certificates
```

**Mac:**
```bash
sudo security add-trusted-cert -d -r trustRoot -k /Library/Keychains/System.keychain nginx/ssl/cert.pem
```

**Windows:**
```powershell
certutil -addstore -f "ROOT" nginx\ssl\cert.pem
```

Then restart your browser.

## Regenerate Certificate

If you need to regenerate the SSL certificate (e.g., expired after 365 days):

```bash
openssl req -x509 -newkey rsa:4096 -keyout nginx/ssl/key.pem -out nginx/ssl/cert.pem -days 365 -nodes -subj "/C=US/ST=Local/L=Local/O=GuitarAssistant/CN=guitar-assistant.local"
docker-compose restart nginx
```

## Microphone Access

With HTTPS enabled, you can now use the **Auto Volume Matching** feature from any device on your network:

1. Access the app via HTTPS
2. Click the "Auto Vol" button in the bottom player
3. Grant microphone permission when prompted
4. Play your guitar and the lesson volume will automatically adjust!

## Troubleshooting

**Port already in use:**
```bash
# Check what's using port 443
sudo lsof -i :443

# Kill the process or change nginx ports in docker-compose.yml
```

**Certificate errors persist:**
- Clear browser cache and cookies for the site
- Restart browser after trusting certificate
- Try incognito/private mode to test

**Can't connect from other devices:**
- Check firewall allows ports 80 and 443
- Verify devices are on the same network
- Try accessing via IP address instead of hostname
