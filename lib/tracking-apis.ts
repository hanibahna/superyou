// Client-safe list of courier tracking connections (the calls themselves are in lib/tracking.ts).
export type TrackApi = "" | "aramex" | "dhl" | "track17";
export const TRACK_APIS: [TrackApi, string][] = [
  ["", "Link only"],
  ["aramex", "Aramex API"],
  ["dhl", "DHL Express API"],
  ["track17", "17TRACK (any carrier)"],
];
