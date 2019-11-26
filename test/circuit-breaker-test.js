/* eslint-env mocha */
/* eslint-disable prefer-arrow-callback */
/* eslint-disable no-underscore-dangle */
/* eslint-disable max-len */

const chai = require('chai');

const expect = chai.expect;
const assert = chai.assert;

const CircuitBreaker = require('../lib/circuit-breaker');

const DEFAULT_TIME_PERIOD = '100'; // Time to wait before resetting the error count. Set so tests don't hang 30 seconds before ending.

function succeeds() {
  return new Promise((resolve) => {
    resolve('succeeds');
  });
}

function fails() {
  return new Promise((resolve, reject) => {
    reject(new Error('fails'));
  });
}

function slow() {
  return new Promise((resolve) => {
    setTimeout(function () {
      resolve('slow');
    }, 200);
  });
}

describe('-------- CircuitBreaker --------', () => {
  it('does not open on successful operations', async () => {
    const c = new CircuitBreaker({ reset_period: 10, time_period: DEFAULT_TIME_PERIOD });
    const result = await c.run(succeeds);
    expect(result).to.eql('succeeds');
    assert(c.isClosed(), 'circuit should stay closed when function succeeds');
  });

  it('opens after max_failures is reached', async () => {
    const c = new CircuitBreaker({ max_failures: 2, reset_period: 100, time_period: DEFAULT_TIME_PERIOD });

    // First failure
    try {
      await c.run(fails);
      assert.fail('function expected to fail');
    } catch (error) {
      assert(!error.openCircuit, 'error.openCircuit should not be true when circuit is closed');
      assert(c.isClosed(), 'circuit should be closed when error count is not greater than max failures');
    }

    // Second failure
    try {
      await c.run(fails);
      assert.fail('function expected to fail');
    } catch (error) {
      assert(!error.openCircuit, 'error.openCircuit should not be true when function did not fail on open circuit');
      assert(c.isOpen(), 'circuit should be opened when error count reaches max failures');
    }

    // Third failure - fail on open circuit
    try {
      await c.run(fails);
      assert.fail('function expected to fail');
    } catch (error) {
      assert(error.openCircuit, 'error.openCircuit should be true when error count is greater than max failures');
      assert(c.isOpen(), 'circuit should be open when error count is greater than max failures');
    }
  });

  it('goes to half open after reset_period', async () => {
    const c = new CircuitBreaker({ max_failures: 1, reset_period: 10, time_period: DEFAULT_TIME_PERIOD });
    try {
      await c.run(fails);
      assert.fail('function expected to fail');
    } catch (error) {
      assert(c.isOpen(), 'circuit should be opened when error count reaches max failures');
    }

    await (new Promise(resolve => setTimeout(resolve, 20)));

    assert(c.isHalfOpen(), 'circuit should be half open after reset period');
  });

  it('goes to closed after success following reset_period', async () => {
    const c = new CircuitBreaker({ max_failures: 1, reset_period: 10, time_period: DEFAULT_TIME_PERIOD });

    try {
      await c.run(fails);
      assert.fail('function expected to fail');
    } catch (error) {
      assert(!error.openCircuit, 'error.openCircuit should not be true when failure was not due to open circuit');
    }

    await (new Promise(resolve => setTimeout(resolve, 20)));

    try {
      await c.run(succeeds);
    } catch (error) {
      assert.fail('function not expected to fail');
    }

    assert(c.isClosed(), 'circuit should be closed after successful run following reset_period');
  });

  it('goes to open after failure following reset_period', async () => {
    const c = new CircuitBreaker({ max_failures: 1, reset_period: 10, time_period: DEFAULT_TIME_PERIOD });

    try {
      await c.run(fails);
      assert.fail('function expected to fail');
    } catch (error) {
      assert(!error.openCircuit, 'error.openCircuit should not be true when failure was not due to open circuit');
    }

    await (new Promise(resolve => setTimeout(resolve, 20)));

    assert(c.isHalfOpen(), 'circuit should be half open after reset period');

    try {
      await c.run(fails);
      assert.fail('function expected to fail');
    } catch (error) {
      assert(!error.openCircuit, 'error.openCircuit should not be true when failure was not due to open circuit');
    }

    assert(c.isOpen(), 'circuit should be open after failed run following reset_period');
  });

  it('does not open when failures happen outside time period', async () => {
    const c = new CircuitBreaker({ max_failures: 2, reset_period: 100, time_period: 10 });
    c.on('open', function () {
      assert.fail('circuit expected to not open');
    });
    try {
      await c.run(fails);
      assert.fail('function expected to fail');
    } catch (error) {
      assert(!error.openCircuit, 'error.openCircuit should not be true when failure was not due to open circuit');
    }

    await (new Promise(resolve => setTimeout(resolve, 20)));

    try {
      await c.run(fails);
      assert.fail('function expected to fail');
    } catch (error) {
      assert(!error.openCircuit, 'error.openCircuit should not be true when failure was not due to open circuit');
    }

    await (new Promise(resolve => setTimeout(resolve, 20)));

    try {
      await c.run(fails);
      assert.fail('function expected to fail');
    } catch (error) {
      assert(!error.openCircuit, 'error.openCircuit should not be true when failure was not due to open circuit');
    }

    assert(c.isClosed(), 'circuit should still be closed after spaced out failures');
  });

  it('produces an error when function exceeds timeout', async () => {
    const c = new CircuitBreaker({
      max_failures: 1, reset_period: 10, time_period: DEFAULT_TIME_PERIOD, timeout: 100
    });
    try {
      await c.run(slow);
    } catch (error) {
      assert(error.timeout, 'function expected to fail due to timeout');
      assert(!error.openCircuit, 'error.openCircuit should not be true when failure was not due to open circuit');
    }
  });
  it('emits an event on open', async () => {
    const c = new CircuitBreaker({ max_failures: 1, reset_period: 10, time_period: 10 });
    let eventEmitted = false;
    c.on('open', function () {
      eventEmitted = true;
    });
    try {
      await c.run(fails);
      assert.fail('function expected to fail');
    } catch (error) {
      assert(!error.openCircuit, 'error.openCircuit should not be true when failure was not due to open circuit');
      assert(eventEmitted, 'should emit an open event when circuit opens');
    }
  });
  it('emits an event on half open', async () => {
    const c = new CircuitBreaker({ max_failures: 1, reset_period: 10, time_period: 10 });
    let eventEmitted = false;
    c.on('half_open', function () {
      eventEmitted = true;
    });
    try {
      await c.run(fails);
      assert.fail('function expected to fail');
    } catch (error) {
      assert(!error.openCircuit, 'error.openCircuit should not be true when failure was not due to open circuit');
    }
    await (new Promise(resolve => setTimeout(resolve, 20)));
    assert(eventEmitted, 'should emit a half open event when reset period passes');
  });
  it('emits an event on closed', async () => {
    const c = new CircuitBreaker({ max_failures: 1, reset_period: 10, time_period: 10 });
    let eventEmitted = false;
    c.on('closed', function () {
      eventEmitted = true;
    });
    try {
      await c.run(fails);
      assert.fail('function expected to fail');
    } catch (error) {
      assert(!error.openCircuit, 'error.openCircuit should not be true when failure was not due to open circuit');
    }
    assert(c.isOpen(), 'circuit should be open after failed run');
    await (new Promise(resolve => setTimeout(resolve, 20)));

    try {
      await c.run(succeeds);
    } catch (error) {
      assert.fail('function not expected to fail');
    }
    assert(c.isClosed(), 'circuit should be closed after successful run following reset period');
    assert(eventEmitted, 'should emit a closed event after reset period passes and successful run occurs');
  });
  it('does not emit duplicate open events', async () => {
    const c = new CircuitBreaker({ max_failures: 1, reset_period: 10, time_period: 10 });
    let eventCount = 0;
    c.on('open', function () {
      eventCount += 1;
    });
    for (let i = 0; i < 3; i += 1) {
      try {
        await c.run(fails); // eslint-disable-line no-await-in-loop
        assert.fail('function expected to fail');
      } catch (error) {
        if (i === 0) {
          assert(!error.openCircuit, 'error.openCircuit should not be true when failure was not due to open circuit');
        } else {
          assert(error.openCircuit, 'error.openCircuit should be true when failure was due to open circuit');
        }
      }
    }
    assert(eventCount === 1, 'exactly one open event should be emitted');
  });
});
