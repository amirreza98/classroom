import express, { type Router } from 'express';
import securityMiddleware from '../../middleware/security.js';

/**
 * Builds a minimal Express app for testing a single router.
 * Does NOT import index.ts (which pulls in APM, Kafka, better-auth startup).
 */
export function createTestApp(mountPath: string, router: Router) {
    const app = express();
    app.use(express.json());
    app.use(securityMiddleware);
    app.use(mountPath, router);
    return app;
}
