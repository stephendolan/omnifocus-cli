import { createRemoteJWKSet, jwtVerify } from 'jose';

export interface AccessConfig {
  teamDomain: string;
  audience: string;
}

export function createAccessVerifier(config: AccessConfig) {
  if (!/^https:\/\/[a-z0-9-]+\.cloudflareaccess\.com\/?$/.test(config.teamDomain)) {
    throw new Error('Access team domain must be https://<team>.cloudflareaccess.com');
  }
  if (!config.audience.trim()) throw new Error('Access application audience is required');
  const issuer = config.teamDomain.replace(/\/$/, '');
  const keys = createRemoteJWKSet(new URL(`${issuer}/cdn-cgi/access/certs`), {
    timeoutDuration: 5000,
  });

  return async (assertion: string | string[] | undefined): Promise<void> => {
    if (typeof assertion !== 'string' || !assertion) throw new Error('Access assertion required');
    await jwtVerify(assertion, keys, {
      issuer,
      audience: config.audience,
      algorithms: ['RS256'],
      requiredClaims: ['exp'],
    });
  };
}
