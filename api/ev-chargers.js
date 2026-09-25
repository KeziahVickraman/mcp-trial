import { ev } from "../lib/lta.js";

export default async function handler(req, res) {
  try {
    const lat = req.query.lat ? parseFloat(req.query.lat) : undefined;
    const lng = req.query.lng ? parseFloat(req.query.lng) : undefined;
    const radius_m = req.query.radius_m ? parseFloat(req.query.radius_m) : undefined;
    const plug_type = req.query.plug_type || undefined;

    const result = await ev({ lat, lng, radius_m, plug_type });
    res.setHeader("Content-Type", "application/json");
    res.statusCode = 200;
    res.end(JSON.stringify(result));
  } catch (err) {
    const status = err.status || 500;
    res.setHeader("Content-Type", "application/json");
    res.statusCode = status;
    res.end(
      JSON.stringify({
        error: `Failed to fetch EV charging data from LTA DataMall with status ${status}.`
      })
    );
  }
}
