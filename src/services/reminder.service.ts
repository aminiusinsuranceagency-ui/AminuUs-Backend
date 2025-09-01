// =============================================
// UPDATED BACKEND SERVICE - reminders.service.ts
// =============================================

import { Pool } from 'pg';
import { poolPromise } from '../../db';
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

export interface ReminderStatistics {
    TotalActive: number;
    TotalCompleted: number;
    TodayReminders: number;
    UpcomingReminders: number;
    HighPriority: number;
    Overdue: number;
}

export class ReminderService {
    /** Create a new reminder */
    public async createReminder(agentId: string, reminderData: CreateReminderRequest): Promise<{ ReminderId: string }> {
        console.log('📝 Backend: Creating reminder with raw data:', reminderData);
        
        try {
            let validatedTime: string | null = null;
            
            if (reminderData.ReminderTime) {
                validatedTime = this.validateAndFormatPostgreSQLTime(reminderData.ReminderTime);
                console.log('📝 Backend: Time validated:', reminderData.ReminderTime, '->', validatedTime);
            }
            
            const pool = await poolPromise as Pool;
            const client = await pool.connect();
            
            try {
                const query = `
                    SELECT sp_create_reminder(
                        $1::uuid, $2::uuid, $3::uuid, $4::varchar(50), $5::varchar(200),
                        $6::text, $7::date, $8::time, $9::varchar(150), $10::varchar(10),
                        $11::boolean, $12::boolean, $13::boolean, $14::varchar(20),
                        $15::text, $16::boolean, $17::text
                    ) as reminder_id
                `;
                
                const values = [
                    agentId,
                    reminderData.ClientId || null,
                    reminderData.AppointmentId || null,
                    reminderData.ReminderType,
                    reminderData.Title,
                    reminderData.Description || null,
                    reminderData.ReminderDate,
                    validatedTime,
                    reminderData.ClientName || null,
                    reminderData.Priority || 'Medium',
                    reminderData.EnableSMS || false,
                    reminderData.EnableWhatsApp || false,
                    reminderData.EnablePushNotification || true,
                    reminderData.AdvanceNotice || '1 day',
                    reminderData.CustomMessage || null,
                    reminderData.AutoSend || false,
                    reminderData.Notes || null
                ];

                console.log('📝 Backend: Executing query with validated time:', validatedTime);
                
                const result = await client.query(query, values);
                
                console.log('✅ Backend: Reminder created successfully');
                return { ReminderId: result.rows[0].reminder_id };
                
            } finally {
                client.release();
            }
            
        } catch (error: unknown) {
            console.error('❌ Backend: Error creating reminder:', error);
            console.error('❌ Original reminder data:', reminderData);
            
            const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
            throw new Error(`Failed to create reminder: ${errorMessage}`);
        }
    }

