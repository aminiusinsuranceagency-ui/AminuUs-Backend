// =============================================
// DEFINITIVE REMINDERS ROUTES - reminders.routes.ts
// =============================================

import { Router } from 'express';
import { RemindersController } from '../controllers/reminder.controller';

const router = Router();
const controller = new RemindersController();

/**
 * =====================
 * CRITICAL: Route order matters! More specific routes MUST come first
 * =====================
 */

// Global utility routes (no agentId needed)
router.post('/validate-phone', controller.validatePhoneNumber);

// Agent-specific routes - EXACT MATCHES first
router.get('/:agentId/statistics', controller.getReminderStatistics);
router.get('/:agentId/settings', controller.getReminderSettings);
router.put('/:agentId/settings', controller.updateReminderSettings);
router.get('/:agentId/today', controller.getTodayReminders);
router.get('/:agentId/birthdays', controller.getBirthdayReminders);
router.get('/:agentId/policy-expiries', controller.getPolicyExpiryReminders);

// Filter routes - MUST come before generic /:agentId/:reminderId
router.get('/:agentId/type/:reminderType', controller.getRemindersByType);
router.get('/:agentId/status/:status', controller.getRemindersByStatus);

// Reminder actions - MUST come before generic /:agentId/:reminderId
router.post('/:agentId/:reminderId/complete', controller.completeReminder);

// CRUD operations
router.post('/:agentId', controller.createReminder);

// Individual reminder operations - MUST come after all specific routes
router.get('/:agentId/:reminderId', controller.getReminderById);
router.put('/:agentId/:reminderId', controller.updateReminder);
router.delete('/:agentId/:reminderId', controller.deleteReminder);

// Get all reminders - MUST be LAST among /:agentId routes to avoid conflicts
router.get('/:agentId', controller.getAllReminders);

/**
 * =====================
 * Fallback routes for header-based auth (x-agent-id)
 * =====================
 */
router.get('/statistics', controller.getReminderStatistics);
router.get('/settings', controller.getReminderSettings);
router.put('/settings', controller.updateReminderSettings);
router.get('/today', controller.getTodayReminders);
router.get('/birthdays', controller.getBirthdayReminders);
router.get('/policy-expiries', controller.getPolicyExpiryReminders);
router.get('/type/:reminderType', controller.getRemindersByType);
router.get('/status/:status', controller.getRemindersByStatus);
router.post('/:reminderId/complete', controller.completeReminder);
router.post('/', controller.createReminder);
router.get('/:reminderId', controller.getReminderById);
router.put('/:reminderId', controller.updateReminder);
router.delete('/:reminderId', controller.deleteReminder);
router.get('/', controller.getAllReminders);

/**
 * =====================
 * Debug middleware (removed - let Express handle 404s naturally)
 * =====================
 */

export default router;