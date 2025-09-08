import fastifyPlugin from 'fastify-plugin';
import { realtimePlugin } from '../services/realtime.js';

export default fastifyPlugin(realtimePlugin, {
  name: 'realtime-plugin',
  dependencies: ['env'],
});
