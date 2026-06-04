import { Kafka } from 'kafkajs';

const kafka = new Kafka({
  clientId: 'classroom-backend',
  brokers: [process.env.KAFKA_BROKER || 'localhost:9092'],
});

export const producer = kafka.producer();

(async () => {
  try {
    await producer.connect();
    console.log('Kafka producer connected');
  } catch (err) {
    console.error('Kafka producer connection failed (non-fatal):', err);
  }
})();

export async function publishEvent(topic: string, payload: Record<string, unknown>): Promise<void> {
  try {
    await producer.send({ topic, messages: [{ value: JSON.stringify(payload) }] });
  } catch (err) {
    console.error(`Kafka publish failed (non-fatal) [${topic}]:`, err);
  }
}