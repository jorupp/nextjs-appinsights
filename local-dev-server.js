// based on:
//   https://nextjs.org/docs/pages/building-your-application/configuring/custom-server
//   https://github.com/vercel/next.js/discussions/10935

require('@next/env').loadEnvConfig('./', true);
require('./app-insights');

const http = require('http');
const next = require('next');

// production one will use Next's generated server.js, not this one
const dev = process.env.NODE_ENV !== 'production';
const hostname = process.env.HOSTNAME || 'localhost';
const port = parseInt(process.env.PORT || '3000', 10);
// when using middleware `hostname` and `port` must be provided below
const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

app.prepare().then(() => {
    http.createServer(handle)
        .once('error', (err) => {
            console.error(err);
            process.exit(1);
        })
        .listen(port, () => {
            process.env.SERVER_BASE_URL = `http://${hostname}:${port}`;
            console.log(`> Ready on http://${hostname}:${port}`);
        });
});