    /** Get all reminders with filters and pagination */
public async getAllReminders(agentId: string, filters: ReminderFilters = {}): Promise<PaginatedReminderResponse> {
        const pool = await poolPromise as Pool;
        const client = await pool.connect();
        
        try {
            console.log('🔍 ReminderService.getAllReminders - Starting...');
            console.log('🔍 AgentId:', agentId);
            console.log('🔍 Filters:', filters);

            // Determine which function to use based on filters
            const hasFilters = filters.ReminderType || 
                              filters.Status || 
                              filters.Priority || 
                              filters.ClientId;

            let query: string;
            let values: any[];

            if (hasFilters) {
                // Use filtered function when filters are applied
                query = `
                    SELECT * FROM sp_get_all_reminders_with_filters(
                        $1::uuid, $2::varchar, $3::varchar, $4::varchar, 
                        $5::date, $6::date, $7::uuid, $8::integer, $9::integer
                    )
                `;
                
                values = [
                    agentId,
                    filters.ReminderType || null,
                    filters.Status || null,
                    filters.Priority || null,
                    filters.StartDate || null,
                    filters.EndDate || null,
                    filters.ClientId || null,
                    filters.PageNumber || 1,
                    filters.PageSize || 20
                ];
            } else {
                // Use simple function when no filters
                query = `
                    SELECT * FROM sp_get_all_reminders(
                        $1::uuid, $2::date, $3::date, $4::integer, $5::integer
                    )
                `;
                
                values = [
                    agentId,
                    filters.StartDate || null,
                    filters.EndDate || null,
                    filters.PageNumber || 1,
                    filters.PageSize || 20
                ];
            }

            console.log('🔍 Executing query:', query);
            console.log('🔍 Query values:', values);

            const result = await client.query(query, values);
            console.log('✅ Query executed successfully, rows:', result.rows.length);

            // Map database results to frontend-compatible format
            const reminders: Reminder[] = result.rows.map(row => this.mapDatabaseRowToReminder(row));
            const pageSize = filters.PageSize || 20;
            const currentPage = filters.PageNumber || 1;

            let totalRecords = 0;
            if (hasFilters && result.rows.length > 0) {
                // Get total records from the filtered function result
                totalRecords = parseInt(result.rows[0].total_records) || 0;
            } else if (!hasFilters) {
                // Get total count for non-filtered results
                const countQuery = `
                    WITH all_reminders_count AS (
                        SELECT COUNT(*) as count FROM reminders WHERE agent_id = $1
                        UNION ALL
                        SELECT COUNT(*) FROM client_policies cp
                        INNER JOIN clients c ON c.client_id = cp.client_id
                        WHERE c.agent_id = $1 AND cp.is_active = TRUE 
                        AND cp.end_date BETWEEN CURRENT_DATE AND (CURRENT_DATE + INTERVAL '30 days')
                        UNION ALL
                        SELECT COUNT(*) FROM clients c
                        WHERE c.agent_id = $1 AND c.is_active = TRUE 
                        AND c.date_of_birth IS NOT NULL
                        AND (
                            CASE
                                WHEN EXTRACT(MONTH FROM c.date_of_birth)::INT = 2
                                     AND EXTRACT(DAY FROM c.date_of_birth)::INT = 29
                                     AND NOT ( (EXTRACT(YEAR FROM CURRENT_DATE)::INT % 400 = 0) OR (EXTRACT(YEAR FROM CURRENT_DATE)::INT % 4 = 0 AND EXTRACT(YEAR FROM CURRENT_DATE)::INT % 100 != 0) )
                                THEN make_date(EXTRACT(YEAR FROM CURRENT_DATE)::INT, 2, 28)
                                ELSE make_date(EXTRACT(YEAR FROM CURRENT_DATE)::INT, EXTRACT(MONTH FROM c.date_of_birth)::INT, EXTRACT(DAY FROM c.date_of_birth)::INT)
                            END
                        ) BETWEEN CURRENT_DATE AND (CURRENT_DATE + INTERVAL '7 days')
                        UNION ALL
                        SELECT COUNT(*) FROM appointments a
                        WHERE a.agent_id = $1 AND a.is_active = TRUE
                    )
                    SELECT SUM(count) as total FROM all_reminders_count
                `;
                const countResult = await client.query(countQuery, [agentId]);
                totalRecords = parseInt(countResult.rows[0]?.total) || 0;
            } else {
                totalRecords = reminders.length;
            }

            const response: PaginatedReminderResponse = {
                reminders,
                totalRecords,
                currentPage,
                totalPages: Math.ceil(totalRecords / pageSize),
                pageSize
            };

            console.log('✅ getAllReminders completed:', {
                totalReminders: reminders.length,
                totalRecords,
                currentPage,
                totalPages: response.totalPages
            });

            return response;

        } catch (error) {
            console.error('❌ ReminderService.getAllReminders - Error:', error);
            throw error;
        } finally {
            client.release();
        }
    }

    /** Get reminder by ID - FIXED to match frontend expectations */
    public async getReminderById(reminderId: string, agentId: string): Promise<Reminder | null> {
        const pool = await poolPromise as Pool;
        const client = await pool.connect();
        
        try {
            console.log('🔍 ReminderService.getReminderById - Starting...');
            console.log('🔍 ReminderId:', reminderId);
            console.log('🔍 AgentId:', agentId);

            const query = `
                SELECT * FROM sp_get_reminder_by_id($1::uuid, $2::uuid)
            `;
            
            const result = await client.query(query, [reminderId, agentId]);
            
            if (result.rows.length === 0) {
                console.log('ℹ️ No reminder found for ID:', reminderId);
                return null;
            }
            
            const reminder = this.mapDatabaseRowToReminder(result.rows[0]);
            console.log('✅ getReminderById completed:', reminder.Title);
            
            return reminder;

        } catch (error) {
            console.error('❌ ReminderService.getReminderById - Error:', error);
            throw error;
        } finally {
            client.release();
        }
    }

