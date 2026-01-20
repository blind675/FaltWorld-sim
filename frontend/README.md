# FlatWorld Simulation - Frontend

Next.js frontend for the FlatWorld terrain simulation.

## Setup

1. Install dependencies:
```bash
npm install
```

2. Configure environment:
```bash
cp .env.local.example .env.local
```

Edit `.env.local` to set your backend API URL:
```
NEXT_PUBLIC_API_URL=http://localhost:5001
```

3. Run development server:
```bash
npm run dev
```

The frontend will be available at `http://localhost:3000`.

## Building for Production

```bash
npm run build
npm start
```

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `NEXT_PUBLIC_API_URL` | Backend API URL | `http://localhost:5001` |

## Project Structure

```
frontend/
├── src/
│   ├── app/           # Next.js App Router
│   │   ├── layout.tsx # Root layout
│   │   ├── page.tsx   # Main page
│   │   └── globals.css
│   ├── components/    # React components
│   │   ├── ui/        # shadcn/ui components
│   │   ├── canvas/    # Terrain canvas rendering
│   │   ├── Home.tsx   # Main home component
│   │   └── ...
│   ├── hooks/         # Custom React hooks
│   ├── lib/           # Utilities and API client
│   └── shared/        # Shared types (schema)
├── package.json
├── tailwind.config.ts
└── tsconfig.json
```

## Deployment

This frontend is designed to be deployed separately from the backend. Popular options:

- **Vercel** - Native Next.js support
- **Netlify** - With Next.js adapter
- **Docker** - Using the standalone output

Remember to set `NEXT_PUBLIC_API_URL` to your production backend URL when deploying.
