import { NextResponse } from 'next/server';

// Next.js won't put responses over 2MB in its fetch cache, so large tabs were re-downloaded
// from Google on every request. Keep CSVs in memory instead: fresh for CACHE_TTL_MS, then
// served stale (up to CACHE_MAX_STALE_MS) while a fresh copy downloads in the background.
const CACHE_TTL_MS = 60 * 1000;
const CACHE_MAX_STALE_MS = 30 * 60 * 1000;
const cache = new Map();
const inFlight = new Map();

function refresh(url) {
  let pending = inFlight.get(url);
  if (!pending) {
    pending = fetch(url, { cache: 'no-store' })
      .then(response => {
        if (!response.ok) throw new Error('Failed to fetch from Google Sheets');
        return response.text();
      })
      .then(text => {
        cache.set(url, { text, fetchedAt: Date.now() });
        return text;
      })
      .finally(() => inFlight.delete(url));
    inFlight.set(url, pending);
  }
  return pending;
}

const GA4_MATCH_CSV_URL =
  process.env.GA4_MATCH_CSV_URL ||
  'https://docs.google.com/spreadsheets/d/e/2PACX-1vTlIGiifN63JuYADmDNqNrDYRQocZzjObe-ykV27pTUAV9uIIU2GNS3nrMN8zU0jMi0fyikUgbqMQWW/pub?output=csv';

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const type = searchParams.get('type');
  const forceRefresh = searchParams.get('refresh') === '1';

  let url;
  if (type === 'combined') {
    url = process.env.COMBINED_COUNTRY_CSV_URL;
  } else if (type === 'adjust') {
    url = process.env.RAW_ADJUST_CSV_URL;
  } else if (type === 'creative') {
    url = process.env.CREATIVE_CSV_URL;
  } else if (type === 'ga4_match') {
    url = GA4_MATCH_CSV_URL;
  } else if (type === 'afc') {
    const gid = searchParams.get('gid');
    if (!gid) {
      return new NextResponse('Missing gid for afc sheet', { status: 400 });
    }
    if (gid === '674570209') {
      url = GA4_MATCH_CSV_URL;
    } else {
      url = `${process.env.AFC_SHEET_BASE_URL}&gid=${gid}`;
    }
  } else {
    return new NextResponse('Invalid sheet type', { status: 400 });
  }

  if (!url) {
    return new NextResponse('Missing sheet URL configuration', { status: 500 });
  }

  try {
    const cached = cache.get(url);
    const age = cached ? Date.now() - cached.fetchedAt : Infinity;
    let text;
    if (forceRefresh) {
      text = await refresh(url);
    } else if (cached && age < CACHE_MAX_STALE_MS) {
      if (age >= CACHE_TTL_MS) refresh(url).catch(err => console.error('Error refreshing sheet:', err));
      text = cached.text;
    } else {
      text = await refresh(url);
    }
    
    return new NextResponse(text, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv',
        'Cache-Control': forceRefresh ? 'no-store' : 's-maxage=60, stale-while-revalidate=120',
      },
    });
  } catch (error) {
    console.error('Error fetching sheet:', error);
    return new NextResponse('Error fetching data', { status: 500 });
  }
}
