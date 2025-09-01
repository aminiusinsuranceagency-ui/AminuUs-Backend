// =============================================
// UPDATED REMINDERS CONTROLLER - reminders.controller.ts
// =============================================

import { Request, Response } from 'express';
import { ReminderService, ReminderStatistics } from '../services/reminder.service';
import {
    Reminder,
    ReminderSettings,
    CreateReminderRequest,
    UpdateReminderRequest,
    ReminderFilters,
    PaginatedReminderResponse,
    BirthdayReminder,
    PolicyExpiryReminder,
    PhoneValidationResult
} from '../interfaces/reminders';

export class RemindersController {
    private reminderService: ReminderService;

    constructor() {
        this.reminderService = new ReminderService();
    }

    /** Create a new reminder */
    public createReminder = async (req: Request, res: Response): Promise<void> => {
        try {
            console.log('📝 Controller: Create reminder request received:', req.body);
            
            const agentId = req.headers['x-agent-id'] as string;
            
            if (!agentId) {
                res.status(400).json({ 
                    success: false, 
                    message: 'Agent ID is required in headers' 
                });
                return;
            }

            const reminderData: CreateReminderRequest = req.body;
            
            // Validate required fields
            if (!reminderData.Title || !reminderData.ReminderType || !reminderData.ReminderDate) {
                res.status(400).json({
                    success: false,
                    message: 'Title, ReminderType, and ReminderDate are required'
                });
                return;
            }

            console.log('📝 Controller: Creating reminder with agentId:', agentId);
            
            const result = await this.reminderService.createReminder(agentId, reminderData);
            
            console.log('✅ Controller: Reminder created successfully:', result);
            
            res.status(201).json({
                success: true,
                message: 'Reminder created successfully',
                data: result
            });

        } catch (error: unknown) {
            console.error('❌ Controller: Error creating reminder:', error);
            const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
            
            res.status(500).json({
                success: false,
                message: 'Failed to create reminder',
                error: errorMessage
            });
        }
    };

