import { PrismaClient } from "@/lib/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import {
  encrypt,
  decryptOrNull,
  encryptArray,
  decryptArray,
} from "./encryption";

// ── Encrypted field configuration ────────────────────────────
// Each model lists which string fields and array fields are encrypted.

const ENCRYPTED_STRING_FIELDS: Record<string, string[]> = {
  student: ["phone", "address", "emergencyContact", "adminNotes"],
  clientIntake: [
    "otherBehaviours",
    "otherFeelings",
    "otherSymptoms",
    "additionalNotes",
    "adminNotes",
  ],
  booking: ["clientPhone", "clientNotes", "adminNotes"],
  commitmentAcknowledgement: ["ipAddress", "userAgent"],
  documentAcceptance: ["ipAddress", "userAgent"],
};

const ENCRYPTED_ARRAY_FIELDS: Record<string, string[]> = {
  clientIntake: ["behaviours", "feelings", "symptoms"],
};

// ── Helpers ──────────────────────────────────────────────────

/* eslint-disable @typescript-eslint/no-explicit-any */

/** Encrypt string fields on a data object. */
function encryptStringFields(data: Record<string, any>, fields: string[]) {
  for (const field of fields) {
    if (data[field] !== undefined && data[field] !== null && typeof data[field] === "string") {
      data[field] = encrypt(data[field]);
    }
  }
}

/** Encrypt array fields on a data object, handling both plain arrays and Prisma { set: [...] }. */
function encryptArrayFields(data: Record<string, any>, fields: string[]) {
  for (const field of fields) {
    if (Array.isArray(data[field])) {
      data[field] = encryptArray(data[field]);
    } else if (data[field] && typeof data[field] === "object" && "set" in data[field] && Array.isArray(data[field].set)) {
      data[field].set = encryptArray(data[field].set);
    }
  }
}

/** Encrypt all specified fields on a data object before a write operation. */
function encryptDataFields(
  data: Record<string, any> | undefined,
  modelName: string,
) {
  if (!data) return;
  const stringFields = ENCRYPTED_STRING_FIELDS[modelName];
  if (stringFields) encryptStringFields(data, stringFields);
  const arrayFields = ENCRYPTED_ARRAY_FIELDS[modelName];
  if (arrayFields) encryptArrayFields(data, arrayFields);
}

/** Build result extension for a model's string fields. */
function buildResultExtension(modelName: string) {
  const ext: Record<string, any> = {};

  const stringFields = ENCRYPTED_STRING_FIELDS[modelName];
  if (stringFields) {
    for (const field of stringFields) {
      ext[field] = {
        needs: { [field]: true },
        compute(record: any) {
          return decryptOrNull(record[field]);
        },
      };
    }
  }

  const arrayFields = ENCRYPTED_ARRAY_FIELDS[modelName];
  if (arrayFields) {
    for (const field of arrayFields) {
      ext[field] = {
        needs: { [field]: true },
        compute(record: any) {
          return Array.isArray(record[field]) ? decryptArray(record[field]) : record[field];
        },
      };
    }
  }

  return ext;
}

/** Build query extension for a model — intercepts write operations. */
function buildQueryExtension(modelName: string) {
  return {
    async create({ args, query }: any) {
      encryptDataFields(args.data, modelName);
      return query(args);
    },
    async createMany({ args, query }: any) {
      if (Array.isArray(args.data)) {
        for (const item of args.data) {
          encryptDataFields(item, modelName);
        }
      } else {
        encryptDataFields(args.data, modelName);
      }
      return query(args);
    },
    async update({ args, query }: any) {
      encryptDataFields(args.data, modelName);
      return query(args);
    },
    async updateMany({ args, query }: any) {
      encryptDataFields(args.data, modelName);
      return query(args);
    },
    async upsert({ args, query }: any) {
      encryptDataFields(args.create, modelName);
      encryptDataFields(args.update, modelName);
      return query(args);
    },
  };
}

/* eslint-enable @typescript-eslint/no-explicit-any */

// ── Client creation ──────────────────────────────────────────

const globalForPrisma = globalThis as unknown as {
  prisma: ReturnType<typeof createExtendedClient> | undefined;
};

function createExtendedClient() {
  const adapter = new PrismaPg({
    connectionString: process.env.DATABASE_URL!,
    max: 3,
  });
  const base = new PrismaClient({ adapter });

  return base.$extends({
    result: {
      student: buildResultExtension("student"),
      clientIntake: buildResultExtension("clientIntake"),
      booking: buildResultExtension("booking"),
      commitmentAcknowledgement: buildResultExtension("commitmentAcknowledgement"),
      documentAcceptance: buildResultExtension("documentAcceptance"),
    },
    query: {
      student: buildQueryExtension("student"),
      clientIntake: buildQueryExtension("clientIntake"),
      booking: buildQueryExtension("booking"),
      commitmentAcknowledgement: buildQueryExtension("commitmentAcknowledgement"),
      documentAcceptance: buildQueryExtension("documentAcceptance"),
    },
  });
}

export const prisma = globalForPrisma.prisma ?? createExtendedClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
