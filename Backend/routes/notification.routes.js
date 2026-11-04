const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const authMiddleware = require('../middlewares/auth.middleware');
const notificationController = require('../controllers/notification.controller');

const tokenBody = body('token').isString().isLength({ min: 20, max: 4096 }).withMessage('Invalid device token');

router.get('/push-config', notificationController.getPushConfig)

router.post('/push-token', authMiddleware.authUserOrCaptain, tokenBody, notificationController.savePushToken)

router.delete('/push-token', authMiddleware.authUserOrCaptain, tokenBody, notificationController.removePushToken)

module.exports = router;