    /** Get all reminders with filters and pagination */
     public getAllReminders = async (req: Request, res: Response): Promise<void> => {
        try {
            console.log('🌟 Controller: getAllReminders - Starting...');
            
            // Get agentId from URL params or headers
            const agentId = req.params.agentId || req.headers['x-agent-id'] as string;
            
            if (!agentId) {
                console.log('❌ Controller: Missing agentId');
                res.status(400).json({
                    success: false,
                    message: 'Agent ID is required'
                });
                return;
            }

            console.log('📋 Controller: AgentId:', agentId);
            console.log('📋 Controller: Query params:', req.query);

            // Map frontend query parameters to service filters
            const filters: ReminderFilters = {
                // Frontend sends PascalCase, convert to match our interface
                ReminderType: req.query.reminderType as string || req.query.ReminderType as string,
                Status: req.query.status as string || req.query.Status as string,
                Priority: req.query.priority as string || req.query.Priority as string,
                StartDate: req.query.startDate as string || req.query.StartDate as string,
                EndDate: req.query.endDate as string || req.query.EndDate as string,
                ClientId: req.query.clientId as string || req.query.ClientId as string,
                PageSize: parseInt(req.query.PageSize as string || req.query.pageSize as string || '20'),
                PageNumber: parseInt(req.query.PageNumber as string || req.query.pageNumber as string || '1')
            };

            // Remove undefined values
            Object.keys(filters).forEach(key => {
                if (filters[key as keyof ReminderFilters] === undefined || 
                    filters[key as keyof ReminderFilters] === null || 
                    filters[key as keyof ReminderFilters] === '') {
                    delete filters[key as keyof ReminderFilters];
                }
            });

            console.log('📋 Controller: Processed filters:', filters);

            const result = await this.reminderService.getAllReminders(agentId, filters);
            
            console.log('✅ Controller: getAllReminders success:', {
                totalReminders: result.reminders.length,
                totalRecords: result.totalRecords,
                currentPage: result.currentPage,
                totalPages: result.totalPages
            });

            res.status(200).json({
                success: true,
                data: result,
                message: 'Reminders retrieved successfully'
            });

        } catch (error) {
            console.error('❌ Controller: Error getting all reminders:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to retrieve reminders',
                error: error instanceof Error ? error.message : 'Unknown error'
            });
        }
    };

    /** Get reminder by ID */
 public getReminderById = async (req: Request, res: Response): Promise<void> => {
        try {
            console.log('🔍 Controller: getReminderById - Starting...');
            
            const agentId = req.params.agentId || req.headers['x-agent-id'] as string;
            const reminderId = req.params.reminderId || req.params.id;

            if (!agentId || !reminderId) {
                console.log('❌ Controller: Missing required parameters');
                res.status(400).json({
                    success: false,
                    message: 'Agent ID and Reminder ID are required'
                });
                return;
            }

            console.log('🔍 Controller: AgentId:', agentId);
            console.log('🔍 Controller: ReminderId:', reminderId);

            const reminder = await this.reminderService.getReminderById(reminderId, agentId);

            if (!reminder) {
                console.log('❌ Controller: Reminder not found');
                res.status(404).json({
                    success: false,
                    message: 'Reminder not found'
                });
                return;
            }

            console.log('✅ Controller: getReminderById success:', reminder.Title);

            res.status(200).json({
                success: true,
                data: reminder,
                message: 'Reminder retrieved successfully'
            });

        } catch (error) {
            console.error('❌ Controller: Error getting reminder:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to retrieve reminder',
                error: error instanceof Error ? error.message : 'Unknown error'
            });
        }
    };

    /** Update a reminder */
    public updateReminder = async (req: Request, res: Response): Promise<void> => {
        try {
            const agentId = req.headers['x-agent-id'] as string;
            const { reminderId } = req.params;
            
            if (!agentId) {
                res.status(400).json({ 
                    success: false, 
                    message: 'Agent ID is required in headers' 
                });
                return;
            }

            if (!reminderId) {
                res.status(400).json({
                    success: false,
                    message: 'Reminder ID is required'
                });
                return;
            }

            const updateData: UpdateReminderRequest = req.body;
            
            const result = await this.reminderService.updateReminder(reminderId, agentId, updateData);
            
            if (result.RowsAffected === 0) {
                res.status(404).json({
                    success: false,
                    message: 'Reminder not found or no changes made'
                });
                return;
            }

            res.status(200).json({
                success: true,
                message: 'Reminder updated successfully',
                data: result
            });

        } catch (error: unknown) {
            console.error('❌ Controller: Error updating reminder:', error);
            const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
            
            res.status(500).json({
                success: false,
                message: 'Failed to update reminder',
                error: errorMessage
            });
        }
    };

    /** Delete a reminder */
    public deleteReminder = async (req: Request, res: Response): Promise<void> => {
        try {
            const agentId = req.headers['x-agent-id'] as string;
            const { reminderId } = req.params;
            
            if (!agentId) {
                res.status(400).json({ 
                    success: false, 
                    message: 'Agent ID is required in headers' 
                });
                return;
            }

            if (!reminderId) {
                res.status(400).json({
                    success: false,
                    message: 'Reminder ID is required'
                });
                return;
            }

            const result = await this.reminderService.deleteReminder(reminderId, agentId);
            
            if (result.RowsAffected === 0) {
                res.status(404).json({
                    success: false,
                    message: 'Reminder not found'
                });
                return;
            }

            res.status(200).json({
                success: true,
                message: 'Reminder deleted successfully',
                data: result
            });

        } catch (error: unknown) {
            console.error('❌ Controller: Error deleting reminder:', error);
            const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
            
            res.status(500).json({
                success: false,
                message: 'Failed to delete reminder',
                error: errorMessage
            });
        }
    };

    /** Complete a reminder */
    public completeReminder = async (req: Request, res: Response): Promise<void> => {
        try {
            const agentId = req.headers['x-agent-id'] as string;
            const { reminderId } = req.params;
            const { notes } = req.body;
            
            if (!agentId) {
                res.status(400).json({ 
                    success: false, 
                    message: 'Agent ID is required in headers' 
                });
                return;
            }

            if (!reminderId) {
                res.status(400).json({
                    success: false,
                    message: 'Reminder ID is required'
                });
                return;
            }

            const result = await this.reminderService.completeReminder(reminderId, agentId, notes);
            
            if (result.RowsAffected === 0) {
                res.status(404).json({
                    success: false,
                    message: 'Reminder not found'
                });
                return;
            }

            res.status(200).json({
                success: true,
                message: 'Reminder completed successfully',
                data: result
            });

        } catch (error: unknown) {
            console.error('❌ Controller: Error completing reminder:', error);
            const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
            
            res.status(500).json({
                success: false,
                message: 'Failed to complete reminder',
                error: errorMessage
            });
        }
    };

    /** Get today's reminders */
   public getTodayReminders = async (req: Request, res: Response): Promise<void> => {
    try {
        const agentId = req.headers['x-agent-id'] as string;
        
        if (!agentId) {
            res.status(400).json({
                success: false,
                message: 'Agent ID is required in headers (x-agent-id)'
            });
            return;
        }

        console.log(`🔍 Getting today's reminders for agent: ${agentId}`);
        const reminders: Reminder[] = await this.reminderService.getTodayReminders(agentId);
        
        res.status(200).json({
            success: true,
            message: 'Today\'s reminders retrieved successfully',
            data: reminders,
            count: reminders.length
        });
        
    } catch (error: unknown) {
        console.error('❌ Controller: Error getting today\'s reminders:', error);
        const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
        
        res.status(500).json({
            success: false,
            message: 'Failed to retrieve today\'s reminders',
            error: errorMessage
        });
    }
};

    /** Get reminder settings */
    public getReminderSettings = async (req: Request, res: Response): Promise<void> => {
        try {
            const agentId = req.headers['x-agent-id'] as string;
            
            if (!agentId) {
                res.status(400).json({ 
                    success: false, 
                    message: 'Agent ID is required in headers' 
                });
                return;
            }

            const settings: ReminderSettings[] = await this.reminderService.getReminderSettings(agentId);
            
            res.status(200).json({
                success: true,
                message: 'Reminder settings retrieved successfully',
                data: settings
            });

        } catch (error: unknown) {
            console.error('❌ Controller: Error getting reminder settings:', error);
            const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
            
            res.status(500).json({
                success: false,
                message: 'Failed to retrieve reminder settings',
                error: errorMessage
            });
        }
    };

    /** Update reminder settings */
    public updateReminderSettings = async (req: Request, res: Response): Promise<void> => {
        try {
            const agentId = req.headers['x-agent-id'] as string;
            
            if (!agentId) {
                res.status(400).json({ 
                    success: false, 
                    message: 'Agent ID is required in headers' 
                });
                return;
            }

            const settings: ReminderSettings = req.body;
            
            // Validate required fields
            if (!settings.ReminderType || typeof settings.IsEnabled !== 'boolean') {
                res.status(400).json({
                    success: false,
                    message: 'ReminderType and IsEnabled are required'
                });
                return;
            }

            await this.reminderService.updateReminderSettings(agentId, settings);
            
            res.status(200).json({
                success: true,
                message: 'Reminder settings updated successfully'
            });

        } catch (error: unknown) {
            console.error('❌ Controller: Error updating reminder settings:', error);
            const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
            
            res.status(500).json({
                success: false,
                message: 'Failed to update reminder settings',
                error: errorMessage
            });
        }
    };

    /** Get reminder statistics */
    public getReminderStatistics = async (req: Request, res: Response): Promise<void> => {
        try {
            const agentId = req.headers['x-agent-id'] as string;
            
            if (!agentId) {
                res.status(400).json({ 
                    success: false, 
                    message: 'Agent ID is required in headers' 
                });
                return;
            }

            const statistics: ReminderStatistics = await this.reminderService.getReminderStatistics(agentId);
            
            res.status(200).json({
                success: true,
                message: 'Reminder statistics retrieved successfully',
                data: statistics
            });

        } catch (error: unknown) {
            console.error('❌ Controller: Error getting reminder statistics:', error);
            const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
            
            res.status(500).json({
                success: false,
                message: 'Failed to retrieve reminder statistics',
                error: errorMessage
            });
        }
    };

    /** Get reminders by type */
    public getRemindersByType = async (req: Request, res: Response): Promise<void> => {
        try {
            const agentId = req.headers['x-agent-id'] as string;
            const { reminderType } = req.params;
            
            if (!agentId) {
                res.status(400).json({ 
                    success: false, 
                    message: 'Agent ID is required in headers' 
                });
                return;
            }

            if (!reminderType) {
                res.status(400).json({
                    success: false,
                    message: 'Reminder type is required'
                });
                return;
            }

            const reminders: Reminder[] = await this.reminderService.getRemindersByType(agentId, reminderType);
            
            res.status(200).json({
                success: true,
                message: `Reminders of type '${reminderType}' retrieved successfully`,
                data: reminders
            });

        } catch (error: unknown) {
            console.error('❌ Controller: Error getting reminders by type:', error);
            const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
            
            res.status(500).json({
                success: false,
                message: 'Failed to retrieve reminders by type',
                error: errorMessage
            });
        }
    };

    /** Get reminders by status */
    public getRemindersByStatus = async (req: Request, res: Response): Promise<void> => {
        try {
            const agentId = req.headers['x-agent-id'] as string;
            const { status } = req.params;
            
            if (!agentId) {
                res.status(400).json({ 
                    success: false, 
                    message: 'Agent ID is required in headers' 
                });
                return;
            }

            if (!status) {
                res.status(400).json({
                    success: false,
                    message: 'Status is required'
                });
                return;
            }

            const reminders: Reminder[] = await this.reminderService.getRemindersByStatus(agentId, status);
            
            res.status(200).json({
                success: true,
                message: `Reminders with status '${status}' retrieved successfully`,
                data: reminders
            });

        } catch (error: unknown) {
            console.error('❌ Controller: Error getting reminders by status:', error);
            const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
            
            res.status(500).json({
                success: false,
                message: 'Failed to retrieve reminders by status',
                error: errorMessage
            });
        }
    };

    /** Get birthday reminders */
    public getBirthdayReminders = async (req: Request, res: Response): Promise<void> => {
    try {
        const agentId = req.headers['x-agent-id'] as string;
        
        if (!agentId) {
            res.status(400).json({
                success: false,
                message: 'Agent ID is required in headers (x-agent-id)'
            });
            return;
        }

        console.log(`🎂 Getting birthday reminders for agent: ${agentId}`);
        const birthdayReminders: BirthdayReminder[] = await this.reminderService.getBirthdayReminders(agentId);
        
        res.status(200).json({
            success: true,
            message: 'Birthday reminders retrieved successfully',
            data: birthdayReminders,
            count: birthdayReminders.length
        });
        
    } catch (error: unknown) {
        console.error('❌ Controller: Error getting birthday reminders:', error);
        const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
        
        res.status(500).json({
            success: false,
            message: 'Failed to retrieve birthday reminders',
            error: errorMessage
        });
    }
};

