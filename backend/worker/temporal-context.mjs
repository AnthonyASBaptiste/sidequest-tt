/**
 * Temporal and Cultural Awareness Engine for SideQuest T&T.
 * Maps dates to Trinidad & Tobago's cultural calendar, seasonal events,
 * and day-of-week rhythms to inspire seasonally grounded quests.
 */

export function getTemporalContext(poolDateString, region = 'Trinidad') {
  const [yearStr, monthStr, dayStr] = poolDateString.split('-');
  const year = Number.parseInt(yearStr, 10);
  const month = Number.parseInt(monthStr, 10); // 1-12
  const day = Number.parseInt(dayStr, 10); // 1-31

  // Use noon UTC to avoid timezone shift on day of week
  const date = new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
  const dayOfWeekIndex = date.getUTCDay(); // 0 = Sunday, 6 = Saturday
  const daysOfWeek = [
    'Sunday',
    'Monday',
    'Tuesday',
    'Wednesday',
    'Thursday',
    'Friday',
    'Saturday',
  ];
  const dayOfWeek = daysOfWeek[dayOfWeekIndex];

  let seasonName = 'Standard Exploration Season';
  let seasonThemes = 'Local community parks, street food stalls, public savannahs, and neighborhood trails.';
  let searchKeywords = [`events ${region} this week`, `festivals things to do ${region}`];
  let seasonalMandate = 'Create engaging real-world quests connecting players with their surroundings.';

  // 1. Christmas & Parang Season (November 1 - January 6)
  if (month === 12 || (month === 11 && day >= 1) || (month === 1 && day <= 6)) {
    seasonName = 'Christmas & Parang Season';
    seasonThemes =
      'Christmas villages, festive light displays (Queen\'s Park Savannah, Arima, Scarborough), parang music, pastelles, sorrel, ponche de crème, and illuminated public squares.';
    searchKeywords = [
      `Christmas village lights ${region}`,
      `Christmas events ${region} 2026`,
      `Parang festival ${region}`,
      `holiday craft market ${region}`,
    ];
    seasonalMandate =
      'At least one quest must celebrate the Christmas & Parang season (e.g. visiting a holiday light display or Christmas village, taking a picture with festive decorations or a holiday display, or tasting seasonal pastelles or sorrel).';
  }
  // 2. Carnival Season (January 7 - early March / Ash Wednesday window)
  else if (month === 2 || (month === 1 && day >= 7) || (month === 3 && day <= 7)) {
    seasonName = 'Carnival Season';
    seasonThemes =
      'Steelband panyard rehearsals, calypso tents (Kaiso House, Calypso Revue), soca showcases, mas camp costume viewings, and vibrant street murals.';
    searchKeywords = [
      `Calypso tent schedule ${region}`,
      `panyard rehearsals open to public ${region}`,
      `Carnival events ${region}`,
      `mas camp open days ${region}`,
    ];
    seasonalMandate =
      'At least one quest must immerse the player in the energy of Carnival season (e.g. stopping by a steelband panyard during rehearsal, visiting a calypso tent or theatre, or taking a picture with a mas camp display or Carnival mural).';
  }
  // 3. Easter & Kite Flying Season (March 15 - April 30)
  else if (month === 4 || (month === 3 && day >= 15)) {
    seasonName = 'Easter & Kite Flying Season';
    seasonThemes =
      'Kite flying in open savannahs, Easter weekend beach limes, hot cross buns from local bakeries, and recreational sports.';
    searchKeywords = [
      `Easter events ${region}`,
      `kite flying savannah ${region}`,
      `Easter weekend markets ${region}`,
    ];
    seasonalMandate =
      'At least one quest must highlight the Easter and kite-flying season (e.g. spotting or flying a kite on an open savannah, feeling the coastal breeze, or picking up freshly baked hot cross buns from a local bakery).';
  }
  // 4. Summer Vacation & Tobago Heritage Season (July 1 - August 24)
  else if (month === 7 || (month === 8 && day <= 24)) {
    seasonName =
      region === 'Tobago'
        ? 'Tobago Heritage Festival Season'
        : 'Summer Vacation & Mid-Year Lime Season';
    seasonThemes =
      region === 'Tobago'
        ? 'Tobago Heritage Festival (Ole Time Wedding, Salaka Feast), beach limes (Pigeon Point, Castara), coastal trails, and folk heritage.'
        : 'Waterfall hikes, beach excursions along the North Coast, outdoor sporting events, and summer street food limes.';
    searchKeywords =
      region === 'Tobago'
        ? ['Tobago Heritage Festival schedule', 'Tobago outdoor cultural events']
        : [`outdoor summer festivals ${region}`, `beach limes north coast ${region}`];
    seasonalMandate =
      region === 'Tobago'
        ? 'At least one quest must celebrate Tobago’s heritage and coastal beauty (e.g. visiting a heritage village site, experiencing a coastal vista at Pigeon Point or Castara, or enjoying local seafood).'
        : 'At least one quest must capture the summer vacation spirit (e.g. heading out toward a northern coastal beach, taking a nature stroll to a river or overlook, or enjoying an outdoor fruit stall).';
  }
  // 5. Independence & Republic Season (August 25 - September 30)
  else if ((month === 8 && day >= 25) || month === 9) {
    seasonName = 'National Pride & Republic Season';
    seasonThemes =
      'Red, white, and black patriotic displays, Independence parade memories, national monuments, historic forts, and civic squares.';
    searchKeywords = [
      `Independence Day events ${region}`,
      `Republic Day celebrations ${region}`,
      `cultural shows ${region}`,
    ];
    seasonalMandate =
      'At least one quest must highlight national pride or heritage (e.g. spotting national colors in a town square, visiting a historic monument or fort, or observing historic architecture).';
  }
  // 6. Divali & Heritage Season (October 1 - November 15)
  else if (month === 10 || (month === 11 && day <= 15)) {
    seasonName = 'Divali & Heritage Season';
    seasonThemes =
      'Divali Nagar in Chaguanas, deya lighting, decorated bamboo arches, Indian sweets (kurma, sawine, jalebi), and community cultural gatherings.';
    searchKeywords = [
      `Divali Nagar schedule ${region}`,
      `Divali events celebrations ${region}`,
      `deya lighting festival ${region}`,
    ];
    seasonalMandate =
      'At least one quest must reflect Divali celebrations and cultural heritage (e.g. visiting a community deya display, admiring decorative bamboo arches, or savoring fresh traditional sweets or roti).';
  }

  // Day-of-week rhythm
  let dayRhythm = 'Weekday exploration: fit comfortably before or after work/school hours.';
  if (dayOfWeek === 'Saturday') {
    dayRhythm =
      'Saturday morning vibe: busy farmers\' markets (Macoya, Chaguanas, Scarborough), fresh coconut water on the savannah, and active public recreation grounds.';
  } else if (dayOfWeek === 'Sunday') {
    dayRhythm =
      'Sunday family rhythm: unhurried beach limes, morning nature strolls, quiet coastal pauses, and relaxed afternoon bakeries.';
  } else if (dayOfWeek === 'Friday') {
    dayRhythm =
      'Friday evening wind-down: street food pop-ups (doubles, corn soup, geera), panyard gatherings, and lively town center strolls.';
  }

  return {
    poolDate: poolDateString,
    region,
    dayOfWeek,
    seasonName,
    seasonThemes,
    searchKeywords,
    seasonalMandate,
    dayRhythm,
  };
}
