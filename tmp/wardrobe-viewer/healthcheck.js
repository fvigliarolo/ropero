import http from 'http';

const port = Number(process.env.PORT || 4782);

const req = http.request({
  host: '127.0.0.1',
  port,
  path: '/healthz',
  method: 'GET',
  timeout: 10000,
}, (res) => {
  if (res.statusCode !== 200) {
    console.error(`Healthcheck failed with status ${res.statusCode}`);
    process.exit(1);
  }

  let body = '';
  res.on('data', chunk => { body += chunk; });
  res.on('end', () => {
    try {
      const data = JSON.parse(body);
      if (data.ok !== true) throw new Error('ok missing');
      console.log('OK');
      process.exit(0);
    } catch (error) {
      console.error(`Healthcheck parse failed: ${error.message}`);
      process.exit(1);
    }
  });
});

req.on('error', (error) => {
  console.error(`Healthcheck request failed: ${error.message}`);
  process.exit(1);
});

req.on('timeout', () => {
  console.error('Healthcheck timeout');
  req.destroy();
  process.exit(1);
});

req.end();
