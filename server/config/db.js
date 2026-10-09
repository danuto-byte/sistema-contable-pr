const mongoose = require('mongoose');

async function connectMongo() {
  const uri = process.env.MONGODB_URI;

  if (!uri) {
    console.log('MongoDB no configurado; usando modo local/in-memory.');
    return null;
  }

  mongoose.set('strictQuery', true);
  await mongoose.connect(uri);
  console.log('Conectado a MongoDB');
  return mongoose.connection;
}

module.exports = { connectMongo };
