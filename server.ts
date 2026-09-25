import express from 'express';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import handler from './api/mcp.js';
import askHandler from './api/ask.js';
import sendAlertHandler from './api/send-alert.js';
import { carpark, ev } from './lib/lta.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT) || 3000;

  app.use(express.json());

  // Register MCP Streamable HTTP handler for POST and GET
  app.post('/api/mcp', handler);
  app.get('/api/mcp', handler);
  app.post('/api.mcp', handler);
  app.get('/api.mcp', handler);

  // Register Gemini Agent MCP client endpoint
  app.post('/api/ask', askHandler);

  // Register Human-in-the-Loop Send Alert endpoint (not an MCP tool)
  app.post('/api/send-alert', sendAlertHandler);

  // Data routes
  app.get('/api/carparks', async (req, res) => {
    try {
      const lat = req.query.lat ? parseFloat(req.query.lat as string) : undefined;
      const lng = req.query.lng ? parseFloat(req.query.lng as string) : undefined;
      const radius_m = req.query.radius_m ? parseFloat(req.query.radius_m as string) : undefined;
      const min_lots = req.query.min_lots ? parseInt(req.query.min_lots as string, 10) : undefined;

      const result = await carpark({ lat, lng, radius_m, min_lots });
      res.json(result);
    } catch (err: any) {
      const status = err.status || 500;
      res.status(status).json({
        error: `Failed to fetch carpark data from LTA DataMall with status ${status}.`
      });
    }
  });

  app.get('/api/ev-chargers', async (req, res) => {
    try {
      const lat = req.query.lat ? parseFloat(req.query.lat as string) : undefined;
      const lng = req.query.lng ? parseFloat(req.query.lng as string) : undefined;
      const radius_m = req.query.radius_m ? parseFloat(req.query.radius_m as string) : undefined;
      const plug_type = req.query.plug_type as string | undefined;

      const result = await ev({ lat, lng, radius_m, plug_type });
      res.json(result);
    } catch (err: any) {
      const status = err.status || 500;
      res.status(status).json({
        error: `Failed to fetch EV charging data from LTA DataMall with status ${status}.`
      });
    }
  });

  if (process.env.NODE_ENV === 'production') {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (_req, res) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  } else {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer();
