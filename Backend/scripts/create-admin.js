// Creates an admin, or resets the password of an existing one.
// Usage: npm run create-admin -- <email> <password> [full name]
require('dotenv').config();
const mongoose = require('mongoose');
const adminModel = require('../models/admin.model');

async function main() {
    const [ email, password, fullname = 'Admin' ] = process.argv.slice(2);
    if (!email || !password || password.length < 8) {
        console.log('Usage: npm run create-admin -- <email> <password (min 8 chars)> [full name]');
        process.exit(1);
    }

    await mongoose.connect(process.env.MONGODB_URI);
    const hashedPassword = await adminModel.hashPassword(password);
    await adminModel.findOneAndUpdate(
        { email: email.toLowerCase().trim() },
        { fullname, password: hashedPassword },
        { upsert: true }
    );
    console.log(`Admin ${email.toLowerCase().trim()} saved`);
    await mongoose.disconnect();
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});
