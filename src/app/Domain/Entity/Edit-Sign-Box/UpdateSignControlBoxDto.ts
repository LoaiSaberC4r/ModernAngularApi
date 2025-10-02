export interface UpdateSignControlBoxDto {
  id: number;
  name?: string;
  ipAddress?: string;
  directions?: { name?: string }[];
}
