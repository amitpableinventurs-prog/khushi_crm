const dotenv = require('dotenv');
dotenv.config();
const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const connectToDb = require('./db/db');
const userRoutes = require('./routes/user.routes');
const captainRoutes = require('./routes/captain.routes');
const mapsRoutes = require('./routes/maps.routes');
const rideRoutes = require('./routes/ride.routes');
const adminRoutes = require('./routes/admin.routes');
const paymentRoutes = require('./routes/payment.routes');
const notificationRoutes = require('./routes/notification.routes');
const paymentController = require('./controllers/payment.controller');

const app = express();

// Middleware to ensure DB connection is ready on serverless calls
app.use(async (req, res, next) => {
    try {
        await connectToDb();
    } catch (err) {
        console.error('DB connect middleware error:', err);
    }
    next();
});

app.use(cors());
// Razorpay signs the raw body, so this must run before express.json()
app.post('/payments/webhook', express.raw({ type: 'application/json', limit: '1mb' }), paymentController.webhook);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

app.get('/', (req, res) => {
    res.status(200).send('Uber Clone API is active and running');
});

app.use('/users', userRoutes);
app.use('/captains', captainRoutes);
app.use('/maps', mapsRoutes);
app.use('/rides', rideRoutes);
app.use('/admin', adminRoutes);
app.use('/payments', paymentRoutes);
app.use('/notifications', notificationRoutes);

module.exports = app;
