import createError from 'http-errors';
import express from 'express';
import path from 'path';
import cookieParser from 'cookie-parser';
import logger from 'morgan';
import WebSocket from 'ws';
import { VoiceResponse } from 'twilio/lib/twiml/VoiceResponse';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const wss = new WebSocket.Server({ noServer: true });

// Configuration
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const PORT = parseInt(process.env.PORT || '5050');

const SYSTEM_MESSAGE = "You are a helpful and bubbly AI assistant who answers any questions I ask";
const VOICE = 'alloy';
const LOG_EVENT_TYPES = [
  'response.content.done', 'rate_limits.updated', 'response.done',
  'input_audio_buffer.committed', 'input_audio_buffer.speech_stopped',
  'input_audio_buffer.speech_started', 'response.create', 'session.created'
];
const SHOW_TIMING_MATH = false;

if (!OPENAI_API_KEY) {
  throw new Error('Missing the OpenAI API key. Please set it in the .env file.');
}

// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'jade');

app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

// Routes
app.get('/', (req, res) => {
  res.send('<html><body><h1>Twilio Media Stream Server is running!</h1></body></html>');
});

app.all('/incoming-call', (req, res) => {
  console.log("Received incoming call request from:", req.ip);
  
  const response = new VoiceResponse();
  const host = req.get('host');
  const connect = response.connect();
  connect.stream({ url: `wss://${host}/media-stream` });
  
  res.type('text/xml');
  res.send(response.toString());
});

// WebSocket handling
wss.on('connection', async (ws) => {
  console.log("Client connected");

  const openaiWs = new WebSocket('wss://api.openai.com/v1/realtime?model=gpt-4o-realtime-preview-2024-10-01', {
    headers: {
      'Authorization': `Bearer ${OPENAI_API_KEY}`,
      'OpenAI-Beta': 'realtime=v1'
    }
  });

  let streamSid: string | null = null;
  let latestMediaTimestamp = 0;
  let lastAssistantItem: string | null = null;
  let markQueue: string[] = [];
  let responseStartTimestampTwilio: number | null = null;

  // Handle messages from Twilio
  ws.on('message', async (message: string) => {
    try {
      const data = JSON.parse(message);
      
      if (data.event === 'media' && openaiWs.readyState === WebSocket.OPEN) {
        latestMediaTimestamp = parseInt(data.media.timestamp);
        const audioAppend = {
          type: "input_audio_buffer.append",
          audio: data.media.payload
        };
        openaiWs.send(JSON.stringify(audioAppend));
      } else if (data.event === 'start') {
        streamSid = data.start.streamSid;
        console.log(`Incoming stream has started ${streamSid}`);
        responseStartTimestampTwilio = null;
        latestMediaTimestamp = 0;
        lastAssistantItem = null;
      }
    } catch (error) {
      console.error('Error processing message:', error);
    }
  });

  // Handle messages from OpenAI
  openaiWs.on('message', async (message: string) => {
    try {
      const response = JSON.parse(message);
      
      if (LOG_EVENT_TYPES.includes(response.type)) {
        console.log(`Received event: ${response.type}`, response);
      }

      if (response.type === 'response.audio.delta' && response.delta) {
        const audioPayload = Buffer.from(response.delta, 'base64').toString('base64');
        const audioDelta = {
          event: "media",
          streamSid,
          media: {
            payload: audioPayload
          }
        };
        ws.send(JSON.stringify(audioDelta));

        if (responseStartTimestampTwilio === null) {
          responseStartTimestampTwilio = latestMediaTimestamp;
          if (SHOW_TIMING_MATH) {
            console.log(`Setting start timestamp for new response: ${responseStartTimestampTwilio}ms`);
          }
        }

        if (response.item_id) {
          lastAssistantItem = response.item_id;
        }
      }
    } catch (error) {
      console.error('Error processing OpenAI message:', error);
    }
  });

  // Send initial session configuration
  const sessionUpdate = {
    type: "session.update",
    session: {
      turn_detection: { type: "server_vad" },
      input_audio_format: "g711_ulaw",
      output_audio_format: "g711_ulaw",
      voice: VOICE,
      instructions: SYSTEM_MESSAGE,
      modalities: ["text", "audio"],
      temperature: 0.8,
    }
  };
  
  openaiWs.send(JSON.stringify(sessionUpdate));

  // Cleanup on connection close
  ws.on('close', () => {
    console.log('Client disconnected');
    openaiWs.close();
  });
});

// Error handling
app.use((req, res, next) => {
  next(createError(404));
});

app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  res.locals.message = err.message;
  res.locals.error = req.app.get('env') === 'development' ? err : {};

  res.status(err.status || 500);
  res.render('error');
});

export { app, wss }; 