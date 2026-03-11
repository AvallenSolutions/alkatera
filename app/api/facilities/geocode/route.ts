import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

function getServiceClient() {
  return createClient(supabaseUrl, supabaseServiceKey)
}

async function getAuthenticatedUser(request: NextRequest) {
  const cookieStore = await cookies()
  const supabase = createServerClient(
    supabaseUrl,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
      },
    }
  )
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) return null
  return user
}

/**
 * POST /api/facilities/geocode
 *
 * Geocodes a facility's address using Google Maps Geocoding API and saves the
 * coordinates back to the facility record. This handles facilities that were
 * created without geocoding (e.g. via onboarding or the edit dialog).
 *
 * Body: { facilityId: string }
 * Returns: { success: true, lat: number, lng: number } or error
 */
export async function POST(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { facilityId } = body

    if (!facilityId) {
      return NextResponse.json(
        { error: 'Missing required field: facilityId' },
        { status: 400 }
      )
    }

    const apiKey = process.env.GOOGLE_MAPS_API_KEY
    if (!apiKey) {
      return NextResponse.json(
        { error: 'Google Maps API key not configured' },
        { status: 500 }
      )
    }

    const supabase = getServiceClient()

    // Fetch the facility
    const { data: facility, error: fetchError } = await supabase
      .from('facilities')
      .select('id, organization_id, address_line1, address_city, address_country, address_postcode, location_address, address_lat, address_lng')
      .eq('id', facilityId)
      .single()

    if (fetchError || !facility) {
      return NextResponse.json(
        { error: 'Facility not found' },
        { status: 404 }
      )
    }

    // Verify user is a member of the facility's organization
    const { data: membership } = await supabase
      .from('organization_members')
      .select('id')
      .eq('organization_id', facility.organization_id)
      .eq('user_id', user.id)
      .maybeSingle()

    if (!membership) {
      return NextResponse.json(
        { error: 'Not a member of this organization' },
        { status: 403 }
      )
    }

    // If facility already has coordinates, return them
    if (facility.address_lat && facility.address_lng) {
      return NextResponse.json({
        success: true,
        lat: parseFloat(facility.address_lat),
        lng: parseFloat(facility.address_lng),
        already_geocoded: true,
      })
    }

    // Build address query from available fields
    const addressParts: string[] = []
    if (facility.address_line1) addressParts.push(facility.address_line1)
    if (facility.address_city) addressParts.push(facility.address_city)
    if (facility.address_postcode) addressParts.push(facility.address_postcode)
    if (facility.address_country) addressParts.push(facility.address_country)

    // Fall back to location_address if no structured address fields
    let addressQuery = addressParts.join(', ')
    if (!addressQuery && facility.location_address) {
      addressQuery = facility.location_address
    }

    if (!addressQuery) {
      return NextResponse.json(
        { error: 'Facility has no address to geocode' },
        { status: 400 }
      )
    }

    // Call Google Geocoding API
    const geocodeUrl = new URL('https://maps.googleapis.com/maps/api/geocode/json')
    geocodeUrl.searchParams.append('address', addressQuery)
    geocodeUrl.searchParams.append('key', apiKey)

    const geocodeResponse = await fetch(geocodeUrl.toString())
    const geocodeData = await geocodeResponse.json()

    if (geocodeData.status !== 'OK' || !geocodeData.results || geocodeData.results.length === 0) {
      console.error('[Facility Geocode] Google Geocoding failed:', geocodeData.status, addressQuery)
      return NextResponse.json(
        { error: `Could not geocode address: ${addressQuery}` },
        { status: 422 }
      )
    }

    const result = geocodeData.results[0]
    const lat = result.geometry.location.lat
    const lng = result.geometry.location.lng

    // Extract address components for any missing fields
    const addressComponents = result.address_components || []
    let city = facility.address_city
    let country = facility.address_country
    let countryCode: string | null = null

    for (const component of addressComponents) {
      const types = component.types || []
      if (!city && (types.includes('locality') || types.includes('postal_town') || types.includes('administrative_area_level_2'))) {
        city = component.long_name
      }
      if (!country && types.includes('country')) {
        country = component.long_name
        countryCode = component.short_name?.toUpperCase() || null
      }
      if (!countryCode && types.includes('country')) {
        countryCode = component.short_name?.toUpperCase() || null
      }
    }

    // Update the facility with geocoded coordinates and any missing fields
    const updatePayload: Record<string, unknown> = {
      address_lat: lat,
      address_lng: lng,
      latitude: lat,
      longitude: lng,
      updated_at: new Date().toISOString(),
    }

    // Fill in missing address fields from geocoding result
    if (!facility.address_city && city) {
      updatePayload.address_city = city
    }
    if (!facility.address_country && country) {
      updatePayload.address_country = country
    }
    if (countryCode) {
      updatePayload.location_country_code = countryCode
    }
    if (!facility.address_line1 && facility.location_address) {
      updatePayload.address_line1 = facility.location_address
    }

    const { error: updateError } = await supabase
      .from('facilities')
      .update(updatePayload)
      .eq('id', facilityId)

    if (updateError) {
      console.error('[Facility Geocode] Failed to save coordinates:', updateError)
      return NextResponse.json(
        { error: `Failed to save coordinates: ${updateError.message}` },
        { status: 500 }
      )
    }

    console.log(`[Facility Geocode] Successfully geocoded facility ${facilityId}: ${addressQuery} → (${lat}, ${lng})`)

    return NextResponse.json({
      success: true,
      lat,
      lng,
      city: city || null,
      country: country || null,
      countryCode: countryCode || null,
      address_query: addressQuery,
    })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal server error'
    console.error('[Facility Geocode] Error:', error)
    return NextResponse.json(
      { error: message },
      { status: 500 }
    )
  }
}