/** Get policy expiry reminders */
public getPolicyExpiryReminders = async (req: Request, res: Response): Promise<void> => {
    try {
        const agentId = req.headers['x-agent-id'] as string;
        const daysAhead = req.query.daysAhead ? parseInt(req.query.daysAhead as string) : 30;
        
        if (!agentId) {
            res.status(400).json({
                success: false,
                message: 'Agent ID is required in headers (x-agent-id)'
            });
            return;
        }

        // Validate daysAhead parameter
        if (isNaN(daysAhead) || daysAhead < 1 || daysAhead > 365) {
            res.status(400).json({
                success: false,
                message: 'daysAhead must be a valid number between 1 and 365'
            });
            return;
        }

        console.log(`📋 Getting policy expiry reminders for agent: ${agentId}, daysAhead: ${daysAhead}`);
        const policyReminders: PolicyExpiryReminder[] = await this.reminderService.getPolicyExpiryReminders(agentId, daysAhead);
        
        res.status(200).json({
            success: true,
            message: 'Policy expiry reminders retrieved successfully',
            data: policyReminders,
            count: policyReminders.length,
            daysAhead: daysAhead
        });
        
    } catch (error: unknown) {
        console.error('❌ Controller: Error getting policy expiry reminders:', error);
        const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
        
        res.status(500).json({
            success: false,
            message: 'Failed to retrieve policy expiry reminders',
            error: errorMessage
        });
    }
};
    /** Validate phone number */
    public validatePhoneNumber = async (req: Request, res: Response): Promise<void> => {
        try {
            const { phoneNumber, countryCode } = req.body;
            
            if (!phoneNumber) {
                res.status(400).json({
                    success: false,
                    message: 'Phone number is required'
                });
                return;
            }

            const validationResult: PhoneValidationResult = await this.reminderService.validatePhoneNumber(
                phoneNumber, 
                countryCode || '+254'
            );
            
            res.status(200).json({
                success: true,
                message: 'Phone number validation completed',
                data: validationResult
            });

        } catch (error: unknown) {
            console.error('❌ Controller: Error validating phone number:', error);
            const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
            
            res.status(500).json({
                success: false,
                message: 'Failed to validate phone number',
                error: errorMessage
            });
        }
    };
}