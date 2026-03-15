# BeatConnect

A real-time social media platform for music producers to share their beats, connect with others, and collaborate.

## Features

- **Audio Posts**: Share beats, tracks, and music snippets with waveform visualization
- **Real-time Feed**: See new posts, likes, and comments in real-time via WebSockets
- **Direct Messaging**: Real-time text chat with typing indicators
- **Voice Rooms**: Create or join voice chat rooms for live collaboration
- **Friend System**: Send friend requests and build your producer network
- **User Discovery**: Find producers by genre and connect with like-minded artists
- **Notifications**: Real-time notifications for all interactions

## Tech Stack

### Backend
- **Runtime**: Node.js with TypeScript
- **Framework**: Express.js
- **Database**: PostgreSQL
- **Real-time**: Socket.IO
- **Authentication**: JWT

### Frontend
- **Framework**: React 18 with TypeScript
- **Styling**: Tailwind CSS with shadcn/ui components
- **State Management**: Zustand
- **Real-time**: Socket.IO Client
- **Build Tool**: Vite

### Infrastructure
- **Containerization**: Docker & Docker Compose
- **Database**: PostgreSQL 15

## Getting Started

### Prerequisites

- Docker and Docker Compose installed
- Node.js 20+ (for local development)

### Quick Start with Docker

1. Clone the repository:
```bash
git clone <repository-url>
cd beatconnect
```

2. Start all services:
```bash
docker-compose up -d
```

3. Access the application:
   - Frontend: http://localhost:5173
   - Backend API: http://localhost:3001
   - Database: localhost:5432

### Local Development

#### Backend

```bash
cd backend
npm install
npm run dev
```

#### Frontend

```bash
cd frontend
npm install
npm run dev
```

## Project Structure

```
beatconnect/
├── backend/
│   ├── src/
│   │   ├── controllers/     # Request handlers
│   │   ├── database/        # Database connection & migrations
│   │   ├── middleware/      # Auth & other middleware
│   │   ├── routes/          # API routes
│   │   ├── types/           # TypeScript types
│   │   ├── websocket/       # Socket.IO handlers
│   │   └── index.ts         # Entry point
│   ├── uploads/             # Uploaded files
│   ├── Dockerfile
│   ├── package.json
│   └── tsconfig.json
├── frontend/
│   ├── src/
│   │   ├── components/      # React components
│   │   ├── hooks/           # Custom hooks
│   │   ├── lib/             # Utilities & API client
│   │   ├── pages/           # Page components
│   │   ├── stores/          # Zustand stores
│   │   ├── types/           # TypeScript types
│   │   ├── App.tsx          # Main app component
│   │   └── main.tsx         # Entry point
│   ├── Dockerfile
│   ├── package.json
│   └── vite.config.ts
├── docker-compose.yml
└── README.md
```

## API Endpoints

### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login
- `GET /api/auth/me` - Get current user
- `POST /api/auth/logout` - Logout

### Users
- `GET /api/users/:userId` - Get user profile
- `PUT /api/users/profile` - Update profile
- `GET /api/users/search` - Search users
- `POST /api/users/:userId/follow` - Follow user
- `DELETE /api/users/:userId/follow` - Unfollow user

### Posts
- `POST /api/posts` - Create post
- `GET /api/posts/feed` - Get feed
- `GET /api/posts/:postId` - Get single post
- `DELETE /api/posts/:postId` - Delete post
- `POST /api/posts/:postId/like` - Like post
- `DELETE /api/posts/:postId/like` - Unlike post
- `POST /api/posts/:postId/share` - Share post
- `GET /api/posts/:postId/comments` - Get comments
- `POST /api/posts/:postId/comments` - Add comment

### Chat
- `GET /api/conversations` - Get conversations
- `POST /api/conversations` - Create/get conversation
- `GET /api/conversations/:id/messages` - Get messages
- `POST /api/conversations/:id/messages` - Send message

### Voice Rooms
- `GET /api/voice-rooms` - Get all rooms
- `POST /api/voice-rooms` - Create room
- `POST /api/voice-rooms/:id/join` - Join room
- `POST /api/voice-rooms/:id/leave` - Leave room

## WebSocket Events

### Post Events
- `post:created` - New post created
- `post:liked` - Post liked
- `post:unliked` - Post unliked
- `post:commented` - Comment added
- `post:shared` - Post shared

### Chat Events
- `message:new` - New message
- `typing:start` - User started typing
- `typing:stop` - User stopped typing

### Voice Events
- `voice:joined` - User joined room
- `voice:left` - User left room
- `voice:muted` - User muted/unmuted
- `voice:speaking` - User speaking indicator

### Presence Events
- `user:online` - User came online
- `user:offline` - User went offline

## Color Palette (Music Theme)

- **Beat Purple**: #8B5CF6 (Primary)
- **Beat Pink**: #EC4899 (Accent)
- **Beat Blue**: #3B82F6
- **Beat Cyan**: #06B6D4
- **Beat Orange**: #F97316
- **Vinyl Dark**: #0A0A0B (Background)
- **Vinyl Gray**: #1A1A1D

## License

MIT
