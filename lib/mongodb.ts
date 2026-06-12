import { MongoClient, type Db } from "mongodb";

if (!process.env.MONGODB_URI) {
  throw new Error('Variable d\'environnement manquante : "MONGODB_URI"');
}

const uri = process.env.MONGODB_URI;
const options = {};

let client: MongoClient;
let clientPromise: Promise<MongoClient>;

// En dev, on réutilise la connexion à travers les hot-reloads (HMR) via une
// variable globale, pour éviter d'ouvrir une nouvelle connexion à chaque édition.
if (process.env.NODE_ENV === "development") {
  const globalWithMongo = global as typeof globalThis & {
    _mongoClientPromise?: Promise<MongoClient>;
  };

  if (!globalWithMongo._mongoClientPromise) {
    client = new MongoClient(uri, options);
    globalWithMongo._mongoClientPromise = client.connect();
  }
  clientPromise = globalWithMongo._mongoClientPromise;
} else {
  // En prod, pas de variable globale.
  client = new MongoClient(uri, options);
  clientPromise = client.connect();
}

export default clientPromise;

/** Récupère la base définie par MONGODB_DB (ou celle de l'URI par défaut). */
export async function getDb(): Promise<Db> {
  const connectedClient = await clientPromise;
  return connectedClient.db(process.env.MONGODB_DB);
}
