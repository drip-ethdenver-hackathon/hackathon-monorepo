// src/routes/simulateCall.ts
import { Router, Request, Response } from 'express';
import WebSocket from 'ws';

export const simulateCallRouter = Router();

/**
 * Simulate a call by opening real WebSocket connections to /media-stream and /orchestrator-stream,
 * sending Twilio-like events, and collecting logs from both streams.
 */
simulateCallRouter.post('/', async (req: Request, res: Response) => {
  // If your server is local and on a specific port, we can detect that from "req" or environment:
  const host = req.get('host') || 'localhost:5050';
  const logs: any[] = [];

  // 1) Connect to /orchestrator-stream to capture step-by-step agent events
  const orchestratorWs = new WebSocket(`ws://${host}/orchestrator-stream`);

  orchestratorWs.on('open', () => {
    logs.push({
      source: 'simulate',
      event: 'orchestrator_ws.open',
      message: 'Connected to orchestrator stream'
    });
  });

  orchestratorWs.on('message', (rawData) => {
    try {
      const data = JSON.parse(rawData.toString());
      logs.push({ source: 'orchestrator', ...data });
    } catch (err) {
      logs.push({ source: 'orchestrator', event: 'parse_error', error: String(err) });
    }
  });

  orchestratorWs.on('close', () => {
    logs.push({ source: 'orchestrator', event: 'closed' });
  });

  orchestratorWs.on('error', (err) => {
    logs.push({ source: 'orchestrator', event: 'error', error: String(err) });
  });

  // 2) Connect to /media-stream, simulating Twilio Media
  const twilioWs = new WebSocket(`ws://${host}/media-stream`);

  twilioWs.on('open', () => {
    logs.push({
      source: 'simulate',
      event: 'twilio_ws.open',
      message: 'Connected to media-stream'
    });
    
    // a) "start" event, simulating Twilio
    const streamSid = 'mockStreamSid-12345';
    twilioWs.send(JSON.stringify({
      event: 'start',
      start: { streamSid }
    }));
    logs.push({ source: 'simulate', event: 'sent.start', details: { streamSid } });
    
    // b) "media" event, simulating user audio chunk
    twilioWs.send(JSON.stringify({
      event: 'media',
      media: {
        payload: 'SOME_BASE64_G711_DATA',
        timestamp: Date.now().toString()
      }
    }));
    logs.push({ source: 'simulate', event: 'sent.media', details: 'Sent sample audio chunk' });
  });

  twilioWs.on('message', (rawData) => {
    try {
      const data = JSON.parse(rawData.toString());
      logs.push({ source: 'twilio', ...data });
    } catch (err) {
      logs.push({ source: 'twilio', event: 'parse_error', error: String(err) });
    }
  });

  twilioWs.on('close', () => {
    logs.push({ source: 'twilio', event: 'close', message: 'media-stream closed' });
  });

  twilioWs.on('error', (err) => {
    logs.push({ source: 'twilio', event: 'error', error: String(err) });
  });

  // 3) Wait ~4 seconds so the orchestrator + openAI can process
  await new Promise<void>((resolve) => {
    setTimeout(() => {
      try {
        if (twilioWs.readyState === WebSocket.OPEN) {
          twilioWs.close();
        }
        if (orchestratorWs.readyState === WebSocket.OPEN) {
          orchestratorWs.close();
        }
      } catch {}
      resolve();
    }, 4000);
  });

  // 4) Return logs
  return res.json({ success: true, logs });
});
