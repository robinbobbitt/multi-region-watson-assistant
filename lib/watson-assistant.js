const AssistantV1 = require('ibm-watson/assistant/v1');
const { IamAuthenticator } = require('ibm-watson/auth');
const CircuitBreaker = require('./circuit-breaker');
const config = require('../config.json');

// Set up the CircuitBreaker for Watson Assistant failover from primary to backup region
const cb = new CircuitBreaker(config.circuit_breaker);
cb.on('open', () => {
  console.error(`Watson Assistant Circuit Breaker has opened on instance ${process.env.CF_INSTANCE_INDEX}. All requests will go directly to failover region '${config.watson_assistant.instances.failover.label}'.`);
});
cb.on('closed', () => {
  console.log(`Watson Assistant Circuit Breaker has closed on instance ${process.env.CF_INSTANCE_INDEX}. Requests will resume flow to primary region '${config.watson_assistant.instances.primary.label}'.`);
});
cb.on('half_open', () => {
  console.log('CircuitBreaker is half-open. Ready to attempt next request against primary region.');
});


const messageAssistant = async (assistantConfig, text, context) => {
  try {
    const assistant = new AssistantV1({
      version: '2019-02-28',
      url: assistantConfig.url,
      authenticator: new IamAuthenticator({ apikey: assistantConfig.iam_apikey }),
    });
    const params = {
      workspaceId: assistantConfig.skill_id,
      input: {
        text
      },
      context
    };
    const response = await assistant.message(params);
    return response.result;
  } catch (e) {
    throw new Error(`Error in messageAssistant() - ${e.message}`);
  }
};

exports.message = async (req, res) => {
  const text = req.body.text;
  const context = req.body.context;
  try {
    res.send(await cb.run(async () => messageAssistant(config.watson_assistant.instances.primary, text, context)));
  } catch (error) {
    console.warn(`Failing over to ${config.watson_assistant.instances.failover.label}. Error: ${error.message}. Circuit breaker open: ${error.openCircuit || false}. Circuit breaker timed out: ${error.timeout || false}.`);
    try {
      res.send(await messageAssistant(config.watson_assistant.instances.failover, text, context));
    } catch (failoverError) {
      res.status(500).send({ error: failoverError.message, message: 'Watson Assistant query failed.' });
    }
  }
};