    /** Update a reminder */
    public async updateReminder(reminderId: string, agentId: string, updateData: UpdateReminderRequest): Promise<{ RowsAffected: number }> {
        const pool = await poolPromise as Pool;
        const client = await pool.connect();
        
        try {
            let validatedTime: string | null = null;
            if (updateData.ReminderTime) {
                validatedTime = this.validateAndFormatPostgreSQLTime(updateData.ReminderTime);
            }
            
            const query = `
                SELECT sp_update_reminder(
                    $1::uuid, $2::uuid, $3::varchar(200), $4::text, $5::date,
                    $6::time, $7::varchar(10), $8::varchar(20), $9::boolean,
                    $10::boolean, $11::boolean, $12::varchar(20), $13::text,
                    $14::boolean, $15::text
                ) as rows_affected
            `;
            
            const values = [
                reminderId,
                agentId,
                updateData.Title || null,
                updateData.Description || null,
                updateData.ReminderDate || null,
                validatedTime,
                updateData.Priority || null,
                updateData.Status || null,
                updateData.EnableSMS || null,
                updateData.EnableWhatsApp || null,
                updateData.EnablePushNotification || null,
                updateData.AdvanceNotice || null,
                updateData.CustomMessage || null,
                updateData.AutoSend || null,
                updateData.Notes || null
            ];
            
            const result = await client.query(query, values);
            return { RowsAffected: result.rows[0].rows_affected };
        } finally {
            client.release();
        }
    }

    /** Delete a reminder */
    public async deleteReminder(reminderId: string, agentId: string): Promise<{ RowsAffected: number }> {
        const pool = await poolPromise as Pool;
        const client = await pool.connect();
        
        try {
            const query = `
                SELECT sp_delete_reminder($1::uuid, $2::uuid) as rows_affected
            `;
            
            const result = await client.query(query, [reminderId, agentId]);
            return { RowsAffected: result.rows[0].rows_affected };
        } finally {
            client.release();
        }
    }

    /** Complete a reminder */
    public async completeReminder(reminderId: string, agentId: string, notes?: string): Promise<{ RowsAffected: number }> {
        const pool = await poolPromise as Pool;
        const client = await pool.connect();
        
        try {
            const query = `
                SELECT sp_complete_reminder($1::uuid, $2::uuid, $3::text) as rows_affected
            `;
            
            const result = await client.query(query, [reminderId, agentId, notes || null]);
            return { RowsAffected: result.rows[0].rows_affected };
        } finally {
            client.release();
        }
    }

    /** Get today's reminders */
/** Get today's reminders - Using new safe stored procedure */
public async getTodayReminders(agentId: string): Promise<Reminder[]> {
    const pool = await poolPromise as Pool;
    const client = await pool.connect();
    
    try {
        // Option 1: Try the new stored procedure with computed fields
        try {
            const query = `
                SELECT 
                    reminder_id,
                    client_id,
                    appointment_id,
                    agent_id,
                    reminder_type,
                    title,
                    description,
                    reminder_date,
                    reminder_time,
                    client_name,
                    priority,
                    status,
                    enable_sms,
                    enable_whatsapp,
                    enable_push_notification,
                    advance_notice,
                    custom_message,
                    auto_send,
                    notes,
                    created_date,
                    modified_date,
                    completed_date,
                    client_phone,
                    client_email,
                    full_client_name
                FROM sp_get_today_reminders_v2($1::uuid)
            `;
            
            const result = await client.query(query, [agentId]);
            return result.rows.map(row => this.mapDatabaseRowToReminder(row));
            
        } catch (spError) {
            console.warn('⚠️ V2 stored procedure failed, trying direct approach:', spError);
            
            // Option 2: Use the direct table query stored procedure
            const directQuery = `
                SELECT 
                    reminder_id,
                    client_id,
                    appointment_id,
                    agent_id,
                    reminder_type,
                    title,
                    description,
                    reminder_date,
                    reminder_time,
                    client_name,
                    priority,
                    status,
                    enable_sms,
                    enable_whatsapp,
                    enable_push_notification,
                    advance_notice,
                    custom_message,
                    auto_send,
                    notes,
                    created_date,
                    modified_date,
                    completed_date
                FROM sp_get_today_reminders_direct($1::uuid)
            `;
            
            const directResult = await client.query(directQuery, [agentId]);
            
            // Get client info separately for the computed fields
            return directResult.rows.map(row => {
                const mappedReminder = this.mapDatabaseRowToReminder(row);
                // Add empty computed fields for now
                return {
                    ...mappedReminder,
                    client_phone: '',
                    client_email: '',
                    full_client_name: row.client_name || ''
                };
            });
        }
        
    } catch (error) {
        console.error('❌ Error in getTodayReminders:', error);
        throw error;
    } finally {
        client.release();
    }
}



