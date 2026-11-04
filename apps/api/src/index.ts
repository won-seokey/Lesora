import { createApp } from './app.ts';
const port = Number(process.env.PORT ?? 4000);
const server = createApp().listen(port, process.env.HOST ?? '127.0.0.1', () => {
  console.log(`Lesora PoC API listening on port ${port}; external calls require explicit configuration.`);
});
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => server.close());
