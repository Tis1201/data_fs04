import type { Company, Account } from '@prisma/client';

/**
 * Base company DTO with essential fields
 */
export interface CompanyDto {
  id: string;
  name: string;
  status: 'ACTIVE' | 'INACTIVE';
  contactEmail: string;
  contactPhone: string;
  address: string;
  description?: string | null;
  accountId: string;
  createdAt: string; // ISO string
  updatedAt: string; // ISO string
}

/**
 * Company DTO with account information
 */
export interface CompanyWithAccountDto extends CompanyDto {
  account: {
    id: string;
    name: string;
    slug: string;
  };
}

/**
 * Company DTO with device count
 */
export interface CompanyWithDeviceCountDto extends CompanyDto {
  _count: {
    devices: number;
  };
}

/**
 * Company DTO with full account and device count
 */
export interface CompanyFullDto extends CompanyWithAccountDto, CompanyWithDeviceCountDto {}

/**
 * Company list item DTO (for lists/grids)
 */
export interface CompanyListItemDto {
  id: string;
  name: string;
  status: 'ACTIVE' | 'INACTIVE';
  contactEmail: string;
  description?: string | null;
  accountName: string;
  deviceCount: number;
  createdAt: string;
  updatedAt: string;
}

/**
 * Company creation DTO
 */
export interface CreateCompanyDto {
  name: string;
  status: 'ACTIVE' | 'INACTIVE';
  contactEmail: string;
  contactPhone: string;
  address: string;
  description?: string;
  accountId: string;
}

/**
 * Company update DTO
 */
export interface UpdateCompanyDto {
  name?: string;
  status?: 'ACTIVE' | 'INACTIVE';
  contactEmail?: string;
  contactPhone?: string;
  address?: string;
  description?: string;
  accountId?: string;
}

/**
 * Company response DTO for API responses
 */
export interface CompanyResponseDto {
  company: CompanyDto;
  message: string;
  timestamp: string;
}

/**
 * Company list response DTO
 */
export interface CompanyListResponseDto {
  companies: CompanyListItemDto[];
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
} 