# World Simulator

A web-based procedural world generation and simulation system with dynamic water flow, terrain evolution, and an interactive game clock with seasonal day/night cycles.

## Project Status

### Implemented Features
- **Terrain Generation**: Wrapping world grid with Perlin noise-based height generation
- **Hydrology System**: 
  - Random springs generation
  - Water flow simulation with river tracking
  - Water accumulation and land erosion
  - River merging when streams meet
  - Named river system with unique river tracking
- **Moisture System**: 
  - Moisture propagation from water sources
  - Altitude-based moisture modifiers
  - Evaporation and diminishing returns mechanics
- **Time System**: 
  - Complete time tracking with years, months (30 days each), days, hours, and minutes
  - Each server tick = 1 hour of in-game time
  - Seasonal day/night cycles with month-specific daylight hours (8-16 hours)
  - Day starts at 6 AM and lasts for the month's daylight hours
- **Game Clock**: 
  - Interactive animated analog clock with hour and minute hands
  - Smooth minute hand animation synchronized with server ticks
  - Digital time display showing hour:minute format
  - Date display with month name, day, and year
  - Day/night indicator with sun/moon icons and status badge
  - Daylight hours information

### Known Issues
- River visualization could be enhanced with better stream tracking

### Next Steps
- Add erosion effects beyond water-based erosion
- Add grass with growth mechanics
- Add trees with growth and fruit production
- Add temperature and climate systems
- Add weather (rain, snow, wind effects)
- Add wildlife (rabbits, foxes, wolves, bears, birds)
- Add player-controllable entities
- Add ice and seasonal precipitation systems
