import { NhostClient } from '@nhost/react';

const defaultSubdomain =
  process.env.NODE_ENV === 'production'
    ? 'tnpbzdizermlvqxpyqrh'
    : 'local';
const defaultRegion =
  process.env.NODE_ENV === 'production'
    ? 'ap-south-1'
    : 'us-east-1';

const subdomain = process.env.REACT_APP_NHOST_SUBDOMAIN || defaultSubdomain;
const region = process.env.REACT_APP_NHOST_REGION || defaultRegion;
const backendUrl = `https://${subdomain}.hasura.${region}.nhost.run/v1/graphql`;

if (!process.env.REACT_APP_NHOST_SUBDOMAIN) {
  console.warn(
    '[nhost] REACT_APP_NHOST_SUBDOMAIN is not set. Falling back to production default for deployment builds.'
  );
}

console.debug('[nhost] configured backend:', {
  REACT_APP_NHOST_SUBDOMAIN: process.env.REACT_APP_NHOST_SUBDOMAIN,
  REACT_APP_NHOST_REGION: process.env.REACT_APP_NHOST_REGION,
  effectiveSubdomain: subdomain,
  effectiveRegion: region,
  backendUrl,
});

export const NHOST_SUBDOMAIN = subdomain;
export const NHOST_REGION = region;
export const NHOST_BACKEND_URL = backendUrl;

export const nhost = new NhostClient({
  subdomain,
  region,
});
