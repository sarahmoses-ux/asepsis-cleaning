import { createHash, randomUUID } from 'node:crypto';
import { MongoClient } from 'mongodb';

const clients = new Map();

async function getDatabase(env) {
  const uri = env.MONGODB_URI || env.MONGO_URI;
  if (!uri) throw new Error('MongoDB configuration is missing');
  let client = clients.get(uri);
  if (!client) {
    client = new MongoClient(uri, { serverSelectionTimeoutMS: 5000, maxPoolSize: 10 });
    clients.set(uri, client);
  }
  await client.connect();
  return client.db(env.MONGODB_DB || env.MONGODB_DATABASE || 'asepsis');
}

export function createStore(env) {
  async function bookings() {
    return (await getDatabase(env)).collection('bookings');
  }

  async function limits() {
    return (await getDatabase(env)).collection('booking_limits');
  }

  async function queue() {
    return (await getDatabase(env)).collection('notification_queue');
  }

  return {
    async get(id) {
      const collection = await bookings();
      const record = await collection.findOne({ id });
      return record ? { ...record } : null;
    },
    async create(record, ip) {
      const collection = await bookings();
      if (await collection.findOne({ id: record.id })) return 'existing';

      const limitStore = await limits();
      const ipKey = `ip:${createHash('sha256').update(ip || 'unknown').digest('hex')}`;
      const [ipLimit, globalLimit] = await Promise.all([
        limitStore.findOne({ _id: ipKey }),
        limitStore.findOne({ _id: 'global' }),
      ]);

      if ((ipLimit?.count ?? 0) >= 5 || (globalLimit?.count ?? 0) >= 50) return 'limited';

      try {
        await Promise.all([
          limitStore.updateOne({ _id: ipKey }, { $inc: { count: 1 }, $setOnInsert: { createdAt: new Date() } }, { upsert: true }),
          limitStore.updateOne({ _id: 'global' }, { $inc: { count: 1 }, $setOnInsert: { createdAt: new Date() } }, { upsert: true }),
        ]);
        await collection.insertOne({ ...record, createdAt: new Date(), updatedAt: new Date() });
        return 'created';
      } catch (error) {
        if (error.code === 11000) return 'existing';
        throw error;
      }
    },
    async save(record) {
      const collection = await bookings();
      const result = await collection.updateOne({ id: record.id }, { $set: { ...record, updatedAt: new Date() } });
      if (result.matchedCount === 0) throw new Error('Booking record expired');
    },
    async removePending(id) {
      const collection = await queue();
      await collection.deleteOne({ _id: id });
    },
    async pending(limit = 10) {
      const collection = await queue();
      const docs = await collection.find({}, { sort: { queuedAt: 1 }, limit }).toArray();
      return docs.map(doc => doc._id);
    },
    async defer(id) {
      const collection = await queue();
      await collection.updateOne({ _id: id }, { $set: { queuedAt: Date.now() } }, { upsert: true });
    },
    async lock(id) {
      const collection = await bookings();
      const token = randomUUID();
      const result = await collection.findOneAndUpdate(
        { id, $or: [{ lockToken: null }, { lockUntil: { $lt: new Date() } }] },
        { $set: { lockToken: token, lockUntil: new Date(Date.now() + 90_000) } },
        { returnDocument: 'after' },
      );
      return result.value ? token : null;
    },
    async unlock(id, token) {
      const collection = await bookings();
      await collection.updateOne({ id, lockToken: token }, { $unset: { lockToken: '', lockUntil: '' } });
    },
  };
}
