// =============================================
// UPDATED REMINDERS ROUTES - reminders.routes.ts
// =============================================

import { Router } from 'express';
import { RemindersController } from '../controllers/reminder.controller';

const router = Router();
const controller = new RemindersController();

/**
 * =====================
 * SPECIFIC ROUTES FIRST (to avoid conflicts with parameterized routes)
 * =====================
 */

// Statistics route - must come before /:reminderId
router.get('/statistics', controller.getReminderStatistics);

// Settings routes - must come before /:reminderId
router.get('/settings', controller.getReminderSettings);
router.put('/settings', controller.updateReminderSettings);

// Today's reminders - specific route
router.get('/today', controller.getTodayReminders);

// Birthday reminders route
router.get('/birthdays', controller.getBirthdayReminders);

// Policy expiry reminders route
router.get('/policy-expiries', controller.getPolicyExpiryReminders);

// Phone validation route
router.post('/validate-phone', controller.validatePhoneNumber);

// Filter routes - must come before /:reminderId
router.get('/type/:reminderType', controller.getRemindersByType);
router.get('/status/:status', controller.getRemindersByStatus);

/**
 * =====================
 * Reminder CRUD (General parameterized routes come AFTER specific ones)
 * =====================
 */

// Create reminder
router.post('/', controller.createReminder);

// Get all reminders (this is safe as it doesn't have additional params)
router.get('/', controller.getAllReminders);

// Complete reminder - specific action before general /:reminderId route
router.post('/:reminderId/complete', controller.completeReminder);

// Individual reminder CRUD - THESE MUST COME LAST due to the parameterized nature
router.get('/:reminderId', controller.getReminderById);
router.put('/:reminderId', controller.updateReminder);
router.delete('/:reminderId', controller.deleteReminder);

/**
 * =====================
 * Middleware for request logging (optional)
 * =====================
 */

// Log all reminder routes for debugging
router.use((req, res, next) => {
    console.log(`🛣️ Reminder Route: ${req.method} ${req.originalUrl}`);
    console.log(`🛣️ Headers:`, req.headers);
    console.log(`🛣️ Params:`, req.params);
    console.log(`🛣️ Query:`, req.query);
    next();
});

export default router;
