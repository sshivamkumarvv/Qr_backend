import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface PlaceSuggestion {
  placeId: string;
  mainText: string;
  secondaryText: string;
}

export interface PlaceDetailsResult {
  latitude: number;
  longitude: number;
  name: string;
  formattedAddress: string;
}

const MIN_QUERY_LENGTH = 3;

@Injectable()
export class PlacesService {
  private readonly apiKey: string;

  constructor(private readonly config: ConfigService) {
    // Server-side only — never shipped to the client. Set GOOGLE_PLACES_API_KEY
    // in this app's .env, and in Google Cloud Console restrict the key to
    // this server (by IP, if static) and to the Places API only.
    this.apiKey = this.config.get<string>('GOOGLE_PLACES_API_KEY', '');
  }

  async autocomplete(input: string, sessionToken: string): Promise<PlaceSuggestion[]> {
    if (!input || input.trim().length < MIN_QUERY_LENGTH) {
      throw new BadRequestException(`Query must be at least ${MIN_QUERY_LENGTH} characters.`);
    }

    const res = await fetch('https://places.googleapis.com/v1/places:autocomplete', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': this.apiKey,
      },
      body: JSON.stringify({
        input: input.trim(),
        sessionToken,
        includedRegionCodes: ['IN'], // matches the app's India locale
      }),
    });

    const data = await res.json();

    if (!Array.isArray(data.suggestions)) return [];

    return data.suggestions
      .filter((s: any) => s.placePrediction)
      .map((s: any) => ({
        placeId: s.placePrediction.placeId,
        mainText: s.placePrediction.text?.text ?? '',
        // The original client-side version always left this blank even
        // though the UI renders it — Google does return it under
        // structuredFormat, so wiring it up properly here.
        secondaryText: s.placePrediction.structuredFormat?.secondaryText?.text ?? '',
      }));
  }

  async details(placeId: string, sessionToken: string): Promise<PlaceDetailsResult | null> {
    const params = new URLSearchParams({ sessionToken });

    const res = await fetch(
      `https://places.googleapis.com/v1/places/${placeId}?${params.toString()}`,
      {
        headers: {
          'X-Goog-Api-Key': this.apiKey,
          'X-Goog-FieldMask': 'displayName,formattedAddress,location',
        },
      },
    );

    const data = await res.json();

    if (!data.location) return null;

    return {
      latitude: data.location.latitude,
      longitude: data.location.longitude,
      name: data.displayName?.text ?? '',
      formattedAddress: data.formattedAddress ?? '',
    };
  }
}