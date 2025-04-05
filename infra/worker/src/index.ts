import { z } from 'zod';

// Event schema validation
const EventSchema = z.object({
  ts: z.string(),
  project_id: z.string(),
  request_id: z.string(),
  user_id: z.string().optional(),
  route: z.string(),
  provider: z.string(),
  model: z.string(),
  tokens_in: z.number(),
  tokens_out: z.number(),
  cost_usd: z.number(),
  latency_ms: z.number(),
  status: z.string(),
  metadata: z.record(z.any()).optional(),
});

export interface Env {
  EVENTS_BUCKET: R2Bucket;
  WORKER_HMAC_SECRET: string;
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    // Handle CORS
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 200,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        },
      });
    }

    // Only allow POST requests
    if (request.method !== 'POST') {
      return new Response('Method not allowed', { status: 405 });
    }

    try {
      // Parse and validate the request body
      const body = await request.json();
      const event = EventSchema.parse(body);

      // TODO: Add HMAC verification
      // const signature = request.headers.get('Authorization');
      // if (!verifyHmac(body, signature, env.WORKER_HMAC_SECRET)) {
      //   return new Response('Unauthorized', { status: 401 });
      // }

      // Generate file path with partitioning
      const date = new Date(event.ts);
      const dateStr = date.toISOString().split('T')[0]; // YYYY-MM-DD
      const hour = date.getUTCHours().toString().padStart(2, '0');
      
      const key = `dt=${dateStr}/project_id=${event.project_id}/events-${hour}.ndjson`;
      
      // Append to NDJSON file
      const line = JSON.stringify(event) + '\n';
      await env.EVENTS_BUCKET.put(key, line, {
        httpMetadata: {
          contentType: 'application/x-ndjson',
        },
      });

      return new Response('OK', {
        status: 200,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Content-Type': 'application/json',
        },
      });

    } catch (error) {
      console.error('Error processing event:', error);
      
      if (error instanceof z.ZodError) {
        return new Response(JSON.stringify({ error: 'Invalid event format', details: error.errors }), {
          status: 400,
          headers: {
            'Access-Control-Allow-Origin': '*',
            'Content-Type': 'application/json',
          },
        });
      }

      return new Response('Internal server error', {
        status: 500,
        headers: {
          'Access-Control-Allow-Origin': '*',
        },
      });
    }
  },
};
