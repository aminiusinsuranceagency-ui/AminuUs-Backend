-- ============================================================
-- Prereqs
-- ============================================================
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ============================================================
-- 1) Upsert Client (Create/Update) -> returns client_id (UUID)
-- ============================================================
DROP FUNCTION IF EXISTS sp_upsert_client(
    UUID, VARCHAR, VARCHAR, VARCHAR, VARCHAR, VARCHAR, VARCHAR,
    VARCHAR, DATE, BOOLEAN, UUID, TEXT
);

CREATE OR REPLACE FUNCTION sp_upsert_client(
    p_agent_id UUID,
    p_first_name VARCHAR(50),
    p_surname VARCHAR(50),
    p_last_name VARCHAR(50),
    p_phone_number VARCHAR(20),
    p_email VARCHAR(100),
    p_address VARCHAR(500),
    p_national_id VARCHAR(20),
    p_date_of_birth DATE,
    p_is_client BOOLEAN,
    p_client_id UUID DEFAULT NULL,
    p_notes TEXT DEFAULT NULL
) RETURNS UUID AS $$
DECLARE
    v_client_id UUID;
BEGIN
    IF p_client_id IS NULL THEN
        v_client_id := gen_random_uuid();

        INSERT INTO clients (
            client_id, agent_id, first_name, surname, last_name,
            phone_number, email, address, national_id,
            date_of_birth, is_client, notes
        ) VALUES (
            v_client_id, p_agent_id, p_first_name, p_surname, p_last_name,
            p_phone_number, p_email, p_address, p_national_id,
            p_date_of_birth, p_is_client, p_notes
        );

        INSERT INTO activity_log (agent_id, activity_type, entity_type, entity_id, description)
        VALUES (
            p_agent_id, 'client_created', 'client', v_client_id,
            p_first_name || ' ' || p_surname || ' added as ' ||
            CASE WHEN p_is_client THEN 'client' ELSE 'prospect' END
        );

    ELSE
        v_client_id := p_client_id;

        UPDATE clients
        SET first_name   = p_first_name,
            surname      = p_surname,
            last_name    = p_last_name,
            phone_number = p_phone_number,
            email        = p_email,
            address      = p_address,
            national_id  = p_national_id,
            date_of_birth= p_date_of_birth,
            is_client    = p_is_client,
            notes        = p_notes,
            modified_date= NOW()
        WHERE client_id = v_client_id;

        INSERT INTO activity_log (agent_id, activity_type, entity_type, entity_id, description)
        VALUES (
            p_agent_id, 'client_updated', 'client', v_client_id,
            p_first_name || ' ' || p_surname || ' updated'
        );
    END IF;

    RETURN v_client_id;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- 2) Get Clients
-- ============================================================
DROP FUNCTION IF EXISTS sp_get_clients(
    UUID, VARCHAR, VARCHAR, VARCHAR
);

CREATE OR REPLACE FUNCTION sp_get_clients(
    p_agent_id UUID,
    p_search_term VARCHAR(100) DEFAULT NULL,
    p_filter_type VARCHAR(20)  DEFAULT 'all',
    p_insurance_type VARCHAR(50) DEFAULT NULL
) RETURNS TABLE (
    client_id UUID,
    first_name VARCHAR,
    surname VARCHAR,
    last_name VARCHAR,
    phone_number VARCHAR,
    email VARCHAR,
    address VARCHAR,
    national_id VARCHAR,
    date_of_birth DATE,
    is_client BOOLEAN,
    insurance_type VARCHAR,
    notes TEXT,
    created_date TIMESTAMPTZ,
    modified_date TIMESTAMPTZ,
    policy_id UUID,
    policy_name VARCHAR,
    policy_type VARCHAR,
    policy_company VARCHAR,
    policy_status VARCHAR,
    policy_start_date DATE,
    policy_end_date DATE,
    policy_notes TEXT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        c.client_id,
        c.first_name,
        c.surname,
        c.last_name,
        c.phone_number,
        c.email,
        c.address,
        c.national_id,
        c.date_of_birth,
        c.is_client,
        c.insurance_type,
        c.notes,
        c.created_date,
        c.modified_date,
        cp.policy_id,
        cp.policy_name,
        pt.type_name AS policy_type,
        ic.company_name AS policy_company,
        cp.status     AS policy_status,
        cp.start_date AS policy_start_date,
        cp.end_date   AS policy_end_date,
        cp.notes      AS policy_notes
    FROM clients c
    LEFT JOIN client_policies cp ON c.client_id = cp.client_id AND cp.is_active = TRUE
    LEFT JOIN policy_catalog pc  ON cp.policy_catalog_id = pc.policy_catalog_id
    LEFT JOIN policy_types pt    ON pc.type_id = pt.type_id
    LEFT JOIN insurance_companies ic ON pc.company_id = ic.company_id
    WHERE c.agent_id = p_agent_id
      AND c.is_active = TRUE
      AND (
          p_search_term IS NULL OR
          c.first_name   ILIKE '%' || p_search_term || '%' OR
          c.surname      ILIKE '%' || p_search_term || '%' OR
          c.last_name    ILIKE '%' || p_search_term || '%' OR
          c.phone_number ILIKE '%' || p_search_term || '%' OR
          c.email        ILIKE '%' || p_search_term || '%'
      )
      AND (
          p_filter_type = 'all' OR
          (p_filter_type = 'clients'   AND c.is_client = TRUE)  OR
          (p_filter_type = 'prospects' AND c.is_client = FALSE)
      )
      AND (p_insurance_type IS NULL OR c.insurance_type = p_insurance_type)
    ORDER BY c.first_name, c.surname;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- 3) Get Client
