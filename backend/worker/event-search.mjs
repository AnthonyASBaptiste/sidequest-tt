/**
 * Event Search Module for SideQuest T&T.
 *
 * Search priority:
 * 1. SerpApi (Google Events / Search engine) via SERPAPI_API_KEY
 * 2. Tavily Search API via TAVILY_API_KEY
 * 3. Graceful offline seasonal fallback
 */

export async function searchEventsForRegion(region, config, temporalContext) {
  const serpApiKey = (config?.serpApiKey || process.env.SERPAPI_API_KEY || '').trim();
  const tavilyApiKey = (config?.tavilyApiKey || process.env.TAVILY_API_KEY || '').trim();

  const query = buildSearchQuery(region, temporalContext);

  // 1. Try SerpApi first
  if (serpApiKey) {
    try {
      const serpResults = await searchWithSerpApi(query, region, serpApiKey);
      if (serpResults && serpResults.length > 0) {
        console.info(`[EventSearch] Found ${serpResults.length} live events via SerpApi for ${region}.`);
        return serpResults;
      }
    } catch (error) {
      console.warn(`[EventSearch] SerpApi search failed (${error.message}); trying fallback.`);
    }
  }

  // 2. Try Tavily fallback
  if (tavilyApiKey) {
    try {
      const tavilyResults = await searchWithTavily(query, region, tavilyApiKey);
      if (tavilyResults && tavilyResults.length > 0) {
        console.info(`[EventSearch] Found ${tavilyResults.length} live events via Tavily for ${region}.`);
        return tavilyResults;
      }
    } catch (error) {
      console.warn(`[EventSearch] Tavily search failed (${error.message}); using offline seasonal context.`);
    }
  }

  // 3. Creative offline seasonal fallback
  console.info(`[EventSearch] Using offline seasonal inspirations for ${region} (${temporalContext.seasonName}).`);
  return getOfflineSeasonalInspirations(region, temporalContext);
}

function buildSearchQuery(region, temporalContext) {
  if (temporalContext?.searchKeywords?.length > 0) {
    return temporalContext.searchKeywords[0];
  }
  return `events cultural festivals things to do in ${region}`;
}

async function searchWithSerpApi(query, region, apiKey) {
  const targetLocation = region === 'Tobago' ? 'Tobago, Trinidad and Tobago' : 'Trinidad, Trinidad and Tobago';

  // First try Google Events engine
  const eventsUrl = new URL('https://serpapi.com/search.json');
  eventsUrl.searchParams.set('engine', 'google_events');
  eventsUrl.searchParams.set('q', query);
  eventsUrl.searchParams.set('location', targetLocation);
  eventsUrl.searchParams.set('hl', 'en');
  eventsUrl.searchParams.set('gl', 'tt');
  eventsUrl.searchParams.set('api_key', apiKey);

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 8000);

  try {
    const res = await fetch(eventsUrl, { signal: controller.signal });
    if (!res.ok) {
      throw new Error(`SerpApi responded with HTTP ${res.status}`);
    }
    const data = await res.json();
    if (data.events_results && Array.isArray(data.events_results) && data.events_results.length > 0) {
      return data.events_results.slice(0, 4).map((event) => ({
        title: event.title || 'Community Event',
        snippet: event.description || event.snippet || event.info?.join(' ') || 'Local community event.',
        venue: event.venue?.name || event.address?.join(', ') || region,
        date: event.date?.when || event.date?.start_date || 'Today',
        source: 'serpapi:events',
      }));
    }

    // If no events_results, fallback to standard organic Google search
    const searchUrl = new URL('https://serpapi.com/search.json');
    searchUrl.searchParams.set('engine', 'google');
    searchUrl.searchParams.set('q', query);
    searchUrl.searchParams.set('location', targetLocation);
    searchUrl.searchParams.set('gl', 'tt');
    searchUrl.searchParams.set('api_key', apiKey);

    const searchRes = await fetch(searchUrl, { signal: controller.signal });
    if (searchRes.ok) {
      const searchData = await searchRes.json();
      if (searchData.organic_results && Array.isArray(searchData.organic_results)) {
        return searchData.organic_results.slice(0, 3).map((item) => ({
          title: item.title,
          snippet: item.snippet || item.snippet_highlighted_words?.join(' ') || '',
          venue: region,
          date: 'Happening Now',
          source: 'serpapi:search',
        }));
      }
    }
  } finally {
    clearTimeout(timeoutId);
  }

  return [];
}

