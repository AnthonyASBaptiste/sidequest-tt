/**
 * Temporal and Cultural Awareness Engine for SideQuest T&T.
 * Maps dates to island-specific cultural calendars, seasonal festivals,
 * and day-of-week rhythms to automatically detect the active season without manual prompting.
 *
 * Supported Islands: Trinidad, Tobago (Extensible to any Caribbean territory)
 */

/**
 * @typedef {Object} SeasonRule
 * @property {string} name
 * @property {(month: number, day: number) => boolean} match
 * @property {string} themes
 * @property {string[]} searchKeywords
 * @property {string} seasonalMandate
 */

/**
 * @typedef {Object} IslandCalendarProfile
 * @property {string} defaultSeasonName
 * @property {string} defaultThemes
 * @property {string} defaultSeasonalMandate
 * @property {SeasonRule[]} seasons
 * @property {Record<string, string>} dayRhythms
 * @property {string} culinaryAnchors
 * @property {string} geographicalAnchors
 */

/** @type {Record<string, IslandCalendarProfile>} */
export const REGION_CALENDARS = {
  Tobago: {
    defaultSeasonName: 'Coastal Island Exploration Season',
    defaultThemes:
      'Pigeon Point, Store Bay, Buccoo Reef, coastal fishing villages (Castara, Charlotteville), Fort King George, and Main Ridge Forest Reserve.',
    defaultSeasonalMandate:
      'Create engaging real-world quests celebrating Tobago’s pristine coastline, historical forts, and village life.',
    culinaryAnchors:
      'Curried crab and dumpling (Store Bay), bene balls, coconut tart, stewed fish, provision, and fresh souse.',
    geographicalAnchors:
      'Pigeon Point Heritage Park, Store Bay, Buccoo Point, Nylon Pool lookouts, Scarborough Esplanade, Fort King George, Castara Bay, Speyside, and Charlotteville.',
    dayRhythms: {
      Saturday:
        'Saturday market vibe: fresh local produce and fish at Scarborough Market, morning ocean dips at Store Bay, and bustling village bakeries.',
      Sunday:
        'Sunday coastal calm: relaxed beach limes at Pigeon Point or Castara, quiet scenic pauses at Fort King George, and Sunday village lunches.',
      Friday:
        'Friday evening lime: seaside street food, souse, local music in Crown Point and Buccoo, and harbor breeze strolls.',
      default:
        'Weekday coastal rhythm: peaceful village paths, daytime beach walks, and unhurried local bakery stops.',
    },
    seasons: [
      // 1. Tobago Carnival Season (October 1 - October 31)
      // Established standalone October festival with Crown Point J'ouvert, night mas, and Scarborough parades
      {
        name: 'Tobago Carnival Season: Road to Crown Point & Scarborough',
        match: (month) => month === 10,
        themes:
          'Tobago October Carnival festivities: Crown Point J\'ouvert, mas camp costume viewings, steelband panyards (Buccoo, Scarborough), soca showcases, Shaw Park Cultural Complex concerts, and vibrant street energy.',
        searchKeywords: [
          'Tobago Carnival events 2026',
          'Tobago Carnival schedule October',
          'Crown Point J\'ouvert Tobago',
          'Shaw Park Cultural Complex events Tobago',
          'Tobago panyard rehearsals',
        ],
        seasonalMandate:
          'At least one quest must immerse the player in the excitement of Tobago Carnival (e.g. visiting a panyard during practice, passing by a mas camp display, spotting carnival preparations in Crown Point or Scarborough, or enjoying pre-carnival crab & dumpling at Store Bay).',
      },

      // 2. Tobago Jazz Experience Season (April 18 - April 30)
      // Annual music and arts festival hosted in Pigeon Point, Speyside, and Scarborough
      {
        name: 'Tobago Jazz & Heritage Music Season',
        match: (month, day) => month === 4 && day >= 18,
        themes:
          'Tobago Jazz Experience concerts at Pigeon Point, jazz on the beach, Speyside jazz fringe events, live acoustic music, local pan jazz, and coastal sunset gatherings.',
        searchKeywords: [
          'Tobago Jazz Experience schedule',
          'Pigeon Point jazz events Tobago',
          'live music Tobago April',
          'Tobago outdoor concerts',
        ],
        seasonalMandate:
          'At least one quest must highlight the musical rhythm of Tobago Jazz (e.g. listening to live pan or acoustic rhythms, enjoying a beachside sunset near Pigeon Point or Store Bay, or visiting a coastal music hub).',
      },

      // 3. Easter & Buccoo Goat Races Season (March 15 - April 17)
      // Buccoo Goat & Crab Race Festival is a world-renowned Easter Tuesday tradition
      {
        name: 'Easter & Buccoo Goat Race Season',
        match: (month, day) => (month === 3 && day >= 15) || (month === 4 && day < 18),
        themes:
          'Buccoo Goat and Crab Race Festival, Easter weekend beach limes, kite flying in Mount Pleasant and coastal recreation grounds, and hot cross buns from local bakeries.',
        searchKeywords: [
          'Buccoo Goat Race Festival Tobago',
          'Easter events Tobago',
          'kite flying Mount Pleasant Tobago',
          'Store Bay Easter lime',
        ],
        seasonalMandate:
          'At least one quest must celebrate Easter traditions in Tobago (e.g. visiting Buccoo historical recreation grounds, spotting kites soaring in coastal breezes, or picking up freshly baked Easter pastries).',
      },

      // 4. Tobago Heritage Festival (July 1 - August 10)
      // Premier cultural festival showcasing village traditions: Moriah Ole Time Wedding, Plymouth J'ouvert, Salaka Feast
      {
        name: 'Tobago Heritage Festival Season',
        match: (month, day) => month === 7 || (month === 8 && day <= 10),
        themes:
          'Tobago Heritage Festival traditions: Moriah Ole Time Wedding, Charlotteville Natural Treasures, Les Coteaux Folk Tales, Salaka Feast, traditional drumming, and village community heritage.',
        searchKeywords: [
          'Tobago Heritage Festival schedule',
          'Moriah Ole Time Wedding Tobago',
          'Tobago cultural heritage village events',
          'Charlotteville Tobago heritage',
        ],
        seasonalMandate:
          'At least one quest must celebrate authentic Tobagonian heritage and folk culture (e.g. exploring a historic heritage village, learning about traditional village folklore, or visiting a coastal scenic waypoint).',
      },

      // 5. Tobago Great Fete & Island Crashers Weekend (August 11 - August 24)
      // Renowned mid-August summer beach party and fete week centered in Crown Point and Pigeon Point
      {
        name: 'Tobago Summer Beach Fete & Island Crashers Season',
        match: (month, day) => month === 8 && day >= 11 && day <= 24,
        themes:
          'Mid-August beach party weekend (Great Fete Weekend, Island Crashers), coastal cooler limes, sunset catamaran sails, Pigeon Point beach activities, and vibrant summer nightlife.',
        searchKeywords: [
          'Tobago Great Fete Weekend',
          'Island Crashers Tobago events',
          'Pigeon Point beach events August',
          'Tobago summer party lime',
        ],
        seasonalMandate:
          'At least one quest must capture the high-energy mid-August summer vacation spirit (e.g. feeling the daytime pulse of Pigeon Point beach, taking a coastal walk along Store Bay, or sampling local refreshments at Crown Point).',
      },

      // 6. National Pride & Republic Season (August 25 - September 30)
      {
        name: 'National Pride & Republic Season',
        match: (month, day) => (month === 8 && day >= 25) || month === 9,
        themes:
          'Red, white, and black patriotic displays, historic forts (Fort King George, Fort James), national monuments, and coastal scenic lookouts.',
        searchKeywords: [
          'Independence Day events Tobago',
          'Republic Day celebrations Tobago',
          'Fort King George Tobago history',
        ],
        seasonalMandate:
          'At least one quest must celebrate national pride or history (e.g. visiting historic Fort King George or Fort James, observing the national flag atop scenic lookouts, or reflecting on historical architecture).',
      },

      // 7. Christmas & Parang Season (November 1 - January 6)
      {
        name: 'Christmas & Parang Season',
        match: (month, day) =>
          month === 12 || (month === 11 && day >= 1) || (month === 1 && day <= 6),
        themes:
          'Scarborough Esplanade light displays, community Christmas trees, local parang rhythms, black cake, ginger beer, sorrel, and village carol services.',
        searchKeywords: [
          'Scarborough Esplanade Christmas lights',
          'Christmas events Tobago',
          'parang concert Tobago',
          'holiday craft market Tobago',
        ],
        seasonalMandate:
          'At least one quest must celebrate Christmas and holiday warmth in Tobago (e.g. visiting an illuminated public plaza in Scarborough, enjoying seasonal sorrel or ginger beer, or spotting holiday decor).',
      },

      // 8. Pre-Lenten Carnival Season (January 7 - early March / Ash Wednesday window)
      {
        name: 'Pre-Lenten Carnival Warm-up Season',
        match: (month, day) =>
          month === 2 || (month === 1 && day >= 7) || (month === 3 && day <= 7),
        themes:
          'Community steelpan panyards, calypso shows at Shaw Park Cultural Complex, and preparation for national Carnival festivities.',
        searchKeywords: [
          'Shaw Park Cultural Complex calypso',
          'Tobago panyard rehearsals',
          'Tobago Panorama events',
        ],
        seasonalMandate:
          'At least one quest must connect with the steelband or calypso sound of the season.',
      },
    ],
  },

  Trinidad: {
    defaultSeasonName: 'Standard Island Exploration Season',
    defaultThemes:
      'Queen\'s Park Savannah, Royal Botanic Gardens, street food hubs, public savannahs, and neighborhood trails.',
    defaultSeasonalMandate:
      'Create engaging real-world quests connecting players with local community spaces and flavors.',
    culinaryAnchors:
      'Doubles (slight pepper), bake and shark (Maracas), hot hops bread, corn soup, geera pork/chicken, and fresh coconut water.',
    geographicalAnchors:
      'Queen\'s Park Savannah, Royal Botanic Gardens, Maracas Bay, Las Cuevas, Chaguanas Main Road, San Fernando Hill, Arima Velodrome, and Skinner Park.',
    dayRhythms: {
      Saturday:
        'Saturday morning hustle: bustling farmers\' markets (Macoya, Chaguanas, Diego Martin), fresh coconut water on the Savannah, and active community sports.',
      Sunday:
        'Sunday family lime: beach excursions along the North Coast, unhurried nature strolls at Botanic Gardens, and Sunday lunch roti spots.',
      Friday:
        'Friday evening wind-down: roadside doubles pop-ups, bubbling corn soup cauldrons, panyard limes, and town center buzz.',
      default:
        'Weekday exploration: accessible before or after commute hours, neighborhood green pauses, and local bakery visits.',
    },
    seasons: [
      // 1. Divali & Heritage Season (October 1 - November 15)
      // Divali Nagar in Chaguanas is the world-famous centerpiece in Trinidad
      {
        name: 'Divali & Heritage Season',
        match: (month, day) => month === 10 || (month === 11 && day <= 15),
        themes:
          'Divali Nagar in Chaguanas, community deya lighting, decorative bamboo arches, traditional Indian sweets (kurma, sawine, jalebi), and vibrant cultural performances.',
        searchKeywords: [
          'Divali Nagar Chaguanas schedule 2026',
          'Divali events Trinidad',
          'deya lighting festival Trinidad',
          'cultural celebrations Chaguanas Trinidad',
        ],
        seasonalMandate:
          'At least one quest must reflect Divali celebrations and cultural heritage (e.g. visiting a community deya display, admiring decorative bent bamboo arches, or savoring fresh traditional sweets, doubles, or roti).',
      },

      // 2. Christmas & Parang Season (November 16 - January 6)
      {
        name: 'Christmas & Parang Season',
        match: (month, day) =>
          month === 12 || (month === 11 && day >= 16) || (month === 1 && day <= 6),
        themes:
          'Christmas villages, festive lights at Queen\'s Park Savannah and Arima, Parang music festivals in Lopinot, pastelles, sorrel, and ponche de crème.',
        searchKeywords: [
          'Christmas village lights Queens Park Savannah',
          'Lopinot parang festival Trinidad',
          'Christmas events Trinidad',
          'holiday craft market Port of Spain',
        ],
        seasonalMandate:
          'At least one quest must celebrate the Christmas & Parang season (e.g. visiting a holiday light display, taking a picture with festive decorations, or tasting seasonal pastelles or sorrel).',
      },

      // 3. Carnival Season (January 7 - early March / Ash Wednesday)
      {
        name: 'Trinidad Carnival Season',
        match: (month, day) =>
          month === 2 || (month === 1 && day >= 7) || (month === 3 && day <= 7),
        themes:
          'National Carnival: Steelband panyard rehearsals (Woodbrook, Port of Spain), Calypso tents (Kaiso House, Calypso Revue), soca monarch, and mas camp costume showrooms.',
        searchKeywords: [
          'Port of Spain panyard rehearsals Panorama',
          'Calypso tent schedule Queens Park Savannah',
          'Carnival events Trinidad',
          'mas camp open days Woodbrook',
        ],
        seasonalMandate:
          'At least one quest must immerse the player in Carnival season (e.g. stopping by a steelband panyard during evening rehearsal, visiting a calypso tent or theatre, or taking a picture with a mas camp display).',
      },

      // 4. Easter & Kite Flying Season (March 15 - April 30)
      {
        name: 'Easter & Kite Flying Season',
        match: (month, day) => month === 4 || (month === 3 && day >= 15),
        themes:
          'Kite flying in open savannahs (Queen\'s Park Savannah, Arima), Easter beach limes, hot cross buns from neighborhood bakeries, and recreational sports.',
        searchKeywords: [
          'Easter kite flying Queens Park Savannah',
          'Easter events Trinidad',
          'Easter weekend markets Port of Spain',
        ],
        seasonalMandate:
          'At least one quest must highlight the Easter and kite-flying season (e.g. spotting or flying a kite on an open savannah, feeling the breeze, or picking up hot cross buns).',
      },

      // 5. Summer Vacation & Mid-Year Lime (July 1 - August 24)
      {
        name: 'Summer Vacation & North Coast Lime Season',
        match: (month, day) => month === 7 || (month === 8 && day <= 24),
        themes:
          'Waterfall hikes, North Coast beach excursions (Maracas Bay bake & shark, Las Cuevas), outdoor sporting events, and summer street food limes.',
        searchKeywords: [
          'outdoor summer festivals Trinidad',
          'Maracas beach events Trinidad',
          'summer street food limes Trinidad',
        ],
        seasonalMandate:
          'At least one quest must capture the summer vacation spirit (e.g. heading toward a northern coastal beach, taking a nature stroll to a river or park, or enjoying an outdoor fruit stall).',
      },

      // 6. Independence & Republic Season (August 25 - September 30)
      {
        name: 'National Pride & Republic Season',
        match: (month, day) => (month === 8 && day >= 25) || month === 9,
        themes:
          'Independence parade memories, red, white, and black patriotic displays, national monuments, and historic landmarks.',
        searchKeywords: [
          'Independence Day parade Port of Spain',
          'Republic Day celebrations Trinidad',
          'National Museum cultural shows Trinidad',
        ],
        seasonalMandate:
          'At least one quest must highlight national pride or heritage (e.g. spotting national colors in a town square, visiting a historic monument, or observing historic architecture).',
      },
    ],
  },
};

