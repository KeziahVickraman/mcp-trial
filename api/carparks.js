import { carpark } from "../lib/lta.js";

export default async function handler(req, res) {
  try {
    const lat = req.query.lat ? parseFloat(req.query.lat) : undefined;
    const lng = req.query.lng ? parseFloat(req.query.lng) : undefined;
    const radius_m = req.query.radius_m ? parseFloat(req.query.radius_m) : undefined;
    const min_lots = req.query.min_lots ? parseInt(req.query.min_lots, 10) : undefined;

    const result = await carpark({ lat, lng, radius_m, min_lots });
    res.setHeader("Content-Type", "application/json");
    res.statusCode = 200;
    res.end(JSON.stringify(result));
  } catch (err) {
    const status = err.status || 500;
    res.setHeader("Content-Type", "application/json");
    res.statusCode = status;
    res.end(
      JSON.stringify({
        error: `Failed to fetch carpark data from LTA DataMall with status ${status}.`
      })
    );
  }
}
