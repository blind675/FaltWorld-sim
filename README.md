# World Simulator #

This is a project intended to simultate a world with all the masic systems in it. 

Project state 

- Implemented: 	
	- wrapping world grid
  	- Perlin noise land generation
	- random springs generation 
 	- water flow
	- water accumulation and land erosion
	- land moisture 

Bugs:
The river water flow is not correct:
   TODO: change from water points of rivers to use arrays instead, use an array of arrays where each array is a river and each river is an array of cells.

- Next steps:
  - Implement time: 
    - TODO: we have the concept of tick, the server updates every x time (5 min is the default, but this changes for debug purposes). We need to implement a time system with years, months, days, hours, and minutes. We can have it such that each system update (tick) is an hour in game time. We should also create a yearly season system that determines the day(light) / night(dark) cycle; in other words, the length of the day should be determined by the month/season. We could use the array : 
[
  { "month": "January", "month_number": 1, "daylight_hours": 8 },
  { "month": "February", "month_number": 2, "daylight_hours": 9 },
  { "month": "March", "month_number": 3, "daylight_hours": 12 },
  { "month": "April", "month_number": 4, "daylight_hours": 13 },
  { "month": "May", "month_number": 5, "daylight_hours": 15 },
  { "month": "June", "month_number": 6, "daylight_hours": 16 },
  { "month": "July", "month_number": 7, "daylight_hours": 15 },
  { "month": "August", "month_number": 8, "daylight_hours": 14 },
  { "month": "September", "month_number": 9, "daylight_hours": 12 },
  { "month": "October", "month_number": 10, "daylight_hours": 10 },
  { "month": "November", "month_number": 11, "daylight_hours": 9 },
  { "month": "December", "month_number": 12, "daylight_hours": 8 }
]

Maybe we could name this array months info or similar.

This can be implemented in the server as an updated data structure with all the time values and whether it's night or day(light)

    - TODO: We should also send this data from the server to the client and display it somewhere. Maybe showing something like a clock for the current time that animates from one hour to the next one (the minute hands), and the animation takes as long as the backend update takes. We also need to send this information to the client.

   - // TODO: add erosion
   -  // TODO: add grass - and grass mechanics 
   -  // TODO: add trees - and tree mechanisms
   -  // TODO: add fruits - and fruit mechanisms
   -  // TODO: add temperature
   -  // TODO: add wind
   -  // TODO: add rain
   -  // TODO: add snow
   -  // TODO: add ice

   -  // TODO: add rabbits
   -  // TODO: add foxes
   -  // TODO: add wolves
   -  // TODO: add bears
   -  // TODO: add humans