/**
 * Returns dynamic, authentic temporal and cultural context for the requested date and island region.
 *
 * @param {string} poolDateString - Format: YYYY-MM-DD
 * @param {string} [region='Trinidad'] - Island identifier ('Trinidad' | 'Tobago')
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

  // Resolve island calendar profile (fallback to Trinidad if region is unknown)
  const islandProfile = REGION_CALENDARS[region] || REGION_CALENDARS.Trinidad;

  // Find active seasonal rule matching current date
  const matchedSeason = islandProfile.seasons.find((s) => s.match(month, day));

  const seasonName = matchedSeason ? matchedSeason.name : islandProfile.defaultSeasonName;
  const seasonThemes = matchedSeason ? matchedSeason.themes : islandProfile.defaultThemes;
  const searchKeywords = matchedSeason
    ? matchedSeason.searchKeywords
    : [`events ${region} this week`, `festivals things to do ${region}`];
  const seasonalMandate = matchedSeason
    ? matchedSeason.seasonalMandate
    : islandProfile.defaultSeasonalMandate;

  // Resolve day rhythm
  const dayRhythm = islandProfile.dayRhythms[dayOfWeek] || islandProfile.dayRhythms.default;

  return {
    poolDate: poolDateString,
    region,
    dayOfWeek,
    seasonName,
    seasonThemes,
    searchKeywords,
    seasonalMandate,
    dayRhythm,
    culinaryAnchors: islandProfile.culinaryAnchors,
    geographicalAnchors: islandProfile.geographicalAnchors,
  };
}
