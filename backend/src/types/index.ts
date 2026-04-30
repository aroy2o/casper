export type UserRole = "admin" | "analyst" | "viewer";
export type Region = "assam" | "meghalaya" | "arunachal" | "manipur" | "national";
export type ProjectType = "road" | "bridge" | "railway" | "building" | "drainage" | "other";
export type TenderStatus = "pending" | "parsing" | "analyzing" | "flagged" | "clean" | "insufficient_data" | "error";
export type RiskLevel = "low" | "medium" | "high" | "critical";

export interface ApiError {
  code: string;
  message: string;
  stack?: string;
  retryAfter?: number;
}

export interface ApiSuccess<T> {
  success: true;
  data: T;
  meta?: {
    total?: number;
    page?: number;
    limit?: number;
  };
}

export interface ApiFailure {
  success: false;
  error: ApiError;
}

export type ApiResponse<T> = ApiSuccess<T> | ApiFailure;

export interface PricePoint {
  material: string;
  unit: string;
  priceINR: number;
  source: string;
  sourceURL: string;
  region: Region;
  scrapedAt: Date;
}