    /** Get reminder settings - FIXED mapping */
    public async getReminderSettings(agentId: string): Promise<ReminderSettings[]> {
        const pool = await poolPromise as Pool;
        const client = await pool.connect();
        
        try {
            const query = `
                SELECT * FROM sp_get_reminder_settings($1::uuid)
            `;
            
            const result = await client.query(query, [agentId]);
            return result.rows.map(row => this.mapDatabaseRowToReminderSettings(row));
        } finally {
            client.release();
        }
    }

    /** Update reminder settings - FIXED to accept ReminderSettings object */
    public async updateReminderSettings(agentId: string, settings: ReminderSettings): Promise<void> {
        const pool = await poolPromise as Pool;
        const client = await pool.connect();
        
        try {
            const query = `
                SELECT sp_update_reminder_settings(
                    $1::uuid, $2::varchar(50), $3::boolean, $4::integer, $5::time, $6::boolean
                )
            `;
            
            await client.query(query, [
                agentId, 
                settings.ReminderType, 
                settings.IsEnabled, 
                settings.DaysBefore, 
                settings.TimeOfDay, 
                settings.RepeatDaily
            ]);
        } finally {
            client.release();
        }
    }

    /** Get reminder statistics - FIXED return type */
    public async getReminderStatistics(agentId: string): Promise<ReminderStatistics> {
        try {
            const pool = await poolPromise as Pool;
            const client = await pool.connect();
            
            try {
                const query = `
                    SELECT * FROM sp_get_reminder_statistics($1::uuid)
                `;
                
                const result = await client.query(query, [agentId]);

                if (result.rows.length === 0) {
                    return {
                        TotalActive: 0,
                        TotalCompleted: 0,
                        TodayReminders: 0,
                        UpcomingReminders: 0,
                        HighPriority: 0,
                        Overdue: 0
                    };
                }

                const row = result.rows[0];
                return {
                    TotalActive: parseInt(row.total_active) || 0,
                    TotalCompleted: parseInt(row.total_completed) || 0,
                    TodayReminders: parseInt(row.today_reminders) || 0,
                    UpcomingReminders: parseInt(row.upcoming_reminders) || 0,
                    HighPriority: parseInt(row.high_priority) || 0,
                    Overdue: parseInt(row.overdue) || 0
                };
            } finally {
                client.release();
            }
        } catch (error: unknown) {
            console.error('Error fetching reminder statistics:', error);
            throw error;
        }
    }

    /** Get reminders filtered by ReminderType */
    async getRemindersByType(agentId: string, reminderType: string): Promise<Reminder[]> {
        try {
            const pool = await poolPromise as Pool;
            const client = await pool.connect();
            
            try {
                const query = `
                    SELECT * FROM sp_get_reminders_by_type($1::uuid, $2::varchar(50))
                `;
                
                const result = await client.query(query, [agentId, reminderType]);
                return result.rows.map(row => this.mapDatabaseRowToReminder(row));
            } finally {
                client.release();
            }
        } catch (error: unknown) {
            console.error('Error fetching reminders by type:', error);
            throw error;
        }
    }

    /** Get reminders filtered by Status */
    async getRemindersByStatus(agentId: string, status: string): Promise<Reminder[]> {
        try {
            const pool = await poolPromise as Pool;
            const client = await pool.connect();
            
            try {
                const query = `
                    SELECT * FROM sp_get_reminders_by_status($1::uuid, $2::varchar(20))
                `;
                
                const result = await client.query(query, [agentId, status]);
                return result.rows.map(row => this.mapDatabaseRowToReminder(row));
            } finally {
                client.release();
            }
        } catch (error: unknown) {
            console.error('Error fetching reminders by status:', error);
            throw error;
        }
    }

