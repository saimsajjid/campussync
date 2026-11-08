export const DEFAULT_JWT_SECRET = 'campussync-hackathon-secret-key-2026';

export const INSECURE_JWT_SECRETS = new Set([
  DEFAULT_JWT_SECRET,
  'change-me-to-a-long-random-string',
  'secret',
  'jwt_secret',
]);

export function validateProductionSecrets(
  nodeEnv = process.env.NODE_ENV,
  jwtSecret = process.env.JWT_SECRET
): void {
  if (nodeEnv === 'production') {
    if (!jwtSecret || INSECURE_JWT_SECRETS.has(jwtSecret) || jwtSecret.length < 32 || jwtSecret.trim() === '') {
      const msg = 'FATAL: Refusing to start in production mode (NODE_ENV=production) with default, missing, or insecure JWT_SECRET. A cryptographically secure secret (>= 32 chars) must be provided.';
      console.error(msg);
      throw new Error(msg);
    }
  }
}