async function searchWithTavily(query, region, apiKey) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 8000);

  try {
    const res = await fetch('https://api.tavily.com/search', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        api_key: apiKey,
        query: `${query} Trinidad and Tobago`,
        search_depth: 'basic',
        include_answer: false,
        max_results: 3,
      }),
      signal: controller.signal,
    });

    if (!res.ok) {
      throw new Error(`Tavily responded with HTTP ${res.status}`);
    }

    const data = await res.json();
    if (data.results && Array.isArray(data.results)) {
      return data.results.slice(0, 3).map((item) => ({
        title: item.title,
        snippet: item.content || '',
        venue: region,
        date: 'Current',
        source: 'tavily',
      }));
    }
  } finally {
    clearTimeout(timeoutId);
  }

  return [];
}

function getOfflineSeasonalInspirations(region, temporalContext) {
  const isTobago = region === 'Tobago';

  // 1. Christmas & Parang
  if (temporalContext.seasonName.includes('Christmas')) {
    return [
      {
        title: 'Christmas Light Village & Parang Showcase',
        snippet: 'Public parks and town squares adorned with holiday light arches, nativity displays, and seasonal parang tunes.',
        venue: isTobago ? 'Scarborough Esplanade' : 'Queen\'s Park Savannah',
        date: 'Evening',
        source: 'offline:seasonal',
      },
      {
        title: 'Holiday Pastelle & Sorrel Market',
        snippet: 'Local vendors and bakeries preparing steaming cornmeal pastelles, freshly brewed ginger beer, and chilled sorrel.',
        venue: isTobago ? 'Scarborough Market / Crown Point' : 'Port of Spain / Arima Market',
        date: 'Daily',
        source: 'offline:seasonal',
      },
    ];
  }

  // 2. Tobago Carnival (October) vs Trinidad Carnival (Pre-Lenten)
  if (temporalContext.seasonName.includes('Carnival')) {
    if (isTobago) {
      return [
        {
          title: 'Tobago Carnival Mas Camp & Panyard Pulse',
          snippet: 'Steelbands and mas camps tuning up for Crown Point J\'ouvert, night mas, and street parades with lively soca sound systems.',
          venue: 'Crown Point Strip / Buccoo Panyard / Scarborough',
          date: 'Evening',
          source: 'offline:seasonal',
        },
        {
          title: 'Shaw Park Cultural Carnival Concert',
          snippet: 'Live calypso, soca monarch showcases, and steel orchestral music celebrating the October Carnival energy.',
          venue: 'Shaw Park Cultural Complex, Scarborough',
          date: 'Night',
          source: 'offline:seasonal',
        },
      ];
    }

    return [
      {
        title: 'Panyard Open Evening Rehearsal',
        snippet: 'Steelbands rehearsing Panorama arrangements in open panyards. The public gathers on the perimeter to listen.',
        venue: 'Woodbrook / Port of Spain Panyards',
        date: '7:00 PM',
        source: 'offline:seasonal',
      },
      {
        title: 'Calypso Tent Performance',
        snippet: 'Live social commentary and wit from calypsonians and humorists in a classic tent or hall setting.',
        venue: 'Queen\'s Hall / Kaiso House',
        date: 'Weekend',
        source: 'offline:seasonal',
      },
    ];
  }

  // 3. Divali & Heritage Season (Trinidad in October/November)
  if (temporalContext.seasonName.includes('Divali')) {
    return [
      {
        title: 'Divali Nagar & Cultural Stage',
        snippet: 'Illuminated grounds, clay deyas flickering on bent bamboo frames, devotional music, and sweet booths serving hot kurma and jalebi.',
        venue: 'Divali Nagar Site, Chaguanas',
        date: 'Evening',
        source: 'offline:seasonal',
      },
      {
        title: 'Community Deya Light & Bamboo Arch Stroll',
        snippet: 'Neighborhoods and civic squares lit by thousands of glowing clay deyas welcoming the festival of lights.',
        venue: 'Central & South Trinidad Town Squares',
        date: 'Sunset / Evening',
        source: 'offline:seasonal',
      },
    ];
  }

  // 4. Tobago Jazz & Heritage Music (April)
  if (temporalContext.seasonName.includes('Jazz')) {
    return [
      {
        title: 'Tobago Jazz Coastal Acoustic Session',
        snippet: 'Live jazz, acoustic steelpan melodies, and coastal sunset rhythms against the backdrop of the Caribbean Sea.',
        venue: 'Pigeon Point Heritage Park & Speyside',
        date: 'Sunset',
        source: 'offline:seasonal',
      },
      {
        title: 'Store Bay Local Pan & Seafood Lime',
        snippet: 'Seaside dining with curried crab & dumpling accompanied by relaxing local pan and jazz arrangements.',
        venue: 'Store Bay Beach Facility',
        date: 'Afternoon',
        source: 'offline:seasonal',
      },
    ];
  }

  // 5. Tobago Heritage Festival (July - early August)
  if (temporalContext.seasonName.includes('Heritage Festival')) {
    return [
      {
        title: 'Tobago Heritage Village Showcase & Folk Tales',
        snippet: 'Reenactments of the Moriah Ole Time Wedding, Salaka Feast rituals, traditional drumming, and village heirloom crafts.',
        venue: 'Moriah / Charlotteville / Les Coteaux',
        date: 'Daytime',
        source: 'offline:seasonal',
      },
      {
        title: 'Folk Heritage Drumming & Village Food Fair',
        snippet: 'Cast-iron pot oil-down, ground provisions, and infectious tambourine and fiddle rhythms in the village square.',
        venue: 'Heritage Villages across Tobago',
        date: 'Afternoon',
        source: 'offline:seasonal',
      },
    ];
  }

  // 6. Tobago Summer Beach Fete / Island Crashers (mid-August)
  if (temporalContext.seasonName.includes('Island Crashers') || temporalContext.seasonName.includes('Beach Fete')) {
    return [
      {
        title: 'Island Crashers & Great Fete Beach Lime',
        snippet: 'Pigeon Point and Store Bay alive with summer beachgoers, boat charters, beach volleyball, and daytime soca rhythms.',
        venue: 'Pigeon Point & Crown Point',
        date: 'Daytime',
        source: 'offline:seasonal',
      },
      {
        title: 'Crown Point Summer Sunset Stroll',
        snippet: 'Lively strip with street vendors, fresh fruit smoothies, local souse, and chilled coconut water.',
        venue: 'Milford Road / Crown Point',
        date: 'Evening',
        source: 'offline:seasonal',
      },
    ];
  }

  // 7. Easter & Buccoo Goat Races
  if (temporalContext.seasonName.includes('Easter') || temporalContext.seasonName.includes('Goat Race')) {
    if (isTobago) {
      return [
        {
          title: 'Buccoo Goat & Crab Race Historical Complex',
          snippet: 'The unique, world-famous Easter tradition of jockeying trained racing goats and nimble crabs down the turf track.',
          venue: 'Buccoo Integrated Facility',
          date: 'Daytime',
          source: 'offline:seasonal',
        },
        {
          title: 'Mount Pleasant Coastal Kite Gathering',
          snippet: 'Breezy green savannahs dotted with handmade singing kites soaring high over the Caribbean blue.',
          venue: 'Mount Pleasant Recreation Ground',
          date: 'Afternoon',
          source: 'offline:seasonal',
        },
      ];
    }
  }

  // Standard Fallback by Island
  if (isTobago) {
    return [
      {
        title: 'Coastal Heritage & Village Trail',
        snippet: 'Historic battery sites, coastal fishing boats pulled up on the bay, and village fruit stalls.',
        venue: 'Pigeon Point, Castara & Fort King George',
        date: 'All Day',
        source: 'offline:seasonal',
      },
      {
        title: 'Seaside Seafood & Local Dumplings',
        snippet: 'Catch of the day, crab and callaloo dumplings, and fresh coconut water along coastal village stalls.',
        venue: 'Store Bay & Buccoo Point',
        date: 'Daytime',
        source: 'offline:seasonal',
      },
    ];
  }

  return [
    {
      title: 'North Coast Scenic Waypoint & Beach Stroll',
      snippet: 'Lush mountain drive winding down to the pounding surf of Maracas, Las Cuevas, or Blanchisseuse with bake & shark stalls.',
      venue: 'North Coast Road, Trinidad',
      date: 'Daytime',
      source: 'offline:seasonal',
    },
    {
      title: 'Savannah Green Bench Scavenger',
      snippet: 'Shaded park benches under sprawling poui and saman trees ringing open savannah recreational grounds.',
      venue: 'Queen\'s Park Savannah / Arima Velodrome / Skinner Park',
      date: 'Daytime',
      source: 'offline:seasonal',
    },
  ];
}
