import type {Request, Response, NextFunction} from "express";
import { ArcjetNodeRequest } from "@arcjet/node";
import { slidingWindow } from 'arcjet';

import aj from '../config/arcjet.js';

const securityMiddleware = async (req: Request, res: Response, next: NextFunction) => {
    if (process.env.NODE_ENV === 'test') {
        const id = req.headers['x-user-id'];
        const role = req.headers['x-user-role'];
        if (id && role) {
            req.user = {
                id: String(id),
                role: role as 'admin' | 'teacher' | 'student',
                email: String(req.headers['x-user-email'] ?? ''),
            };
        }
        return next();
    }

    // All requests must arrive through the gateway, which validates the JWT and injects these headers
    const gatewayUserId = req.headers['x-user-id'];
    const gatewayUserRole = req.headers['x-user-role'];
    if (gatewayUserId && gatewayUserRole) {
        req.user = {
            id: String(gatewayUserId),
            role: gatewayUserRole as "admin" | "teacher" | "student",
            email: String(req.headers['x-user-email'] ?? ''),
        };
    }

    if (!req.user) {
        return res.status(401).json({ error: 'Unauthorized' });
    }

try{
    const role: RateLimitRole = req.user.role;

    let limit: number; let message: string;

    switch (role) {
        case 'admin':
            limit=100;
            message = 'Admin request limit exceeded (100 per minute). Slow down';
            break;
        case 'teacher':
            limit=40;
            message = 'Teacher request limit exceeded (40 per minute). Please wait.';
            break;
        case 'student':
            limit=30;
            message = 'Student request limit exceeded (30 per minute). Please wait.';
            break;
        default:
            limit=15;
            message = 'Request limit exceeded. Please wait.';
            break;
    }

    const client = aj.withRule(
        slidingWindow({
            mode: 'LIVE',
            interval: '1m',
            max: limit,
    })
    )

    const arcjetRequest: ArcjetNodeRequest = {
        headers: req.headers,
        method: req.method,
        url: req.originalUrl ?? req.url,
        socket: { remoteAddress: req.socket.remoteAddress ?? req.ip ?? '0.0.0.0'},
    }
    const decision = await client.protect(arcjetRequest);

    if(decision.isDenied() && decision.reason.isBot()) {
        return res.status(403).json({ error: 'Forbidden', message: 'Automated requests are not allowed.'});
    }
    if(decision.isDenied() && decision.reason.isShield()) {
        return res.status(403).json({ error: 'Forbidden', message: 'Request blocked by security policy.'});
    }
    if(decision.isDenied() && decision.reason.isRateLimit()) {
        return res.status(429).json({ error: 'Too Many Requests', message});
    }
    return next();
} catch (e) {
    console.error('Arcjet middleware error: ', e);
    return res.status(500).json({ error: 'Internal error', message: 'Something went wrong with security middleware' });
}
}

export default securityMiddleware;
