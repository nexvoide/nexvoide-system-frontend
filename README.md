# Nexvoide Management System

A comprehensive project management and team collaboration platform built with React, Vite, and Supabase. Features real-time chat, project tracking, finance management, HR tools, and more.

## 🚀 Features

- **Dashboard**: Real-time KPIs, project overview, and team activity
- **Projects**: Full project lifecycle management with assignments, deadlines, and status tracking
- **Finance**: Multi-currency support (USD/PKR), profit calculations, and monthly payouts
- **HR Management**: Employee management, assignments, and finance tracking
- **Real-time Chat**: Team communication with channels, sections, and voice rooms
- **Activity Logs**: Comprehensive audit trail of all system activities
- **User Management**: Role-based access control with granular permissions
- **Monthly Archives**: Project archiving and historical data management
- **PWA Support**: Installable Progressive Web App for mobile and desktop

## 📋 Requirements

- Node.js 18+ 
- npm or yarn
- Supabase account (for backend)

## 🛠️ Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd "BETA v4"
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   - Create a `.env` file in the root directory
   - Add your Supabase credentials (see `docs/SUPABASE-SETUP-GUIDE.md`)

4. **Run the development server**
   ```bash
   npm run dev
   ```
   The app will be available at `http://localhost:3000`

## 📦 Build for Production

```bash
npm run build
npm run preview
```

## 📁 Project Structure

```
BETA v4/
├── database/              # SQL migrations and setup scripts
│   ├── migrations/
│   ├── scripts/
│   └── setup/
├── docs/                  # Documentation
│   ├── ADMIN-CREDENTIALS.md
│   ├── SUPABASE-SETUP-GUIDE.md
│   ├── PWA-SETUP.md
│   └── ...
├── public/                # Static assets and PWA files
│   ├── icon-*.png         # PWA icons
│   ├── logo.png
│   ├── manifest.json
│   └── sw.js              # Service worker
├── server/                # Backend server (optional)
├── src/
│   ├── components/        # Reusable UI components
│   │   ├── chat/          # Chat components
│   │   ├── MonthlyClosing/
│   │   └── ui/            # Base UI components
│   ├── hooks/             # Custom React hooks
│   ├── lib/               # Core libraries (Supabase, Socket)
│   ├── pages/             # Main app shell
│   ├── sections/          # Feature sections/pages
│   ├── stores/            # Zustand state management
│   ├── utils/             # Utility functions
│   └── widgets/           # Feature-specific widgets
├── index.html
├── package.json
├── vite.config.js
└── tailwind.config.js
```

## 🔧 Configuration

### Environment Variables

Create a `.env` file with:

```env
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key

# Optional: Custom latency test endpoint (for faster ping measurements)
# Use a lightweight endpoint close to your region (e.g., your own API health endpoint)
VITE_LATENCY_TEST_URL=https://your-fast-endpoint.com/health
```

**Latency Optimization**: The system automatically uses the fastest available endpoint for latency testing. It prioritizes:
1. Custom endpoint (if `VITE_LATENCY_TEST_URL` is set)
2. Your Supabase endpoint
3. Your backend server endpoint
4. Cloudflare CDN (fast globally, optimized for Pakistan/Asia)
5. Local resources

This ensures the fastest possible latency measurements, especially important for users in Pakistan and other regions.

### Supabase Setup

See `docs/SUPABASE-SETUP-GUIDE.md` for detailed database setup instructions.

## 📱 PWA Installation

The app is installable as a Progressive Web App. See `docs/PWA-SETUP.md` for installation instructions for different platforms.

## 🎨 Tech Stack

- **Frontend**: React 18, Vite
- **Styling**: Tailwind CSS
- **State Management**: Zustand
- **Backend**: Supabase (PostgreSQL, Realtime, Storage)
- **Real-time**: Socket.io, Supabase Realtime
- **UI Components**: Radix UI, Lucide Icons
- **Charts**: Recharts
- **Animations**: Framer Motion

## 📚 Documentation

- [Supabase Setup Guide](docs/SUPABASE-SETUP-GUIDE.md)
- [PWA Setup](docs/PWA-SETUP.md)
- [Admin Credentials](docs/ADMIN-CREDENTIALS.md)
- [Monthly Closing](docs/HOW-MONTHLY-CLOSING-WORKS.md)

## 🔐 Roles & Permissions

The system supports multiple roles with different permission levels:
- **Admin**: Full system access
- **Manager**: Project and team management
- **Employee**: Limited access to assigned projects

See `src/utils/permissions.js` for detailed permission configuration.

## 💬 Enabling Chat System (for engineers)

The chat/voice system is currently paused but can be turned back on when needed:

- **1. Re-enable the Chat UI**
  - In `src/pages/App.jsx`, replace the `tab === "chat"` block so it renders the full chat section:
    - Change the placeholder wrapper so that:  
      `tab === "chat" && <Chat />`
  - Ensure `Chat` is imported at the top:  
    `import Chat from "../sections/Chat.jsx";`

- **2. Supabase configuration for chat**
  - Verify Supabase environment variables in `.env` are set (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`).
  - Ensure the following tables exist and match what the code expects in `src/hooks/useEnhancedRealtimeChat.js` and `src/lib/supabase.js` (names only; use your existing migration setup):  
    - `channels` (for chat/voice channels)  
    - `messages` (for chat messages)

- **3. Optional: Voice server**
  - If you want voice rooms active, start the signaling server from the `server` folder:  
    `cd server && npm install && npm run start`

After these steps, reload the app; the **Chat (Beta)** nav item will open the live chat/voice experience instead of the paused placeholder.

## 🚀 Deployment

1. Build the project: `npm run build`
2. Deploy the `dist/` folder to your hosting provider
3. Ensure environment variables are set in production
4. Configure Supabase for production environment

## 📝 License

MIT

## 👥 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

## 🐛 Troubleshooting

- **Service Worker Issues**: Clear browser cache and reload
- **Supabase Connection**: Verify environment variables and Supabase project status
- **Build Errors**: Ensure all dependencies are installed (`npm install`)

For more help, check the documentation in the `docs/` folder.
