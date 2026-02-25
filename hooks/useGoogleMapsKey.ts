import { useEffect, useState } from 'react';

/**
 * Fetches the Google Maps API key at runtime from /api/config/maps.
 *
 * This avoids embedding the key in the static JS bundle, which would
 * trigger Netlify's secret scanner and block deployment.
 */
export function useGoogleMapsKey() {
  const [apiKey, setApiKey] = useState<string>('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/config/maps')
      .then(res => res.json())
      .then(data => {
        setApiKey(data.apiKey || '');
        setLoading(false);
      })
      .catch(() => {
        setLoading(false);
      });
  }, []);

  return { apiKey, loading };
}