-- ============================================================
DROP FUNCTION IF EXISTS sp_get_client(UUID, UUID);

CREATE OR REPLACE FUNCTION sp_get_client(
    p_client_id UUID,
    p_agent_id UUID
) RETURNS TABLE (
    client_id UUID,
    agent_id UUID,
    first_name VARCHAR,
    surname VARCHAR,
    last_name VARCHAR,
    phone_number VARCHAR,
    email VARCHAR,
    address VARCHAR,
    national_id VARCHAR,
    date_of_birth DATE,
    is_client BOOLEAN,
    insurance_type VARCHAR,
    notes TEXT,
    created_date TIMESTAMPTZ,
    modified_date TIMESTAMPTZ,
    is_active BOOLEAN,
    policy_id UUID,
    policy_name VARCHAR,
    policy_type VARCHAR,
    policy_company VARCHAR,
    policy_status VARCHAR,
    policy_start_date DATE,
    policy_end_date DATE,
    policy_notes TEXT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        c.client_id,
        c.agent_id,
        c.first_name,
        c.surname,
        c.last_name,
        c.phone_number,
        c.email,
        c.address,
        c.national_id,
        c.date_of_birth,
        c.is_client,
        c.insurance_type,
        c.notes,
        c.created_date,
        c.modified_date,
        c.is_active,
        cp.policy_id,
        cp.policy_name,
        pt.type_name AS policy_type,
        ic.company_name AS policy_company,
        cp.status     AS policy_status,
        cp.start_date AS policy_start_date,
        cp.end_date   AS policy_end_date,
        cp.notes      AS policy_notes
    FROM clients c
    LEFT JOIN client_policies cp ON c.client_id = cp.client_id AND cp.is_active = TRUE
    LEFT JOIN policy_catalog pc  ON cp.policy_catalog_id = pc.policy_catalog_id
    LEFT JOIN policy_types pt    ON pc.type_id = pt.type_id
    LEFT JOIN insurance_companies ic ON pc.company_id = ic.company_id
    WHERE c.client_id = p_client_id
      AND c.agent_id  = p_agent_id
      AND c.is_active = TRUE;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- 3b) Get Client Appointments
-- ============================================================
DROP FUNCTION IF EXISTS sp_get_client_appointments(UUID, UUID);

CREATE OR REPLACE FUNCTION sp_get_client_appointments(
    p_client_id UUID,
    p_agent_id UUID
) RETURNS TABLE(
    appointment_id UUID,
    title VARCHAR,
    appointment_date DATE,
    start_time VARCHAR,
    end_time VARCHAR,
    type VARCHAR,
    status VARCHAR,
    location VARCHAR
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        appointment_id,
        title,
        appointment_date,
        start_time,
        end_time,
        type,
        status,
        location
    FROM appointments
    WHERE client_id = p_client_id
      AND agent_id  = p_agent_id
      AND is_active = TRUE
    ORDER BY appointment_date DESC, start_time DESC;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- 4) Delete Client
