const mongoose = require('mongoose');
const config = require('../config');

async function dropDomainIndex() {
  try {
    await mongoose.connect(config.mongoURI);
    console.log('Connected to MongoDB');

    // Drop the unique index on the domain field
    await mongoose.connection.collection('maintenancepages').dropIndex('domain_1');
    console.log('Successfully dropped unique index on domain field');

    await mongoose.connection.close();
    console.log('Migration completed successfully');
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  }
}

dropDomainIndex(); 