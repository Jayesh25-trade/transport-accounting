import { eq, and } from "drizzle-orm";
import { type NodePgDatabase } from "drizzle-orm/node-postgres";
import { parties, companies, customerRules } from "../db/schema";
import { partyInputSchema, companyInputSchema, customerRuleInputSchema, type PartyInput, type CompanyInput, type CustomerRuleInput } from "../validators/party-company";
import { verifyPartyInFirm, verifyCompanyInFirm } from "./firm.service";
import { recordAuditLog } from "./audit.service";
import { EntityNotFoundError } from "../lib/errors";

// ==========================================
// PARTY SERVICES
// ==========================================

export async function createParty(db: NodePgDatabase<any>, rawInput: PartyInput) {
  const input = partyInputSchema.parse(rawInput);
  const [party] = await db.insert(parties).values(input).returning();
  await recordAuditLog(db, {
    firmId: input.firmId,
    action: "CREATE",
    entityName: "parties",
    entityId: party.id,
    newValues: party,
  });
  return party;
}

export async function updateParty(db: NodePgDatabase<any>, partyId: string, rawInput: PartyInput) {
  const input = partyInputSchema.parse(rawInput);
  await verifyPartyInFirm(db, partyId, input.firmId);
  const [updated] = await db
    .update(parties)
    .set({ ...input, updatedAt: new Date() })
    .where(and(eq(parties.id, partyId), eq(parties.firmId, input.firmId)))
    .returning();
  await recordAuditLog(db, {
    firmId: input.firmId,
    action: "UPDATE",
    entityName: "parties",
    entityId: partyId,
    newValues: updated,
  });
  return updated;
}

export async function getPartyById(db: NodePgDatabase<any>, partyId: string, firmId: string) {
  await verifyPartyInFirm(db, partyId, firmId);
  const res = await db.select().from(parties).where(and(eq(parties.id, partyId), eq(parties.firmId, firmId))).limit(1);
  if (res.length === 0) throw new EntityNotFoundError("Party", partyId);
  return res[0];
}

export async function listParties(db: NodePgDatabase<any>, firmId: string) {
  return await db.select().from(parties).where(eq(parties.firmId, firmId));
}

// ==========================================
// COMPANY SERVICES
// ==========================================

export async function createCompany(db: NodePgDatabase<any>, rawInput: CompanyInput) {
  const input = companyInputSchema.parse(rawInput);
  const [company] = await db.insert(companies).values(input).returning();
  await recordAuditLog(db, {
    firmId: input.firmId,
    action: "CREATE",
    entityName: "companies",
    entityId: company.id,
    newValues: company,
  });
  return company;
}

export async function updateCompany(db: NodePgDatabase<any>, companyId: string, rawInput: CompanyInput) {
  const input = companyInputSchema.parse(rawInput);
  await verifyCompanyInFirm(db, companyId, input.firmId);
  const [updated] = await db
    .update(companies)
    .set({ ...input, updatedAt: new Date() })
    .where(and(eq(companies.id, companyId), eq(companies.firmId, input.firmId)))
    .returning();
  await recordAuditLog(db, {
    firmId: input.firmId,
    action: "UPDATE",
    entityName: "companies",
    entityId: companyId,
    newValues: updated,
  });
  return updated;
}

export async function getCompanyById(db: NodePgDatabase<any>, companyId: string, firmId: string) {
  await verifyCompanyInFirm(db, companyId, firmId);
  const res = await db.select().from(companies).where(and(eq(companies.id, companyId), eq(companies.firmId, firmId))).limit(1);
  if (res.length === 0) throw new EntityNotFoundError("Company", companyId);
  return res[0];
}

export async function listCompanies(db: NodePgDatabase<any>, firmId: string) {
  return await db.select().from(companies).where(eq(companies.firmId, firmId));
}

// ==========================================
// CUSTOMER RULE SERVICES
// ==========================================

export async function upsertCustomerRule(db: NodePgDatabase<any>, rawInput: CustomerRuleInput) {
  const input = customerRuleInputSchema.parse(rawInput);
  await verifyPartyInFirm(db, input.partyId, input.firmId);

  const existing = await db
    .select()
    .from(customerRules)
    .where(and(eq(customerRules.firmId, input.firmId), eq(customerRules.partyId, input.partyId)))
    .limit(1);

  if (existing.length > 0) {
    const [updated] = await db
      .update(customerRules)
      .set({
        freightBasis: input.freightBasis,
        shortageApplicable: input.shortageApplicable,
        shortageAllowanceType: input.shortageAllowanceType || null,
        shortageAllowanceValue: input.shortageAllowanceValue !== undefined && input.shortageAllowanceValue !== null ? input.shortageAllowanceValue.toString() : null,
        shortageRuleType: input.shortageRuleType || null,
        materialRatePerTon: input.materialRatePerTon !== undefined && input.materialRatePerTon !== null ? input.materialRatePerTon.toString() : null,
        tdsApplicable: input.tdsApplicable,
        tdsSection: input.tdsSection || null,
        tdsPercentage: input.tdsPercentage !== undefined && input.tdsPercentage !== null ? input.tdsPercentage.toString() : null,
        updatedAt: new Date(),
      })
      .where(eq(customerRules.id, existing[0].id))
      .returning();
    return updated;
  } else {
    const [created] = await db
      .insert(customerRules)
      .values({
        firmId: input.firmId,
        partyId: input.partyId,
        freightBasis: input.freightBasis,
        shortageApplicable: input.shortageApplicable,
        shortageAllowanceType: input.shortageAllowanceType || null,
        shortageAllowanceValue: input.shortageAllowanceValue !== undefined && input.shortageAllowanceValue !== null ? input.shortageAllowanceValue.toString() : null,
        shortageRuleType: input.shortageRuleType || null,
        materialRatePerTon: input.materialRatePerTon !== undefined && input.materialRatePerTon !== null ? input.materialRatePerTon.toString() : null,
        tdsApplicable: input.tdsApplicable,
        tdsSection: input.tdsSection || null,
        tdsPercentage: input.tdsPercentage !== undefined && input.tdsPercentage !== null ? input.tdsPercentage.toString() : null,
      })
      .returning();
    return created;
  }
}

export async function getCustomerRuleByParty(db: NodePgDatabase<any>, partyId: string, firmId: string) {
  await verifyPartyInFirm(db, partyId, firmId);
  const res = await db
    .select()
    .from(customerRules)
    .where(and(eq(customerRules.firmId, firmId), eq(customerRules.partyId, partyId)))
    .limit(1);
  return res.length > 0 ? res[0] : null;
}
