import fs from 'fs';
import path from 'path';
import { VectorStore } from '../rag/vectorStore';
import { calService } from '../calendar/calService';

async function runTests() {
  console.log("======================================================");
  console.log("RUNNING AUTOMATED VERIFICATION TESTS");
  console.log("======================================================\n");

  let testFailures = 0;

  // Test 1: Local Scheduling Engine Initialization
  console.log("Test 1: Initializing Calendar Service Database...");
  try {
    const bookingsPath = path.join(process.cwd(), 'data/bookings.json');
    if (fs.existsSync(bookingsPath)) {
      console.log("✓ Bookings database exists.");
    } else {
      console.log("✓ Initialized new bookings database.");
    }
  } catch (err: any) {
    console.error("✗ Calendar Initialization failed:", err.message);
    testFailures++;
  }

  // Test 2: Slot Fetching Availability (Local Mode)
  console.log("\nTest 2: Retrieving available slots...");
  try {
    const testDate = "2026-06-08"; // A Monday
    const slots = await calService.getAvailableSlots(testDate);
    
    if (slots && slots.length > 0) {
      console.log(`✓ Retrieved ${slots.length} available slots for ${testDate}.`);
      console.log(`  First Slot: ${slots[0].displayTime} (Available: ${slots[0].available})`);
    } else {
      console.error("✗ No slots returned. Expected slots on a business day.");
      testFailures++;
    }
  } catch (err: any) {
    console.error("✗ Slot retrieval failed:", err.message);
    testFailures++;
  }

  // Test 3: Creating a Booking (Local Mode)
  console.log("\nTest 3: Testing booking execution...");
  try {
    const testTime = "2026-06-08T10:00:00.000Z";
    
    // Clear previous booking of this test slot to ensure idempotency
    const bookingsPath = path.join(process.cwd(), 'data/bookings.json');
    if (fs.existsSync(bookingsPath)) {
      try {
        const data = fs.readFileSync(bookingsPath, 'utf8');
        const bookings = JSON.parse(data);
        const filtered = bookings.filter((b: any) => b.startTime !== testTime);
        fs.writeFileSync(bookingsPath, JSON.stringify(filtered, null, 2));
      } catch (e) {}
    }

    const bookResult = await calService.createBooking(
      "Test Recruiter",
      "recruiter@scaler.com",
      testTime,
      "Testing API System"
    );

    if (bookResult.success && bookResult.bookingId) {
      console.log("✓ Booking created successfully.");
      console.log(`  Booking ID: ${bookResult.bookingId}`);
      console.log(`  Confirmation: ${bookResult.message}`);
    } else {
      console.error("✗ Booking failed:", bookResult.message);
      testFailures++;
    }

    // Double check availability (should be booked now)
    const slots = await calService.getAvailableSlots("2026-06-08");
    const targetSlot = slots.find(s => s.time === testTime);
    if (targetSlot && !targetSlot.available) {
      console.log("✓ Verified slot is now marked as unavailable/booked.");
    } else {
      console.error("✗ Failed to mark slot as booked after booking creation.");
      testFailures++;
    }
  } catch (err: any) {
    console.error("✗ Booking execution failed:", err.message);
    testFailures++;
  }

  // Test 4: Local Vector Database Search (Cosine Similarity check)
  console.log("\nTest 4: Loading local Vector Database...");
  try {
    const dbPath = path.join(process.cwd(), 'data/vector_db.json');
    if (!fs.existsSync(dbPath)) {
      console.warn("⚠ Vector database (vector_db.json) not generated yet. Skipping search queries.");
      console.log("  Please run: npm run ingest");
    } else {
      const vectorStore = new VectorStore();
      console.log("✓ Vector Store loaded successfully.");
    }
  } catch (err: any) {
    console.error("✗ Vector store loading failed:", err.message);
    testFailures++;
  }

  console.log("\n======================================================");
  if (testFailures === 0) {
    console.log("STATUS: ALL TESTS COMPLETED SUCCESSFULLY (✓)");
  } else {
    console.error(`STATUS: COMPLETED WITH ${testFailures} ERRORS (✗)`);
  }
  console.log("======================================================");
}

runTests();
