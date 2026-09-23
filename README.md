# MagicTV 📺

> **Automated Movie Channels & IPTV Playout Server for Plex and Jellyfin**

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
- **Docker-Ready**: Simple single-container deployment for Unraid, TrueNAS, Synology, Raspberry Pi, or Linux/macOS/Windows.

---

## 🚀 Quick Start (Development)

### Prerequisites
- **Node.js**: v20 or later
- **npm**

### Installation

1. Clone the repository and install dependencies:
```bash
npm install
```

2. Initialize SQLite Database schema with Prisma:
```bash
npm --workspace=server run db:push
```

3. Start both Backend & Frontend in development mode:
```bash
npm run dev
```

4. Open [http://localhost:5173](http://localhost:5173) in your browser:
   - **Dashboard**: Overview of channels, stats, and IPTV URLs.
   - **Launch 10ft TV**: Fullscreen TV guide and player.
   - **Media Servers**: Add your Plex or Jellyfin server URL and API token.

---

## 🐳 Docker Deployment

Run with `docker-compose`:

```bash
docker-compose up -d --build
```

Or run directly with Docker:

```bash
docker run -d \
  --name magictv \
  -p 8000:8000 \
  -v $(pwd)/data:/data \
  --restart unless-stopped \
  magictv:latest
```

---

## 📺 Configuring IPTV Apps & Smart TVs

### TiviMate / IPTV Smarters / OTT Navigator / Kodi
1. In your IPTV app, choose **Add Playlist (M3U)**.
2. Enter the Playlist URL:
   ```
   http://<your-server-ip>:8000/iptv/channels.m3u
   ```
3. In the EPG / TV Guide settings, enter the XMLTV URL:
   ```
   http://<your-server-ip>:8000/iptv/epg.xml
   ```
4. Update interval: Set to every 12 or 24 hours.

---

## 🎮 10-Foot TV Controls

When viewing the Web Player in 10-Foot Mode:
| Key | Action |
| --- | --- |
| **`▲` / `▼`** | Channel Surf Up / Down |
| **`G` / `◄`** | Open / Toggle EPG Cable Guide |
| **`Enter`** | Tune in to focused channel |
| **`Esc` / `Backspace`** | Close Guide / Exit TV Mode |
| **`0` - `9`** | Direct Channel Number Input |
| **`M`** | Mute / Unmute Audio |
| **`F`** | Fullscreen Toggle |
