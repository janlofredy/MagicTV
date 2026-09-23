# MagicTV 📺

> **Automated Movie Channels & IPTV Playout Server for Plex and Jellyfin**

[![Build & Publish Docker Image](https://github.com/janlofredy/MagicTV/actions/workflows/docker-publish.yml/badge.svg)](https://github.com/janlofredy/MagicTV/actions/workflows/docker-publish.yml)
[![Docker Image](https://img.shields.io/badge/Docker-ghcr.io%2Fjanlofredy%2Fmagictv-cyan?logo=docker)](https://github.com/janlofredy/MagicTV/pkgs/container/magictv)

Inspired by QuasiTV and NostalgiaTV, **MagicTV** is a self-hosted web app and IPTV server that creates custom, pseudo-live movie channels from your existing Plex and Jellyfin media libraries. It hosts those channels as standard **M3U playlists** and **XMLTV EPG feeds** for smart TVs and IPTV players (TiviMate, Apple TV, Kodi, VLC), while also providing a built-in **10-foot TV web player** with full D-pad remote control navigation and electronic program guide (EPG).

---

## ✨ Key Features

- **Plex & Jellyfin Integration**: Connect via standard API tokens to automatically sync movies, genres, runtimes, posters, and backdrops into a fast local SQLite cache.
- **Zero-Transcoding Smart Playout**: Calculates exact broadcast timeline progress and issues HTTP 302 redirects directly to Plex/Jellyfin stream endpoints with the calculated time offset (`startTime`/`offset`). Zero CPU transcoding overhead on your host!
- **Smart Channel Generator**:
  - Auto-generate channels matching custom rules (e.g. *80s Sci-Fi*, *90s Action*, *Christopher Nolan Cinema*, *Horror rating > 7.0*).
  - Playout modes: **Continuous Back-to-Back** or **Time-Slotted** (e.g., top-of-the-hour blocks).
  - Playout sequencing: Random shuffle, chronological, reverse chronological, or alphabetical.
- **Full IPTV Hosting**:
  - **M3U / M3U8 Playlist**: `http://<host>:8000/iptv/channels.m3u`
  - **XMLTV EPG Feed**: `http://<host>:8000/iptv/epg.xml` (up to 48h lookahead).
- **Built-in 10-Foot TV Experience**:
  - Full-screen TV UI with QuasiTV / Classic Cable TV aesthetic.
  - Interactive D-Pad / Arrow-Key Cable Guide overlay (press `G` or `Left Arrow`).
  - Channel surfing OSD info banner with live progress bar and next-up previews.
  - Direct channel number jumping (type `1`, `2`, `3`...).
- **Multi-Arch Docker Images**: Automated builds published to GitHub Container Registry (`ghcr.io`) supporting both `linux/amd64` (x86_64) and `linux/arm64` (Raspberry Pi, Apple Silicon, ARM NAS).

---

## 🏠 Install on CasaOS

Installing MagicTV on CasaOS takes less than 60 seconds.

### Method 1: 1-Click Import via Compose (Recommended)

1. Open your **CasaOS Dashboard** and click on **App Store**.
2. Click **Custom Install** in the top-right corner.
3. In the top-right of the install dialog, click the **Import** icon (`↓`).
4. Paste this raw URL into the input field:
   ```
   https://raw.githubusercontent.com/janlofredy/MagicTV/main/casaos-compose.yml
   ```
   *(Or copy and paste the contents of [`casaos-compose.yml`](https://github.com/janlofredy/MagicTV/blob/main/casaos-compose.yml) directly).*
5. Click **Submit**. CasaOS will automatically prefill the icon, title, port (8000), volume mappings, and environment variables.
6. Click **Install**. Once installed, click the **MagicTV** app tile on your dashboard to open it!

---

### Method 2: Manual Custom App Install in CasaOS

If you prefer filling the CasaOS custom app form manually:

1. In CasaOS, click **App Store** ➔ **Custom Install**.
2. Configure the fields as follows:
   - **Docker Image**: `ghcr.io/janlofredy/magictv:latest`
   - **App Name**: `MagicTV`
   - **Icon URL**: `https://raw.githubusercontent.com/janlofredy/MagicTV/main/client/public/logo.svg`
   - **Web UI**: Set port to `8000` (Protocol: `HTTP`)
   - **Network**: `Bridge`
   - **Ports**: Host `8000` ➔ Container `8000` (TCP)
   - **Volumes**:
     - Host Path: `/DATA/AppData/magictv`
     - Container Path: `/data`
   - **Environment Variables**:
     - `PORT`: `8000`
     - `DATABASE_URL`: `file:/data/magictv.db`
     - `BASE_URL`: `http://<your-casaos-ip>:8000`
3. Click **Install**.

---

## 🐳 Docker Deployment

### Using Docker Compose
Create a `docker-compose.yml`:

```yaml
version: '3.8'

services:
  magictv:
    image: ghcr.io/janlofredy/magictv:latest
    container_name: magictv
    restart: unless-stopped
    ports:
      - "8000:8000"
    environment:
      - PORT=8000
      - DATABASE_URL=file:/data/magictv.db
      - BASE_URL=http://localhost:8000
    volumes:
      - ./data:/data
```

Run:
```bash
docker compose up -d
```

### Using Docker CLI
```bash
docker run -d \
  --name magictv \
  -p 8000:8000 \
  -v $(pwd)/data:/data \
  -e PORT=8000 \
  -e DATABASE_URL="file:/data/magictv.db" \
  --restart unless-stopped \
  ghcr.io/janlofredy/magictv:latest
```

---

---

## 📺 Setting Up Live TV in Jellyfin & Plex

MagicTV generates standard IPTV M3U playlists and XMLTV EPG data feeds that integrate directly into Jellyfin and Plex, allowing you to watch your custom movie and TV series channels from any official Jellyfin or Plex client on Smart TVs, Apple TV, Android TV, Fire TV, and mobile devices.

### 🍇 Jellyfin Live TV Setup

1. Open your **Jellyfin Dashboard** as an administrator (`http://<jellyfin-ip>:8096`).
2. Go to **Dashboard** ➔ **Live TV** (under the *Server* category on the left sidebar).
3. **Add Tuner Device**:
   - Under **Tuner Devices**, click the **`+`** button.
   - Set **Tuner Type** to **`M3U Tuner`**.
   - Enter your MagicTV Tuner URL:
     ```text
     http://<magictv-ip>:8000/iptv/channels.m3u
     ```
   - *(Optional)* Set **Simultaneous streams** to your preference (e.g. `4` or `0` for unlimited).
   - Click **Save**.
4. **Add TV Guide Data (EPG)**:
   - Under **TV Guide Data Providers**, click the **`+`** button.
   - Choose **`XMLTV`**.
   - Enter your MagicTV XMLTV URL:
     ```text
     http://<magictv-ip>:8000/iptv/epg.xml
     ```
   - Click **Save**.
5. **Refresh the Guide**:
   - Go to **Dashboard** ➔ **Scheduled Tasks**.
   - Find **Refresh Guide** and click the **Play (▶)** button to immediately fetch all channel icons, program descriptions, and air times.
6. Open the Jellyfin home screen — you will now see **Live TV** with the full Channel Guide and scheduled programs ready to play!

---

### 🟠 Plex Live TV & DVR Setup

*(Note: Plex requires a Plex Pass subscription to enable Live TV & DVR functionality).*

1. Open the **Plex Web App** as an administrator (`http://<plex-ip>:32400/web`).
2. Go to **Settings** (wrench icon in the top right) ➔ **Live TV & DVR** (under the *Manage* section on the left sidebar).
3. Click **Set Up Plex DVR** (or **Add Device** if you already have tuners).
4. If Plex does not automatically detect MagicTV, click **Don't see your device? Enter its network address manually**.
5. Enter your MagicTV M3U URL:
   ```text
   http://<magictv-ip>:8000/iptv/channels.m3u
   ```
6. Click **Connect**. Plex will detect your channels and show the channel list. Click **Continue**.
7. In the **Electronic Program Guide (EPG)** step:
   - Select **Use XMLTV**.
   - In the XMLTV Guide field, enter your MagicTV EPG URL:
     ```text
     http://<magictv-ip>:8000/iptv/epg.xml
     ```
   - Enter a title for the guide (e.g. `MagicTV Guide`).
8. Click **Continue** to match the channels with the EPG feed, then click **Finish**.
9. Plex will download the guide data. You can now tune into your channels under **Live TV on Plex** across all Plex apps!

---

### 📱 Third-Party IPTV Players (TiviMate / IPTV Smarters / Kodi / Apple TV)

1. In your IPTV app, choose **Add Playlist (M3U)**.
2. Enter the Playlist URL:
   ```text
   http://<magictv-ip>:8000/iptv/channels.m3u
   ```
3. In the EPG / TV Guide settings, enter the XMLTV URL:
   ```text
   http://<magictv-ip>:8000/iptv/epg.xml
   ```
4. Set the EPG refresh interval to every 12 or 24 hours.

---

## 🎮 10-Foot TV Controls

When viewing the Web Player in 10-Foot Mode:

| Key | Action |
| --- | --- |
| **`▲` / `▼`** | Channel Surf Up / Down |
| **`G` / `◄`** | Open / Toggle Full-screen EPG Cable Guide |
| **`Enter`** | Tune in to focused channel |
| **`Esc` / `Backspace`** | Close Guide / Exit TV Mode |
| **`0` - `9`** | Direct Channel Number Input |
| **`M`** | Mute / Unmute Audio |
| **`R`** | Watch from Beginning (Restart current program) |
| **`[` / `]`** | Rewind 15s / Fast Forward 15s |
| **`Space`** | Play / Pause |
| **`L`** | Jump to Live Broadcast |
| **`F`** | Fullscreen Toggle |

---

## 🛠️ Development & Local Setup

### Prerequisites
- **Node.js**: v20 or later
- **npm**

### Installation
```bash
# Clone the repository
git clone https://github.com/janlofredy/MagicTV.git
cd MagicTV

# Install all dependencies
npm install

# Initialize local SQLite database schema
npm --workspace=server run db:push

# Start server & client concurrently in dev mode
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) in your browser.
