export interface GetAllGovernate {
  governateId: number;
  name: string;
  latitude: string;
  longitude: string;
  areas: {
    areaId: number;
    name: string;
    latitude: string;
    longitude: string | null;
  }[];
}
