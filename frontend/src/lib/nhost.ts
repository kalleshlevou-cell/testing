import { NhostClient } from '@nhost/react';

const subdomain = process.env.REACT_APP_NHOST_SUBDOMAIN;
const region = process.env.REACT_APP_NHOST_REGION;

if (!subdomain || subdomain === 'your-subdomain') {
  console.error(
    '[nhost] REACT_APP_NHOST_SUBDOMAIN is not set. ' +
    'Create a project at https://app.nhost.io and set the subdomain in frontend/.env'
  );
}

export const nhost = new NhostClient({
  subdomain: subdomain || 'local',
  region: region || 'us-east-1',
});
