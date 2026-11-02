import type { Location, VenueKey } from "./types";

export const VENUES: Record<VenueKey, Location> = {
  goals: { feature: "Goals Reading", address: "Woodlands Avenue, Woodley, Reading", latitude: "51.453648", longitude: "-0.9185121" },
  kingsAcademy: { feature: "King’s Academy Prospect", address: "King's Academy Prospect, Cockney Hill, Tilehurst, Reading RG30 4EX", latitude: "51.44725212792346", longitude: "-1.01962455537632" },
  woodfordPark3G: { feature: "Woodford Park - 3G", address: "Woodford Park Leisure Centre, Haddon Dr, Woodley, Reading, RG5 4LY", latitude: "51.457008", longitude: "-0.9058048" },
  woodfordParkGrass: { feature: "Woodford Park - Grass", address: "Woodford Park Leisure Centre, Haddon Dr, Woodley, Reading, RG5 4LY", latitude: "51.457008", longitude: "-0.9058048" },
  cintraPark: { feature: "Cintra Park", address: "Cintra Park, Reading, RG2 7ES", latitude: "51.442006", longitude: "-0.958364" },
  northStreetTheale: { feature: "North Street Theale", address: "Englefield Rd, Theale, Reading RG7 5AS", latitude: "51.438580113890666", longitude: "-1.0837532493059963" },
};

export const venueFromFeature = (feature: string): VenueKey => {
  const key = (Object.keys(VENUES) as VenueKey[]).find((k) => VENUES[k].feature === feature);
  if (!key) throw new Error(`Unknown Spond location "${feature}"`);
  return key;
};
