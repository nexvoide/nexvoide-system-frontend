# Nexvoide Voice Channel Signaling Server

Production-ready Socket.io server for WebRTC signaling in voice channels.

## Architecture

This server handles **all WebRTC signaling** (offer/answer/ICE exchange) via Socket.io, providing sub-50ms event delivery. Supabase is used only for persistence and channel metadata, **not for signaling**.

### Key Features

- ✅ Fast signaling via Socket.io (sub-50ms delivery)
- ✅ Server-authoritative room state
- ✅ JWT authentication
- ✅ Room capacity management
- ✅ Multi-instance support (Redis optional)
- ✅ Automatic cleanup of stale connections
- ✅ Health check and metrics endpoints
- ✅ **Automatic storage cleanup** - Deletes expired attachments (3 days old)

## Setup

### 1. Install Dependencies

```bash
cd server
npm install
```

### 2. Configure Environment

Copy `.env.example` to `.env` and configure:

```bash
cp .env.example .env
```

**📖 Detailed setup instructions: See `SETUP-GUIDE.md` for step-by-step help**

**Quick setup:**

1. **Copy the file:**
   ```bash
   cp .env.example .env
   ```

2. **Open `.env` in your editor** and fill in these required values:

   - **`PORT`**: Server port (default: `3001` - you can keep this)
   
   - **`CLIENT_URL`**: Your frontend URL
     - For local dev: `http://localhost:5173` (or whatever port Vite uses)
     - For production: `https://yourdomain.com`
   
   - **`JWT_SECRET`**: ⚠️ **REQUIRED** - Get this from Supabase:
     1. Go to Supabase Dashboard → Your Project
     2. Settings → API
     3. Copy the **"JWT Secret"** value
     4. Paste it in `.env` as: `JWT_SECRET=your-copied-secret-here`

3. **Optional variables** (can skip for now):
   - `REDIS_URL`: Only if using multi-instance scaling
   - `TURN_SERVER_URL`: Only if users have NAT/firewall issues
   - `SUPABASE_URL`: Only if server needs to fetch channel metadata
   - `SUPABASE_SERVICE_KEY` or `SUPABASE_SERVICE_ROLE_KEY`: **Required for storage cleanup** - Get from Supabase Dashboard > Settings > API > Service Role Key

**Example `.env` file:**
```env
PORT=3001
CLIENT_URL=http://localhost:5173
JWT_SECRET=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...your-actual-secret
```

### 3. Generate JWT Secret

```bash
# Generate a secure random secret
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Add this to both server `.env` and frontend `.env` (as `VITE_JWT_SECRET` if needed, or use Supabase JWT).

## Running

### Development

```bash
npm run dev
```

### Production

```bash
npm start
```

### With PM2

```bash
pm2 start src/index.js --name voice-server
pm2 save
pm2 startup
```

## API Endpoints

### Health Check

```bash
GET /health
```

Response:
```json
{
  "status": "ok",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "uptime": 3600,
  "rooms": 5,
  "totalConnections": 12
}
```

### Metrics

```bash
GET /metrics
```

Response:
```json
{
  "rooms": 5,
  "totalConnections": 12,
  "totalParticipants": 15
}
```

### Storage Cleanup

**Automatic**: Runs daily at 2:00 AM to delete expired attachments (older than 3 days)

**Manual Trigger**:
```bash
POST /api/cleanup-storage
```

Response:
```json
{
  "success": true,
  "deleted": 5,
  "files": ["file1.pdf", "file2.jpg"],
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

**📖 For detailed setup instructions, see `STORAGE_CLEANUP_SETUP.md`**

## Socket.io Events

### Client → Server

- `authenticate` - Authenticate socket connection
- `joinVoiceChannel` - Join a voice channel
- `leaveVoiceChannel` - Leave a voice channel
- `signalOffer` - Send WebRTC offer
- `signalAnswer` - Send WebRTC answer
- `signalIceCandidate` - Send ICE candidate
- `toggleMute` - Toggle mute state
- `toggleDeafen` - Toggle deafen state
- `screenShareStart` - Start screen sharing
- `screenShareStop` - Stop screen sharing
- `userSpeaking` - Speaking indicator (rate-limited)
- `heartbeat` - Keepalive for presence

### Server → Client

- `authenticated` - Authentication successful
- `roomState` - Authoritative room state snapshot
- `userJoined` - User joined the room
- `userLeft` - User left the room
- `offer` - WebRTC offer received
- `answer` - WebRTC answer received
- `iceCandidate` - ICE candidate received
- `muteUpdate` - Mute state changed
- `deafenUpdate` - Deafen state changed
- `screenShareStarted` - Screen share started
- `screenShareStopped` - Screen share stopped
- `speakingUpdate` - Speaking state changed
- `error` - Error occurred

## Authentication

The server expects JWT tokens from your Supabase session. The token should be sent in the `authenticate` event:

```javascript
socket.emit('authenticate', { token: supabaseSession.access_token });
```

The server verifies the token using `JWT_SECRET`. Make sure this matches your Supabase JWT secret.

## Multi-Instance Deployment

For horizontal scaling, use Redis:

1. Set `REDIS_URL` in `.env`
2. The server will automatically use Redis pub/sub for cross-instance communication
3. Room state is still in-memory per instance, but events are broadcasted

## Docker Deployment

### Dockerfile

```dockerfile
FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY . .

EXPOSE 3001

CMD ["node", "src/index.js"]
```

### docker-compose.yml

```yaml
version: '3.8'

services:
  voice-server:
    build: .
    ports:
      - "3001:3001"
    environment:
      - PORT=3001
      - CLIENT_URL=https://app.nexvoide.com
      - JWT_SECRET=${JWT_SECRET}
      - REDIS_URL=redis://redis:6379
    depends_on:
      - redis

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
```

## Monitoring

### Logs

The server logs important events:
- `🔌` Socket connections/disconnections
- `✅` Successful operations
- `❌` Errors
- `📥` Incoming events
- `📤` Outgoing events

### Metrics

Monitor via `/metrics` endpoint or integrate with:
- Prometheus
- Grafana
- CloudWatch
- Datadog

## Troubleshooting

### Connection Issues

1. **CORS errors**: Check `CLIENT_URL` matches your frontend URL
2. **Authentication fails**: Verify `JWT_SECRET` matches Supabase
3. **Socket not connecting**: Check firewall/network rules

### Performance Issues

1. **High latency**: Check network, consider TURN server
2. **Memory leaks**: Ensure proper cleanup on disconnect
3. **High CPU**: Consider Redis for multi-instance

### Common Errors

- `ROOM_FULL`: Room has reached capacity
- `NOT_AUTHENTICATED`: JWT token invalid or expired
- `JOIN_ERROR`: Server error joining room

## Security

- ✅ JWT authentication required
- ✅ CORS protection
- ✅ Rate limiting (consider adding)
- ✅ Input validation
- ⚠️ Add rate limiting for production
- ⚠️ Add DDoS protection (Cloudflare, etc.)

## License

MIT

