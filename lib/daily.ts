/** A photo prompt for each day of the week: a reason to come back daily. */
const THEMES = [
  { title: "Sunday scaries", hint: "The pile of laundry, the unread syllabus, the 11pm dread." },
  { title: "Dining hall crimes", hint: "Whatever John Jay or Ferris did to that plate today." },
  { title: "Subway sightings", hint: "Something you saw between 116th and wherever you were going." },
  { title: "Dorm life", hint: "Your room, your floor, your roommate's choices." },
  { title: "Butler at 2am", hint: "Study spots, snack hauls, questionable posture." },
  { title: "Bodega finds", hint: "The cat, the chopped cheese, the oddly specific sign." },
  { title: "Weekend wander", hint: "The best or strangest thing you found exploring the city." },
];

/** Today's theme, based on the day of the week in New York. */
export function todaysTheme(now: Date = new Date()) {
  const weekday = new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    timeZone: "America/New_York",
  }).format(now);
  const index = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"].indexOf(
    weekday,
  );
  return { weekday, ...THEMES[index === -1 ? 0 : index] };
}