-- ============================================================
DROP FUNCTION IF EXISTS sp_delete_client(UUID, UUID);

CREATE OR REPLACE FUNCTION sp_delete_client(
    p_client_id UUID,
    p_agent_id UUID
) RETURNS INTEGER AS $$
DECLARE
    v_client_name TEXT;
    v_rows INT;
BEGIN
    SELECT first_name || ' ' || surname
      INTO v_client_name
    FROM clients
    WHERE client_id = p_client_id;

    UPDATE clients
    SET is_active = FALSE,
        modified_date = NOW()
    WHERE client_id = p_client_id
      AND agent_id  = p_agent_id;
    GET DIAGNOSTICS v_rows = ROW_COUNT;

    UPDATE appointments
    SET is_active = FALSE,
        modified_date = NOW()
    WHERE client_id = p_client_id
      AND agent_id  = p_agent_id;

    INSERT INTO activity_log (agent_id, activity_type, entity_type, entity_id, description)
    VALUES (p_agent_id, 'client_deleted', 'client', p_client_id, v_client_name || ' deleted');

    RETURN v_rows;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- 5) Client Statistics
-- ============================================================
DROP FUNCTION IF EXISTS sp_get_client_statistics(UUID);

CREATE OR REPLACE FUNCTION sp_get_client_statistics(
    p_agent_id UUID
) RETURNS TABLE(
    total_contacts INT,
    total_clients INT,
    total_prospects INT,
    today_birthdays INT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        COUNT(*)                                AS total_contacts,
        SUM(CASE WHEN is_client THEN 1 ELSE 0 END)        AS total_clients,
        SUM(CASE WHEN NOT is_client THEN 1 ELSE 0 END)    AS total_prospects,
        COUNT(*) FILTER (
            WHERE EXTRACT(DAY   FROM date_of_birth) = EXTRACT(DAY   FROM NOW())
              AND EXTRACT(MONTH FROM date_of_birth) = EXTRACT(MONTH FROM NOW())
        ) AS today_birthdays
    FROM clients
    WHERE agent_id = p_agent_id
      AND is_active = TRUE;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- 6) Today Birthdays
-- ============================================================
DROP FUNCTION IF EXISTS sp_get_today_birthdays(UUID);

CREATE OR REPLACE FUNCTION sp_get_today_birthdays(
    p_agent_id UUID
) RETURNS TABLE(
    client_id UUID,
    first_name VARCHAR,
    surname VARCHAR,
    last_name VARCHAR,
    phone_number VARCHAR,
    email VARCHAR,
    insurance_type VARCHAR,
    date_of_birth DATE,
    age INT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        client_id,
        first_name,
        surname,
        last_name,
        phone_number,
        email,
        insurance_type,
        date_of_birth,
        EXTRACT(YEAR FROM AGE(NOW(), date_of_birth))::INT AS age
    FROM clients
    WHERE agent_id = p_agent_id
      AND is_active = TRUE
      AND EXTRACT(DAY   FROM date_of_birth) = EXTRACT(DAY   FROM NOW())
      AND EXTRACT(MONTH FROM date_of_birth) = EXTRACT(MONTH FROM NOW())
    ORDER BY first_name, surname;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- 7) Get All Clients
-- ============================================================
DROP FUNCTION IF EXISTS sp_get_all_clients(UUID, VARCHAR, VARCHAR, BOOLEAN, INT, INT);

CREATE OR REPLACE FUNCTION sp_get_all_clients(
    p_agent_id UUID,
    p_search_term VARCHAR(100)  DEFAULT NULL,
    p_insurance_type VARCHAR(50) DEFAULT NULL,
    p_is_client BOOLEAN DEFAULT NULL,
    p_page_number INT DEFAULT 1,
    p_page_size INT DEFAULT 50
) RETURNS TABLE(
    client_id UUID,
    first_name VARCHAR,
    surname VARCHAR,
    last_name VARCHAR,
    phone_number VARCHAR,
    email VARCHAR,
    address VARCHAR,
    national_id VARCHAR,
    date_of_birth DATE,
    age INT,
    is_client BOOLEAN,
    insurance_type VARCHAR,
    notes TEXT,
    created_date TIMESTAMPTZ,
    modified_date TIMESTAMPTZ,
    policy_count BIGINT,
    next_expiry_date DATE
) AS $$
DECLARE
    v_offset INT := (p_page_number - 1) * p_page_size;
