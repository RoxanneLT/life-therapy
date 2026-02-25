/**
 * One-time migration script: encrypt existing plaintext PII data.
 *
 * Run with: npx tsx scripts/encrypt-existing-data.ts
 *
 * Safe to re-run — skips already-encrypted values (graceful decrypt fallback).
 * Uses PrismaClient directly (not the app wrapper with $extends).
 */

import { config } from "dotenv";
config({ path: ".env.local" });

import { PrismaClient } from "../lib/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import {
  encrypt,
  decrypt,
  encryptArray,
  decryptArray,
} from "../lib/encryption";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

/** Check if a value is already encrypted (iv:authTag:ciphertext format). */
function isEncrypted(value: string): boolean {
  const parts = value.split(":");
  if (parts.length !== 3) return false;
  return parts[0].length === 24; // 12-byte IV = 24 hex chars
}

/** Check if all elements of an array are already encrypted. */
function isArrayEncrypted(values: string[]): boolean {
  return values.length > 0 && values.every(isEncrypted);
}

// ── Student PII ─────────────────────────────────────────────

async function encryptStudents() {
  const students = await prisma.student.findMany({
    select: {
      id: true,
      phone: true,
      address: true,
      emergencyContact: true,
      adminNotes: true,
    },
  });

  let count = 0;
  for (const s of students) {
    const updates: Record<string, string | null> = {};

    if (s.phone && !isEncrypted(s.phone)) updates.phone = encrypt(s.phone);
    if (s.address && !isEncrypted(s.address)) updates.address = encrypt(s.address);
    if (s.emergencyContact && !isEncrypted(s.emergencyContact)) updates.emergencyContact = encrypt(s.emergencyContact);
    if (s.adminNotes && !isEncrypted(s.adminNotes)) updates.adminNotes = encrypt(s.adminNotes);

    if (Object.keys(updates).length > 0) {
      await prisma.student.update({ where: { id: s.id }, data: updates });
      count++;
    }
  }
  console.log(`  Students: ${count}/${students.length} encrypted`);
}

// ── ClientIntake PII ────────────────────────────────────────

async function encryptIntakes() {
  const intakes = await prisma.clientIntake.findMany({
    select: {
      id: true,
      behaviours: true,
      feelings: true,
      symptoms: true,
      otherBehaviours: true,
      otherFeelings: true,
      otherSymptoms: true,
      additionalNotes: true,
      adminNotes: true,
    },
  });

  let count = 0;
  for (const i of intakes) {
    const updates: Record<string, unknown> = {};

    // Array fields
    if (i.behaviours.length > 0 && !isArrayEncrypted(i.behaviours)) updates.behaviours = encryptArray(i.behaviours);
    if (i.feelings.length > 0 && !isArrayEncrypted(i.feelings)) updates.feelings = encryptArray(i.feelings);
    if (i.symptoms.length > 0 && !isArrayEncrypted(i.symptoms)) updates.symptoms = encryptArray(i.symptoms);

    // String fields
    if (i.otherBehaviours && !isEncrypted(i.otherBehaviours)) updates.otherBehaviours = encrypt(i.otherBehaviours);
    if (i.otherFeelings && !isEncrypted(i.otherFeelings)) updates.otherFeelings = encrypt(i.otherFeelings);
    if (i.otherSymptoms && !isEncrypted(i.otherSymptoms)) updates.otherSymptoms = encrypt(i.otherSymptoms);
    if (i.additionalNotes && !isEncrypted(i.additionalNotes)) updates.additionalNotes = encrypt(i.additionalNotes);
    if (i.adminNotes && !isEncrypted(i.adminNotes)) updates.adminNotes = encrypt(i.adminNotes);

    if (Object.keys(updates).length > 0) {
      await prisma.clientIntake.update({ where: { id: i.id }, data: updates });
      count++;
    }
  }
  console.log(`  ClientIntakes: ${count}/${intakes.length} encrypted`);
}

// ── Booking PII ─────────────────────────────────────────────

async function encryptBookings() {
  const bookings = await prisma.booking.findMany({
    select: {
      id: true,
      clientPhone: true,
      clientNotes: true,
      adminNotes: true,
    },
  });

  let count = 0;
  for (const b of bookings) {
    const updates: Record<string, string | null> = {};

    if (b.clientPhone && !isEncrypted(b.clientPhone)) updates.clientPhone = encrypt(b.clientPhone);
    if (b.clientNotes && !isEncrypted(b.clientNotes)) updates.clientNotes = encrypt(b.clientNotes);
    if (b.adminNotes && !isEncrypted(b.adminNotes)) updates.adminNotes = encrypt(b.adminNotes);

    if (Object.keys(updates).length > 0) {
      await prisma.booking.update({ where: { id: b.id }, data: updates });
      count++;
    }
  }
  console.log(`  Bookings: ${count}/${bookings.length} encrypted`);
}

// ── CommitmentAcknowledgement PII ───────────────────────────

async function encryptCommitmentAcks() {
  const acks = await prisma.commitmentAcknowledgement.findMany({
    select: { id: true, ipAddress: true, userAgent: true },
  });

  let count = 0;
  for (const a of acks) {
    const updates: Record<string, string | null> = {};

    if (a.ipAddress && !isEncrypted(a.ipAddress)) updates.ipAddress = encrypt(a.ipAddress);
    if (a.userAgent && !isEncrypted(a.userAgent)) updates.userAgent = encrypt(a.userAgent);

    if (Object.keys(updates).length > 0) {
      await prisma.commitmentAcknowledgement.update({ where: { id: a.id }, data: updates });
      count++;
    }
  }
  console.log(`  CommitmentAcks: ${count}/${acks.length} encrypted`);
}

// ── DocumentAcceptance PII ──────────────────────────────────

async function encryptDocumentAcceptances() {
  const acceptances = await prisma.documentAcceptance.findMany({
    select: { id: true, ipAddress: true, userAgent: true },
  });

  let count = 0;
  for (const a of acceptances) {
    const updates: Record<string, string | null> = {};

    if (a.ipAddress && !isEncrypted(a.ipAddress)) updates.ipAddress = encrypt(a.ipAddress);
    if (a.userAgent && !isEncrypted(a.userAgent)) updates.userAgent = encrypt(a.userAgent);

    if (Object.keys(updates).length > 0) {
      await prisma.documentAcceptance.update({ where: { id: a.id }, data: updates });
      count++;
    }
  }
  console.log(`  DocumentAcceptances: ${count}/${acceptances.length} encrypted`);
}

// ── Main ────────────────────────────────────────────────────

async function main() {
  console.log("Encrypting existing plaintext PII data...\n");

  await encryptStudents();
  await encryptIntakes();
  await encryptBookings();
  await encryptCommitmentAcks();
  await encryptDocumentAcceptances();

  console.log("\nDone.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
