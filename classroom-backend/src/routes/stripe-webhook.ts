import { Request, Response } from 'express';
import { eq } from 'drizzle-orm';
import { stripe } from '../config/stripe.js';
import { db } from '../db/index.js';
import { payments, enrollments } from '../db/schema/index.js';
import { publishEvent } from '../kafka.js';

const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

export async function stripeWebhookHandler(req: Request, res: Response) {
    const sig = req.headers['stripe-signature'];
    if (!sig || !webhookSecret) {
        return res.status(400).json({ error: 'Missing stripe-signature header or webhook secret' });
    }

    let event;
    try {
        event = stripe.webhooks.constructEvent(req.body as Buffer, sig, webhookSecret);
    } catch (err: any) {
        console.error(`Stripe webhook signature verification failed: ${err.message}`);
        return res.status(400).json({ error: 'Invalid signature' });
    }

    try {
        if (event.type === 'checkout.session.completed') {
            const session = event.data.object as any;
            const { classId, studentId, subjectId } = session.metadata ?? {};

            await db.update(payments)
                .set({ status: 'paid', stripePaymentIntentId: session.payment_intent ?? null })
                .where(eq(payments.stripeSessionId, session.id));

            const [enrollment] = await db.update(enrollments)
                .set({ paymentStatus: 'paid' })
                .from(enrollments)
                .where(eq(enrollments.studentId, studentId))
                .returning();

            if (studentId && classId) {
                publishEvent('student.actions', {
                    event: 'student.enrolled',
                    studentId,
                    classId: Number(classId),
                    subjectId: subjectId ? Number(subjectId) : undefined,
                    timestamp: new Date().toISOString(),
                });
            }
        }

        if (event.type === 'checkout.session.expired') {
            const session = event.data.object as any;
            await db.update(payments)
                .set({ status: 'failed' })
                .where(eq(payments.stripeSessionId, session.id));
            await db.update(enrollments)
                .set({ paymentStatus: 'failed' })
                .where(eq(enrollments.studentId, (session.metadata?.studentId ?? '')));
        }
    } catch (err) {
        console.error(`Stripe webhook processing error: ${err}`);
        return res.status(500).json({ error: 'Webhook processing failed' });
    }

    res.json({ received: true });
}