BEGIN
    RETURN QUERY
    SELECT 
        c.client_id,
        c.first_name,
        c.surname,
        c.last_name,
        c.phone_number,
        c.email,
        c.address,
        c.national_id,
        c.date_of_birth,
        EXTRACT(YEAR FROM AGE(NOW(), c.date_of_birth))::INT AS age,
        c.is_client,
        c.insurance_type,
        c.notes,
        c.created_date,
        c.modified_date,
        COUNT(cp.policy_id) AS policy_count,
        MAX(cp.end_date)    AS next_expiry_date
    FROM clients c
    LEFT JOIN client_policies cp
      ON c.client_id = cp.client_id
     AND cp.is_active = TRUE
    WHERE c.agent_id  = p_agent_id
      AND c.is_active = TRUE
      AND (
          p_search_term IS NULL OR
          c.first_name   ILIKE '%' || p_search_term || '%' OR
          c.surname      ILIKE '%' || p_search_term || '%' OR
          c.last_name    ILIKE '%' || p_search_term || '%' OR
          c.phone_number ILIKE '%' || p_search_term || '%' OR
          c.email        ILIKE '%' || p_search_term || '%'
      )
      AND (p_insurance_type IS NULL OR c.insurance_type = p_insurance_type)
      AND (p_is_client IS NULL OR c.is_client = p_is_client)
    GROUP BY c.client_id, c.first_name, c.surname, c.last_name,
             c.phone_number, c.email, c.address, c.national_id,
             c.date_of_birth, c.is_client, c.insurance_type,
             c.notes, c.created_date, c.modified_date
    ORDER BY c.created_date DESC
    OFFSET v_offset LIMIT p_page_size;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- 8) Search Clients
-- ============================================================
DROP FUNCTION IF EXISTS sp_search_clients(UUID, VARCHAR);

CREATE OR REPLACE FUNCTION sp_search_clients(
    p_agent_id UUID,
    p_search_term VARCHAR(100)
) RETURNS TABLE (
    client_id UUID,
    first_name VARCHAR,
    surname VARCHAR,
    last_name VARCHAR,
    phone_number VARCHAR,
    email VARCHAR,
    is_client BOOLEAN,
    insurance_type VARCHAR,
    age INT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        c.client_id,
        c.first_name,
        c.surname,
        c.last_name,
        c.phone_number,
        c.email,
        c.is_client,
        c.insurance_type,
        EXTRACT(YEAR FROM AGE(NOW(), c.date_of_birth))::INT AS age
    FROM clients c
    WHERE c.agent_id = p_agent_id
      AND c.is_active = TRUE
      AND (
          c.first_name   ILIKE '%' || p_search_term || '%' OR
          c.surname      ILIKE '%' || p_search_term || '%' OR
          c.last_name    ILIKE '%' || p_search_term || '%' OR
          c.phone_number ILIKE '%' || p_search_term || '%' OR
          c.email        ILIKE '%' || p_search_term || '%' OR
          c.national_id  ILIKE '%' || p_search_term || '%'
      )
    ORDER BY c.first_name, c.surname;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- 9) Navbar Badge Counts
-- ============================================================
DROP FUNCTION IF EXISTS sp_getnavbarbadgecounts(UUID);

CREATE OR REPLACE FUNCTION sp_getnavbarbadgecounts(
    p_agentid UUID
) RETURNS TABLE(
    clientscount INT,
    policiescount INT,
    reminderscount INT,
    appointmentscount INT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        COUNT(DISTINCT c.clientid) FILTER (WHERE c.isactive = TRUE) AS clientscount,
        COUNT(DISTINCT p.policyid) FILTER (WHERE p.isactive = TRUE) AS policiescount,
        COUNT(DISTINCT r.reminderid) FILTER (WHERE r.status = 'Active') AS reminderscount,
        COUNT(DISTINCT a.appointmentid) FILTER (
            WHERE a.isactive = TRUE 
              AND a.status NOT IN ('Completed', 'Cancelled')
        ) AS appointmentscount
    FROM clients c
    LEFT JOIN clientpolicies p ON p.clientid = c.clientid
    LEFT JOIN reminders r ON r.agentid = p_agentid
    LEFT JOIN appointments a ON a.agentid = p_agentid
    WHERE c.agentid = p_agentid;
END;
$$ LANGUAGE plpgsql;
