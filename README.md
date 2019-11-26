# multi-region-watson-assistant

This sample app demonstrates how to use the circuit breaker pattern to fail over Watson Assistant requests from one region to another.

See [blog title](blog URL) for details.


# Running the app

1. Install dependencies

    ```
    npm install
    ```

1. Update config.json with proper values for your Watson Assistant instance

1. Start the application

    ```
    npm start
    ```

1. Send messages to Watson Assistant via a POST request

    ```
    curl -X POST \
      http://localhost:3000/message \
      -H 'Content-Type: application/json' \
      -d '{
	    "text": "hello",
	    "context": {}
    }'
    ```

1. For subsequent requests, use the `context` from the previous response.
