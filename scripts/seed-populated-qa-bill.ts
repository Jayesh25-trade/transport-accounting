import { pool } from "../src/db";

export async function seedPopulatedQaBill() {
  console.log("Seeding / Ensuring Populated QA Bill #101...");

  // 1. Get or create Deepraj Transport Firm
  const firmRes = await pool.query("SELECT * FROM firms WHERE code = 'DEEPRAJ' OR name = 'DEEPRAJ TRANSPORT' LIMIT 1");
  let firmId: string;
  if (firmRes.rows.length > 0) {
    firmId = firmRes.rows[0].id;
  } else {
    const newFirm = await pool.query(`
      INSERT INTO firms (id, name, code, pan, phone, address, is_active)
      VALUES (gen_random_uuid(), 'DEEPRAJ TRANSPORT', 'DEEPRAJ', 'AQEPM2120M', '+91 98250 12345', 'Plot No. 42, Transport Nagar, Sector 10, Gandhidham', true)
      RETURNING id
    `);
    firmId = newFirm.rows[0].id;
  }

  // 2. Get or create Reliance Industries Party
  const partyRes = await pool.query("SELECT * FROM parties WHERE firm_id = $1 AND name = 'RELIANCE INDUSTRIES LTD' LIMIT 1", [firmId]);
  let partyId: string;
  if (partyRes.rows.length > 0) {
    partyId = partyRes.rows[0].id;
  } else {
    const newParty = await pool.query(`
      INSERT INTO parties (id, firm_id, name, is_active)
      VALUES (gen_random_uuid(), $1, 'RELIANCE INDUSTRIES LTD', true)
      RETURNING id
    `, [firmId]);
    partyId = newParty.rows[0].id;
  }

  // 3. Upsert Bill #101
  const billRes = await pool.query("SELECT * FROM bills WHERE firm_id = $1 AND bill_number = 101 LIMIT 1", [firmId]);
  let billId: string;

  if (billRes.rows.length > 0) {
    billId = billRes.rows[0].id;
    await pool.query(`
      UPDATE bills SET
        party_id = $1,
        bill_date = '2026-09-29',
        subtotal_freight = 133000.00,
        debit_note_amount = 5600.00,
        applied_tds_percentage = 1.00,
        tds_amount = 1274.00,
        net_bill_amount = 126126.00,
        received_amount = 0.00,
        pending_amount = 126126.00,
        total_n_weight = 45.000,
        total_r_weight = 44.800,
        status = 'POSTED'
      WHERE id = $2
    `, [partyId, billId]);
  } else {
    const newBill = await pool.query(`
      INSERT INTO bills (
        id, firm_id, party_id, bill_number, bill_date, subtotal_freight, debit_note_amount,
        applied_tds_percentage, tds_amount, net_bill_amount, received_amount, pending_amount,
        total_n_weight, total_r_weight, status
      ) VALUES (
        gen_random_uuid(), $1, $2, 101, '2026-09-29', 133000.00, 5600.00,
        1.00, 1274.00, 126126.00, 0.00, 126126.00,
        45.000, 44.800, 'POSTED'
      ) RETURNING id
    `, [firmId, partyId]);
    billId = newBill.rows[0].id;
  }

  // 4. Clean up any existing test daily_entries / trips / bill_items for these test LRs
  await pool.query("DELETE FROM bill_items WHERE bill_id = $1", [billId]);
  await pool.query(`
    DELETE FROM trips WHERE daily_entry_id IN (
      SELECT id FROM daily_entries WHERE firm_id = $1 AND lr_number IN ('LR-9001', 'LR-9002')
    )
  `, [firmId]);
  await pool.query("DELETE FROM daily_entries WHERE firm_id = $1 AND lr_number IN ('LR-9001', 'LR-9002')", [firmId]);

  // Create Daily Entries & Trips
  const de1Res = await pool.query(`
    INSERT INTO daily_entries (
      id, firm_id, party_id, sr_no, entry_date, truck_number_raw, lr_number, from_location_raw, to_location_raw,
      n_weight, r_weight, rate, is_received
    ) VALUES (
      gen_random_uuid(), $1, $2, 9001, '2026-09-28', 'GJ12BW1234', 'LR-9001', 'GANDHIDHAM', 'JAMNAGAR',
      25.000, 24.800, 4000.00, true
    ) RETURNING id
  `, [firmId, partyId]);
  const de1Id = de1Res.rows[0].id;

  const de2Res = await pool.query(`
    INSERT INTO daily_entries (
      id, firm_id, party_id, sr_no, entry_date, truck_number_raw, lr_number, from_location_raw, to_location_raw,
      n_weight, r_weight, rate, is_received
    ) VALUES (
      gen_random_uuid(), $1, $2, 9002, '2026-09-29', 'GJ12BW5678', 'LR-9002', 'KANDLA', 'AHMEDABAD',
      20.000, 20.000, 1650.00, true
    ) RETURNING id
  `, [firmId, partyId]);
  const de2Id = de2Res.rows[0].id;

  const trip1Res = await pool.query(`
    INSERT INTO trips (
      id, firm_id, party_id, daily_entry_id, is_received, is_billed, bill_id
    ) VALUES (
      gen_random_uuid(), $1, $2, $3, true, true, $4
    ) RETURNING id
  `, [firmId, partyId, de1Id, billId]);
  const trip1Id = trip1Res.rows[0].id;

  const trip2Res = await pool.query(`
    INSERT INTO trips (
      id, firm_id, party_id, daily_entry_id, is_received, is_billed, bill_id
    ) VALUES (
      gen_random_uuid(), $1, $2, $3, true, true, $4
    ) RETURNING id
  `, [firmId, partyId, de2Id, billId]);
  const trip2Id = trip2Res.rows[0].id;

  // 5. Insert Bill Items
  await pool.query(`
    INSERT INTO bill_items (
      id, bill_id, trip_id, trip_date, truck_number_raw, lr_number,
      from_location_raw, to_location_raw, n_weight, r_weight,
      applied_rate, freight, shortage_debit_amount
    ) VALUES 
    (
      gen_random_uuid(), $1, $2, '2026-09-28', 'GJ12BW1234', 'LR-9001',
      'GANDHIDHAM', 'JAMNAGAR', 25.000, 24.800,
      4000.00, 100000.00, 5600.00
    ),
    (
      gen_random_uuid(), $1, $3, '2026-09-29', 'GJ12BW5678', 'LR-9002',
      'KANDLA', 'AHMEDABAD', 20.000, 20.000,
      1650.00, 33000.00, 0.00
    )
  `, [billId, trip1Id, trip2Id]);


  console.log(`Successfully seeded Populated QA Bill #101 (ID: ${billId}) with 2 trip items.`);
  return { billId, firmId };
}

if (require.main === module) {
  seedPopulatedQaBill().then(() => pool.end().then(() => process.exit(0)));
}

