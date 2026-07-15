const mongoose = require('mongoose');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/glidechat';

console.log('Testing MongoDB connection to:', MONGODB_URI);

mongoose.connect(MONGODB_URI)
  .then(() => {
    console.log('\n======================================================');
    console.log('SUCCESS: Connected to MongoDB successfully!');
    console.log('======================================================');
    console.log('Your local MongoDB instance is active and ready to host GlideChat.\n');
    process.exit(0);
  })
  .catch(err => {
    console.error('\n======================================================');
    console.error('ERROR: Failed to connect to MongoDB!');
    console.error('======================================================');
    console.error('Please verify that MongoDB server is installed and running locally.');
    console.error('Default connection string: mongodb://127.0.0.1:27017/glidechat');
    console.error('\nError Details:', err.message);
    process.exit(1);
  });
