import { NextRequest, NextResponse } from 'next/server'

const MAPBOX_TOKEN = process.env.MAPBOX_API_TOKEN

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const query = searchParams.get('q')
  
  if (!query) {
    return NextResponse.json({ error: 'Query parameter "q" is required' }, { status: 400 })
  }
  
  if (!MAPBOX_TOKEN) {
    console.error('MAPBOX_API_TOKEN is not configured')
    return NextResponse.json({ error: 'Geocoding service not configured' }, { status: 500 })
  }
  
  try {
    const encodedQuery = encodeURIComponent(query)
    const mapboxUrl = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodedQuery}.json?access_token=${MAPBOX_TOKEN}&types=address,place,locality,neighborhood,postcode&limit=5&country=us`
    
    const response = await fetch(mapboxUrl)
    
    if (!response.ok) {
      console.error('Mapbox API error:', response.status, await response.text())
      return NextResponse.json({ error: 'Geocoding request failed' }, { status: response.status })
    }
    
    const data = await response.json()
    
    return NextResponse.json(data)
  } catch (error) {
    console.error('Geocoding error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
