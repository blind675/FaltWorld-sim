# World Simulator

## Overview

World Simulator is a web-based procedural world generation and simulation system. The application generates terrain using Perlin noise, simulates natural phenomena like water flow and erosion, and provides an interactive visualization of the generated world. Built with a React frontend and Express backend, it features real-time terrain updates and a comprehensive visualization system with multiple display modes.

The system is designed to simulate a living world with environmental systems including terrain generation, hydrology (springs, rivers, water accumulation), land erosion, moisture distribution, comprehensive time system with seasonal day/night cycles, and realistic temperature simulation. An interactive animated game clock displays the current in-game time with smooth minute hand animation. The world features 4 alternating temperature zones (cold-warm-cold-warm) that wrap seamlessly on the circular map, simulating a globe with multiple climate regions. Future plans include vegetation systems, weather patterns, and player-controllable entities.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture

**Technology Stack:**
- React 18 with TypeScript for the UI layer
- Vite as the build tool and development server
- TanStack Query (React Query) for server state management
- Wouter for client-side routing
- Tailwind CSS with shadcn/ui component library for styling

**Design Decisions:**
- **Component-based visualization**: Custom TerrainCanvas component handles all world rendering with configurable visualization settings (elevation maps, moisture maps, river overlays, contour lines)
- **Real-time updates**: Polling mechanism refreshes terrain data from the server at configurable intervals to show world evolution
- **Interactive controls**: Comprehensive settings panel allows users to toggle various visualization modes, adjust display parameters, and inspect individual cells
- **Game clock component**: GameClock displays current in-game time with animated analog clock hands, date/time information, daylight hours, and day/night status indicator
- **Responsive design**: Mobile-first approach using Tailwind's responsive utilities and shadcn/ui components

### Backend Architecture

**Technology Stack:**
- Node.js with Express for the HTTP server
- TypeScript for type safety
- Drizzle ORM for database interactions
- PostgreSQL (Neon serverless) as the data store

**Design Decisions:**
- **In-memory world state**: Primary terrain data stored in memory for performance during simulation updates
- **Periodic simulation updates**: Server-side interval (500ms for debug, 300000ms/5 minutes default) drives world evolution through water flow, erosion, and moisture calculations
- **Time system**: Each server tick represents 1 hour of in-game time, tracking years, months (30 days each), days, hours, and minutes
- **Seasonal day/night cycles**: Day/night status determined by month-specific daylight hours (8 hours in winter months, 16 hours in peak summer), with day starting at 6 AM
- **Stateless API**: RESTful endpoints for terrain data retrieval, regeneration, and time data access
- **Procedural generation**: Perlin noise implementation generates realistic terrain heightmaps
- **Simulation systems**: Modular approach to world mechanics (water flow, erosion, moisture distribution) allows independent development of each system

**Key Algorithms:**
- Perlin noise for terrain generation with configurable parameters
- Water source placement and flow simulation using gravity-based pathfinding
- Land erosion based on water flow intensity
- Moisture distribution from water sources with distance-based falloff
- Time progression with automatic hour->day->month->year overflow handling
- Seasonal daylight calculation based on month-specific daylight hours (January/December: 8 hours, June: 16 hours)
- **Temperature system with 4 alternating zones**: Uses sin(2θ) function to create warm-cold-warm-cold pattern on circular map
  - Warm zones: 25°C base temperature
  - Cold zones (poles): -8°C base temperature
  - Altitude lapse rate: -6°C per 1000m (higher elevations are colder)
  - Seasonal variation: 2-12°C amplitude depending on zone proximity
  - Seamless wrapping: Warm zone at bottom of map connects to warm zone at top for globe simulation

### Data Storage

**Database Schema:**
- `terrain_cells` table stores persistent world state with fields for position (x, y), altitude, water levels, moisture, and terrain type
- Uses Drizzle ORM with PostgreSQL dialect
- Database serves as backup/persistence layer while active simulation runs in memory

**Schema Design Rationale:**
- Normalized cell-based storage allows efficient queries by position
- Separation of terrain_height and water_height enables distinct simulation of land and water
- Multiple moisture fields (base_moisture, added_moisture, moisture) support complex moisture mechanics
- Type field enables future terrain classification (grass, desert, etc.)

### External Dependencies

**Third-party Services:**
- **Neon Database**: Serverless PostgreSQL for terrain persistence
- **Replit**: Development and deployment platform with integrated tooling

**Key Libraries:**
- **@radix-ui components**: Accessible UI primitives (dialogs, dropdowns, tabs, etc.)
- **Drizzle ORM**: Type-safe database queries and migrations
- **TanStack Query**: Server state management with caching
- **Tailwind CSS**: Utility-first styling framework
- **shadcn/ui**: Pre-built component library built on Radix UI

**Integration Points:**
- Database connection via `DATABASE_URL` environment variable
- Vite dev server integrates with Express in development mode
- Static file serving for production builds
- Session management using connect-pg-simple with PostgreSQL store