    /** Get birthday reminders - FIXED mapping */
   /** Get birthday reminders - UPDATED to match SP return type */
public async getBirthdayReminders(agentId: string): Promise<BirthdayReminder[]> {
    const pool = await poolPromise as Pool;
    const client = await pool.connect();
    
    try {
        const query = `
            SELECT 
                client_id,
                first_name,
                last_name,
                phone,
                email,
                date_of_birth,
                age
            FROM sp_get_today_birthday_reminders($1::uuid)
        `;
        
        const result = await client.query(query, [agentId]);
        return result.rows.map(row => ({
            ClientId: row.client_id,
            FirstName: row.first_name,
            Surname: row.last_name,  // Using last_name for Surname
            LastName: row.last_name, // Frontend expects both Surname and LastName
            PhoneNumber: row.phone,
            Email: row.email,
            DateOfBirth: this.formatDateToISOString(row.date_of_birth),
            Age: row.age
        }));
    } finally {
        client.release();
    }
}

/** Get policy expiry reminders - UPDATED to match SP return type */
public async getPolicyExpiryReminders(agentId: string, daysAhead: number = 30): Promise<PolicyExpiryReminder[]> {
    const pool = await poolPromise as Pool;
    const client = await pool.connect();
    
    try {
        const query = `
            SELECT 
                policy_id,
                client_id,
                policy_name,
                policy_type,
                company_name,
                end_date,
                first_name,
                last_name,
                phone,
                email,
                days_until_expiry
            FROM sp_get_policy_expiry_reminders($1::uuid, $2::integer)
        `;
        
        const result = await client.query(query, [agentId, daysAhead]);
        return result.rows.map(row => ({
            PolicyId: row.policy_id,
            ClientId: row.client_id,
            PolicyName: row.policy_name,
            PolicyType: row.policy_type,
            CompanyName: row.company_name,
            EndDate: this.formatDateToISOString(row.end_date),
            FirstName: row.first_name,
            Surname: row.last_name,  // Using last_name for Surname
            PhoneNumber: row.phone,
            Email: row.email,
            DaysUntilExpiry: row.days_until_expiry
        }));
    } finally {
        client.release();
    }
}

    /** Validate phone number */
    public async validatePhoneNumber(phoneNumber: string, countryCode: string = '+254'): Promise<PhoneValidationResult> {
        const pool = await poolPromise as Pool;
        const client = await pool.connect();
        
        try {
            const query = `
                SELECT * FROM sp_validate_phone_number($1::varchar(50), $2::varchar(5))
            `;
            
            const result = await client.query(query, [phoneNumber, countryCode]);
            const row = result.rows[0];
            
            return {
                IsValid: row.is_valid,
                FormattedNumber: row.formatted_number,
                ValidationMessage: row.validation_message
            };
        } finally {
            client.release();
        }
    }

