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