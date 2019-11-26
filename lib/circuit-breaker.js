/* eslint-disable no-underscore-dangle */

const EventEmitter = require('events').EventEmitter;

const STATE = Object.freeze({ CLOSED: 'CLOSED', OPEN: 'OPEN', HALF_OPEN: 'HALF_OPEN' });

class CircuitBreaker extends EventEmitter {
  /**
    * Based on several other reviewed circuit breaker samples
    */
  constructor(options = {}) {
    super();
    this.maxFailures = options.max_failures || 5; // default
    this.timeout = options.timeout || (60 * 1000); // 30 s default
    this.timePeriod = options.time_period || (60 * 1000); // 1 min default
    this.resetPeriod = options.reset_period || (5 * 60 * 1000); // 5 min default
    this._errorCount = 0;
    this._state = STATE.CLOSED;
  }

  /**
    * Run the given function with the circuit breaker.
    */
  run(func) {
    const _this = this;
    return new Promise((resolve, reject) => {
      if (_this._state === STATE.OPEN) {
        console.warn('CircuitBreaker is OPEN. Rejecting request.');
        const error = new Error('Circuit breaker open');
        error.openCircuit = true;
        return reject(error);
      }
      console.log(`CircuitBreaker State: ${_this._state} Error Count: ${_this._errorCount}`);

      const timeoutId = setTimeout(() => {
        console.warn('CircuitBreaker timed out the request. Rejecting request.');
        const timeoutError = new Error('ETIMEDOUT (circuit breaker)');
        timeoutError.timeout = true;
        reject(timeoutError);
        _this._handleError();
      }, this.timeout);

      return func().then((result) => {
        if (_this._state === STATE.HALF_OPEN) {
          _this._closeCircuit();
        }
        return resolve(result);
      }).catch((error) => {
        console.warn(`CircuitBreaker caught an error processing request. Rejecting request. Error: ${error.message}`);
        _this._handleError(error);
        return reject(error);
      }).finally(() => {
        clearTimeout(timeoutId);
      });
    });
  }

  _handleError() {
    this._errorCount += 1;
    if (this._state === STATE.HALF_OPEN || (this._state === STATE.CLOSED && this._errorCount >= this.maxFailures)) {
      this._openCircuit();
    }
    if (this._errorCount === 1) {
      setTimeout(() => {
        this._errorCount = 0;
      }, this.timePeriod);
    }
  }

  _openCircuit() {
    this._state = STATE.OPEN;
    this.emit('open');
    setTimeout(this._halfOpenCircuit.bind(this), this.resetPeriod);
  }

  _halfOpenCircuit() {
    this._state = STATE.HALF_OPEN;
    this.emit('half_open');
  }

  _closeCircuit() {
    this._state = STATE.CLOSED;
    this._errorCount = 0;
    this.emit('closed');
  }

  isOpen() {
    return this._state === STATE.OPEN;
  }

  isHalfOpen() {
    return this._state === STATE.HALF_OPEN;
  }

  isClosed() {
    return this._state === STATE.CLOSED;
  }
}


module.exports = CircuitBreaker;
