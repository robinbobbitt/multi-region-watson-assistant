const app = require('express')();
const bodyParser = require('body-parser');
const watsonAssistant = require('./lib/watson-assistant');

const port = process.env.PORT || 3000;

app.use(bodyParser.json());
app.post('/message', watsonAssistant.message);

app.listen(port, () => console.log(`Watson Assistant failover sample app listening on port ${port}.`));