    // PostgreSQL time validation method - UNCHANGED
    private validateAndFormatPostgreSQLTime(timeString: string | null | undefined): string | null {
        console.log('🕐 Backend: Validating PostgreSQL time:', timeString, typeof timeString);
        
        if (!timeString || timeString === 'null' || timeString === 'undefined') {
            console.log('🕐 Backend: No valid time provided, returning null');
            return null;
        }
        
        let cleanTime = timeString.toString().trim();
        console.log('🕐 Backend: Cleaned time:', cleanTime);
        
        try {
            // Format 1: Already HH:MM:SS
            if (/^\d{2}:\d{2}:\d{2}$/.test(cleanTime)) {
                const [h, m, s] = cleanTime.split(':').map(Number);
                if (h >= 0 && h <= 23 && m >= 0 && m <= 59 && s >= 0 && s <= 59) {
                    console.log('🕐 Backend: Valid HH:MM:SS format');
                    return cleanTime;
                }
                throw new Error('Invalid time ranges');
            }
            
            // Format 2: HH:MM
            if (/^\d{1,2}:\d{2}$/.test(cleanTime)) {
                const [h, m] = cleanTime.split(':').map(Number);
                if (h >= 0 && h <= 23 && m >= 0 && m <= 59) {
                    const formatted = `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:00`;
                    console.log('🕐 Backend: Converted HH:MM to HH:MM:SS:', cleanTime, '->', formatted);
                    return formatted;
                }
                throw new Error('Invalid time ranges for HH:MM');
            }
            
            // Format 3: Try parsing as ISO datetime and extract time
            if (cleanTime.includes('T') || cleanTime.includes('-')) {
                const date = new Date(cleanTime);
                if (!isNaN(date.getTime())) {
                    const hours = date.getUTCHours().toString().padStart(2, '0');
                    const minutes = date.getUTCMinutes().toString().padStart(2, '0');
                    const seconds = date.getUTCSeconds().toString().padStart(2, '0');
                    const formatted = `${hours}:${minutes}:${seconds}`;
                    console.log('🕐 Backend: Extracted time from datetime:', cleanTime, '->', formatted);
                    return formatted;
                }
            }
            
            // Format 4: Try creating a date with the time
            const testDate = new Date(`1970-01-01T${cleanTime}`);
            if (!isNaN(testDate.getTime())) {
                const hours = testDate.getUTCHours().toString().padStart(2, '0');
                const minutes = testDate.getUTCMinutes().toString().padStart(2, '0');
                const seconds = testDate.getUTCSeconds().toString().padStart(2, '0');
                const formatted = `${hours}:${minutes}:${seconds}`;
                console.log('🕐 Backend: Parsed with date constructor:', cleanTime, '->', formatted);
                return formatted;
            }
            
            throw new Error(`Cannot parse time format: ${cleanTime}`);
            
        } catch (error: unknown) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown validation error';
            console.error('🕐 Backend: Time validation failed:', errorMessage);
            console.error('🕐 Backend: Original input was:', timeString);
            
            console.log('🕐 Backend: Returning null due to validation failure');
            return null;
        }
    }

    /** UPDATED: Map database row to Reminder object with PROPER CASING and ALL frontend fields */
    private mapDatabaseRowToReminder(row: any): Reminder {
        return {
            ReminderId: row.reminder_id,
            ClientId: row.client_id,
            AppointmentId: row.appointment_id,
            AgentId: row.agent_id,
            ReminderType: row.reminder_type,
            Title: row.title,
            Description: row.description,
            ReminderDate: this.formatDateToISOString(row.reminder_date),
            ReminderTime: row.reminder_time,
            ClientName: row.client_name,
            Priority: row.priority,
            Status: row.status,
            EnableSMS: row.enable_sms,
            EnableWhatsApp: row.enable_whatsapp,
            EnablePushNotification: row.enable_push_notification,
            AdvanceNotice: row.advance_notice,
            CustomMessage: row.custom_message,
            AutoSend: row.auto_send,
            Notes: row.notes,
            CreatedDate: this.formatDateTimeToISOString(row.created_date),
            ModifiedDate: this.formatDateTimeToISOString(row.modified_date),
            CompletedDate: row.completed_date ? this.formatDateTimeToISOString(row.completed_date) : undefined,
            // FIXED: Add missing frontend fields
            ClientPhone: row.client_phone,
            ClientEmail: row.client_email,
            FullClientName: row.full_client_name || row.client_name
        };
    }

    /** UPDATED: Map database row to ReminderSettings object with PROPER CASING */
    private mapDatabaseRowToReminderSettings(row: any): ReminderSettings {
        return {
            ReminderSettingId: row.reminder_setting_id,
            AgentId: row.agent_id,
            ReminderType: row.reminder_type,
            IsEnabled: row.is_enabled,
            DaysBefore: row.days_before,
            TimeOfDay: row.time_of_day,
            RepeatDaily: row.repeat_daily,
            CreatedDate: this.formatDateTimeToISOString(row.created_date),
            ModifiedDate: this.formatDateTimeToISOString(row.modified_date)
        };
    }

    /** Format date to ISO string - UNCHANGED */
    private formatDateToISOString(date: any): string {
        if (!date) return '';
        
        if (typeof date === 'string') {
            if (date.includes('-')) {
                return date.split('T')[0];
            }
            return date;
        }
        
        if (date instanceof Date) {
            return date.toISOString().split('T')[0];
        }
        
        return String(date);
    }

    /** Format datetime to ISO string - UNCHANGED */
    private formatDateTimeToISOString(datetime: any): string {
        if (!datetime) return '';
        
        if (typeof datetime === 'string') {
            return datetime;
        }
        
        if (datetime instanceof Date) {
            return datetime.toISOString();
        }
        
        return String(datetime);
    }
}