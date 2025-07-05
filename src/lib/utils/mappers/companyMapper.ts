import type { Company, Account } from '@prisma/client';
import type {
  CompanyDto,
  CompanyWithAccountDto,
  CompanyWithDeviceCountDto,
  CompanyFullDto,
  CompanyListItemDto,
  CreateCompanyDto,
  UpdateCompanyDto
} from '$lib/types/dto/company';

/**
 * Maps a Prisma Company model to CompanyDto
 */
export function mapToCompanyDto(company: Company): CompanyDto {
  return {
    id: company.id,
    name: company.name,
    status: company.status,
    contactEmail: company.contactEmail,
    contactPhone: company.contactPhone,
    address: company.address,
    description: company.description,
    accountId: company.accountId,
    createdAt: company.createdAt.toISOString(),
    updatedAt: company.updatedAt.toISOString()
  };
}

/**
 * Maps a Prisma Company with Account to CompanyWithAccountDto
 */
export function mapToCompanyWithAccountDto(
  company: Company & { account: Account }
): CompanyWithAccountDto {
  return {
    ...mapToCompanyDto(company),
    account: {
      id: company.account.id,
      name: company.account.name,
      slug: company.account.slug
    }
  };
}

/**
 * Maps a Prisma Company with device count to CompanyWithDeviceCountDto
 */
export function mapToCompanyWithDeviceCountDto(
  company: Company & { _count: { devices: number } }
): CompanyWithDeviceCountDto {
  return {
    ...mapToCompanyDto(company),
    _count: {
      devices: company._count.devices
    }
  };
}

/**
 * Maps a Prisma Company with full relations to CompanyFullDto
 */
export function mapToCompanyFullDto(
  company: Company & { 
    account: Account;
    _count: { devices: number };
  }
): CompanyFullDto {
  return {
    ...mapToCompanyDto(company),
    account: {
      id: company.account.id,
      name: company.account.name,
      slug: company.account.slug
    },
    _count: {
      devices: company._count.devices
    }
  };
}

/**
 * Maps a Prisma Company to CompanyListItemDto
 */
export function mapToCompanyListItemDto(
  company: Company & { 
    account: Account;
    _count: { devices: number };
  }
): CompanyListItemDto {
  return {
    id: company.id,
    name: company.name,
    status: company.status,
    contactEmail: company.contactEmail,
    description: company.description,
    accountName: company.account.name,
    deviceCount: company._count.devices,
    createdAt: company.createdAt.toISOString(),
    updatedAt: company.updatedAt.toISOString()
  };
}

/**
 * Maps CreateCompanyDto to Prisma create data
 */
export function mapCreateCompanyDtoToPrisma(dto: CreateCompanyDto) {
  return {
    name: dto.name,
    status: dto.status,
    contactEmail: dto.contactEmail,
    contactPhone: dto.contactPhone,
    address: dto.address,
    description: dto.description || null,
    accountId: dto.accountId
  };
}

/**
 * Maps UpdateCompanyDto to Prisma update data
 */
export function mapUpdateCompanyDtoToPrisma(dto: UpdateCompanyDto) {
  const updateData: any = {};
  
  if (dto.name !== undefined) updateData.name = dto.name;
  if (dto.status !== undefined) updateData.status = dto.status;
  if (dto.contactEmail !== undefined) updateData.contactEmail = dto.contactEmail;
  if (dto.contactPhone !== undefined) updateData.contactPhone = dto.contactPhone;
  if (dto.address !== undefined) updateData.address = dto.address;
  if (dto.description !== undefined) updateData.description = dto.description || null;
  if (dto.accountId !== undefined) updateData.accountId = dto.accountId;
  
  return updateData;
} 
