/*!
 * @fidesorigin/sdk v0.2.1
 * https://fidesorigin.com
 * 
 * Copyright (c) 2026 FidesOrigin
 * Licensed under the BSL-1.1 License
 */
(function (global, factory) {
  typeof exports === 'object' && typeof module !== 'undefined' ? factory(exports, require('react')) :
  typeof define === 'function' && define.amd ? define(['exports', 'react'], factory) :
  (global = typeof globalThis !== 'undefined' ? globalThis : global || self, factory(global.FidesOrigin = {}, global.React));
})(this, (function (exports, react) { 'use strict';

  // https://github.com/maxogden/websocket-stream/blob/48dc3ddf943e5ada668c31ccd94e9186f02fafbd/ws-fallback.js

  var ws = null;

  if (typeof WebSocket !== 'undefined') {
    ws = WebSocket;
  } else if (typeof MozWebSocket !== 'undefined') {
    ws = MozWebSocket;
  } else if (typeof global !== 'undefined') {
    ws = global.WebSocket || global.MozWebSocket;
  } else if (typeof window !== 'undefined') {
    ws = window.WebSocket || window.MozWebSocket;
  } else if (typeof self !== 'undefined') {
    ws = self.WebSocket || self.MozWebSocket;
  }

  var WebSocket$1 = ws;

  /**
   * FidesOrigin WebSocket Client
   *
   * Provides real-time updates for risk assessments, alerts, and rule matches
   *
   * @example
   * ```typescript
   * const ws = client.createWebSocket({
   *   autoReconnect: true,
   *   subscriptions: ['risk.update', 'alert.new']
   * });
   *
   * ws.on('risk.update', (message) => {
   *   console.log('Risk updated:', message.data);
   * });
   *
   * ws.connect();
   * ```
   */
  class FidesOriginWebSocket {
      get isConnected() {
          return this._isConnected;
      }
      constructor(config, options = {}) {
          this.ws = null;
          this.handlers = new Map();
          this.reconnectCount = 0;
          this.reconnectTimer = null;
          this._isConnected = false;
          this.config = config;
          this.options = {
              autoReconnect: true,
              reconnectInterval: 5000,
              maxReconnectAttempts: 10,
              subscriptions: [],
              ...options
          };
          // Bind handlers
          this.handleOpen = this.handleOpen.bind(this);
          this.handleMessage = this.handleMessage.bind(this);
          this.handleClose = this.handleClose.bind(this);
          this.handleError = this.handleError.bind(this);
      }
      /**
       * Connect to WebSocket server
       */
      connect() {
          if (this.ws?.readyState === WebSocket$1.OPEN) {
              this.log('debug', 'WebSocket already connected');
              return;
          }
          // Convert HTTP URL to WebSocket URL
          const wsUrl = this.getWebSocketUrl();
          this.log('info', 'Connecting to WebSocket', { url: wsUrl });
          try {
              const headers = {};
              if (this.config.apiKey) {
                  headers['Authorization'] = `Bearer ${this.config.apiKey}`;
              }
              this.ws = new WebSocket$1(wsUrl, undefined, { headers });
              this.ws.onopen = this.handleOpen;
              this.ws.onmessage = this.handleMessage;
              this.ws.onclose = this.handleClose;
              this.ws.onerror = this.handleError;
          }
          catch (error) {
              this.log('error', 'Failed to create WebSocket connection', { error });
              this.emit('error', {
                  event: 'error',
                  data: { message: 'Failed to create WebSocket connection', error },
                  timestamp: new Date().toISOString()
              });
          }
      }
      /**
       * Disconnect from WebSocket server
       */
      disconnect() {
          this.log('info', 'Disconnecting WebSocket');
          // Clear any pending reconnect
          if (this.reconnectTimer) {
              clearTimeout(this.reconnectTimer);
              this.reconnectTimer = null;
          }
          // Reset reconnect count
          this.reconnectCount = 0;
          // Close connection
          if (this.ws) {
              // Remove listeners to prevent auto-reconnect
              this.ws.onclose = null;
              this.ws.onerror = null;
              if (this.ws.readyState === WebSocket$1.OPEN || this.ws.readyState === WebSocket$1.CONNECTING) {
                  this.ws.close();
              }
              this.ws = null;
          }
          this._isConnected = false;
      }
      /**
       * Subscribe to event types
       */
      subscribe(eventTypes) {
          if (!this._isConnected || !this.ws) {
              this.log('warn', 'Cannot subscribe: WebSocket not connected');
              return;
          }
          const message = {
              action: 'subscribe',
              events: eventTypes
          };
          this.send(message);
          this.log('debug', 'Subscribed to events', { events: eventTypes });
      }
      /**
       * Unsubscribe from event types
       */
      unsubscribe(eventTypes) {
          if (!this._isConnected || !this.ws) {
              this.log('warn', 'Cannot unsubscribe: WebSocket not connected');
              return;
          }
          const message = {
              action: 'unsubscribe',
              events: eventTypes
          };
          this.send(message);
          this.log('debug', 'Unsubscribed from events', { events: eventTypes });
      }
      /**
       * Register event handler
       */
      on(event, handler) {
          if (!this.handlers.has(event)) {
              this.handlers.set(event, new Set());
          }
          this.handlers.get(event).add(handler);
      }
      /**
       * Remove event handler
       */
      off(event, handler) {
          const handlers = this.handlers.get(event);
          if (handlers) {
              handlers.delete(handler);
          }
      }
      /**
       * Wait for connection to be established
       */
      async waitForConnection(timeout = 10000) {
          if (this._isConnected)
              return;
          return new Promise((resolve, reject) => {
              const timer = setTimeout(() => {
                  reject(new Error('WebSocket connection timeout'));
              }, timeout);
              const handler = () => {
                  clearTimeout(timer);
                  this.off('connection.established', handler);
                  resolve();
              };
              this.on('connection.established', handler);
          });
      }
      // ============================================================================
      // Event Handlers
      // ============================================================================
      handleOpen() {
          this.log('info', 'WebSocket connected');
          this._isConnected = true;
          this.reconnectCount = 0;
          // Subscribe to default events
          if (this.options.subscriptions.length > 0) {
              this.subscribe(this.options.subscriptions);
          }
          this.emit('connection.established', {
              event: 'connection.established',
              data: { timestamp: new Date().toISOString() },
              timestamp: new Date().toISOString()
          });
      }
      handleMessage(data) {
          try {
              const message = JSON.parse(data.data.toString());
              this.log('debug', 'WebSocket message received', { event: message.event });
              this.emit(message.event, message);
          }
          catch (error) {
              this.log('error', 'Failed to parse WebSocket message', { error, data });
          }
      }
      handleClose(event) {
          this.log('info', 'WebSocket closed', { code: event.code, reason: event.reason });
          this._isConnected = false;
          this.emit('connection.closed', {
              event: 'connection.closed',
              data: { code: event.code, reason: event.reason },
              timestamp: new Date().toISOString()
          });
          // Attempt reconnect if enabled
          if (this.options.autoReconnect && this.reconnectCount < this.options.maxReconnectAttempts) {
              this.scheduleReconnect();
          }
      }
      handleError(error) {
          this.log('error', 'WebSocket error', { error });
          this.emit('error', {
              event: 'error',
              data: { message: 'WebSocket error', error },
              timestamp: new Date().toISOString()
          });
      }
      // ============================================================================
      // Private Methods
      // ============================================================================
      send(data) {
          if (!this.ws || this.ws.readyState !== WebSocket$1.OPEN) {
              this.log('warn', 'Cannot send: WebSocket not open');
              return;
          }
          this.ws.send(JSON.stringify(data));
      }
      emit(event, message) {
          const handlers = this.handlers.get(event);
          if (handlers) {
              handlers.forEach(handler => {
                  try {
                      handler(message);
                  }
                  catch (error) {
                      this.log('error', 'Error in event handler', { event, error });
                  }
              });
          }
      }
      scheduleReconnect() {
          this.reconnectCount++;
          this.log('info', `Scheduling reconnect attempt ${this.reconnectCount}/${this.options.maxReconnectAttempts}`);
          this.reconnectTimer = setTimeout(() => {
              this.connect();
          }, this.options.reconnectInterval);
      }
      getWebSocketUrl() {
          let url = this.config.baseUrl;
          // Replace http with ws
          if (url.startsWith('https://')) {
              url = url.replace('https://', 'wss://');
          }
          else if (url.startsWith('http://')) {
              url = url.replace('http://', 'ws://');
          }
          else if (!url.startsWith('ws://') && !url.startsWith('wss://')) {
              // Assume https if no protocol
              url = `wss://${url}`;
          }
          return `${url}/ws`;
      }
      log(level, message, meta) {
          if (!this.config.debug && level === 'debug')
              return;
          const timestamp = new Date().toISOString();
          const logMessage = `[${timestamp}] [${level.toUpperCase()}] [FidesOrigin:WebSocket] ${message}`;
          if (meta) {
              console.log(logMessage, meta);
          }
          else {
              console.log(logMessage);
          }
      }
  }
  /**
   * Type guards for WebSocket events
   */
  function isRiskUpdateEvent(data) {
      return (typeof data === 'object' &&
          data !== null &&
          'address' in data &&
          'risk' in data);
  }
  function isAlertEvent(data) {
      return (typeof data === 'object' &&
          data !== null &&
          'id' in data &&
          'type' in data &&
          'severity' in data);
  }
  function isRuleMatchEvent(data) {
      return (typeof data === 'object' &&
          data !== null &&
          'rule' in data &&
          'address' in data);
  }

  /**
   * FidesOrigin API Client
   *
   * Main client for interacting with FidesOrigin risk assessment API
   */
  class FidesOriginClient {
      constructor(config) {
          this.defaultConfig = {
              timeout: 30000,
              debug: false,
              headers: {}
          };
          this.config = { ...this.defaultConfig, ...config };
          if (!this.config.baseUrl) {
              throw new FidesOriginError('baseUrl is required', 'CONFIG_ERROR');
          }
          // Normalize base URL (remove trailing slash)
          this.config.baseUrl = this.config.baseUrl.replace(/\/$/, '');
          this.log('debug', 'FidesOriginClient initialized', { baseUrl: this.config.baseUrl });
      }
      /**
       * Check risk for a single address
       *
       * @example
       * ```typescript
       * const risk = await client.checkAddress('0x123...', { chain: 'ethereum' });
       * console.log(risk.risk.level); // 'low' | 'medium' | 'high' | 'critical'
       * ```
       */
      async checkAddress(address, options = {}) {
          this.validateAddress(address);
          const params = new URLSearchParams();
          if (options.chain)
              params.append('chain', options.chain);
          if (options.includeEntities)
              params.append('includeEntities', 'true');
          if (options.includeStats)
              params.append('includeStats', 'true');
          const url = `/api/v1/risk/address/${encodeURIComponent(address)}?${params.toString()}`;
          const response = await this.request('GET', url);
          return response.data;
      }
      /**
       * Check risk for multiple addresses in batch
       *
       * @example
       * ```typescript
       * const result = await client.checkBatchAddresses({
       *   addresses: ['0x123...', '0x456...'],
       *   chain: 'ethereum'
       * });
       * ```
       */
      async checkBatchAddresses(request) {
          if (!request.addresses || request.addresses.length === 0) {
              throw new FidesOriginError('addresses array is required', 'VALIDATION_ERROR');
          }
          // Validate all addresses
          request.addresses.forEach(addr => this.validateAddress(addr));
          const response = await this.request('POST', '/api/v1/risk/batch', request);
          return response.data;
      }
      /**
       * List all rules
       */
      async listRules(options = {}) {
          const params = new URLSearchParams();
          if (options.status)
              params.append('status', options.status);
          if (options.page)
              params.append('page', options.page.toString());
          if (options.limit)
              params.append('limit', options.limit.toString());
          const url = `/api/v1/rules?${params.toString()}`;
          const response = await this.request('GET', url);
          return response.data;
      }
      /**
       * Get a specific rule by ID
       */
      async getRule(ruleId) {
          if (!ruleId) {
              throw new FidesOriginError('ruleId is required', 'VALIDATION_ERROR');
          }
          const url = `/api/v1/rules/${encodeURIComponent(ruleId)}`;
          const response = await this.request('GET', url);
          return response.data;
      }
      /**
       * Create a new rule
       */
      async createRule(request) {
          this.validateCreateRuleRequest(request);
          const response = await this.request('POST', '/api/v1/rules', request);
          return response.data;
      }
      /**
       * Update an existing rule
       */
      async updateRule(ruleId, request) {
          if (!ruleId) {
              throw new FidesOriginError('ruleId is required', 'VALIDATION_ERROR');
          }
          const url = `/api/v1/rules/${encodeURIComponent(ruleId)}`;
          const response = await this.request('PATCH', url, request);
          return response.data;
      }
      /**
       * Delete a rule
       */
      async deleteRule(ruleId) {
          if (!ruleId) {
              throw new FidesOriginError('ruleId is required', 'VALIDATION_ERROR');
          }
          const url = `/api/v1/rules/${encodeURIComponent(ruleId)}`;
          await this.request('DELETE', url);
      }
      /**
       * Create a WebSocket connection for real-time updates
       */
      createWebSocket(options = {}) {
          return new FidesOriginWebSocket(this.config, options);
      }
      // ============================================================================
      // Private Methods
      // ============================================================================
      async request(method, path, body) {
          const url = `${this.config.baseUrl}${path}`;
          const headers = {
              'Content-Type': 'application/json',
              'Accept': 'application/json',
              ...this.config.headers
          };
          if (this.config.apiKey) {
              headers['Authorization'] = `Bearer ${this.config.apiKey}`;
          }
          const fetchOptions = {
              method,
              headers,
              signal: AbortSignal.timeout(this.config.timeout || 30000)
          };
          if (body && method !== 'GET' && method !== 'HEAD') {
              fetchOptions.body = JSON.stringify(body);
          }
          this.log('debug', 'API Request', { method, url });
          try {
              const response = await fetch(url, fetchOptions);
              if (!response.ok) {
                  await this.handleErrorResponse(response);
              }
              const data = await response.json();
              this.log('debug', 'API Response', { status: response.status, url });
              return {
                  data,
                  status: response.status
              };
          }
          catch (error) {
              if (error instanceof FidesOriginError) {
                  throw error;
              }
              if (error instanceof TypeError && error.message.includes('fetch')) {
                  throw new FidesOriginError('Network error. Please check your connection.', 'NETWORK_ERROR', { originalError: error.message });
              }
              if (error instanceof DOMException && error.name === 'AbortError') {
                  throw new FidesOriginError('Request timeout. Please try again.', 'TIMEOUT_ERROR', { timeout: this.config.timeout });
              }
              throw new FidesOriginError('An unexpected error occurred', 'UNKNOWN_ERROR', { originalError: String(error) });
          }
      }
      async handleErrorResponse(response) {
          let errorData = {};
          try {
              errorData = await response.json();
          }
          catch {
              // If JSON parsing fails, use status text
              errorData = {
                  code: `HTTP_${response.status}`,
                  message: response.statusText
              };
          }
          throw new FidesOriginError(errorData.message || `HTTP Error ${response.status}`, errorData.code || `HTTP_${response.status}`, errorData.details, response.status);
      }
      validateAddress(address) {
          if (!address || typeof address !== 'string') {
              throw new FidesOriginError('Address is required', 'VALIDATION_ERROR');
          }
          // Basic address format validation
          const ethereumPattern = /^0x[a-fA-F0-9]{40}$/;
          const bitcoinPattern = /^(bc1|[13])[a-zA-HJ-NP-Z0-9]{25,62}$/;
          if (!ethereumPattern.test(address) && !bitcoinPattern.test(address)) {
              throw new FidesOriginError(`Invalid address format: ${address}`, 'VALIDATION_ERROR', { address });
          }
      }
      validateCreateRuleRequest(request) {
          if (!request.name || typeof request.name !== 'string') {
              throw new FidesOriginError('Rule name is required', 'VALIDATION_ERROR');
          }
          if (!Array.isArray(request.conditions) || request.conditions.length === 0) {
              throw new FidesOriginError('At least one condition is required', 'VALIDATION_ERROR');
          }
          if (!Array.isArray(request.actions) || request.actions.length === 0) {
              throw new FidesOriginError('At least one action is required', 'VALIDATION_ERROR');
          }
          // Validate conditions
          request.conditions.forEach((condition, index) => {
              if (!condition.field) {
                  throw new FidesOriginError(`Condition ${index + 1}: field is required`, 'VALIDATION_ERROR');
              }
              if (!condition.operator) {
                  throw new FidesOriginError(`Condition ${index + 1}: operator is required`, 'VALIDATION_ERROR');
              }
          });
          // Validate actions
          request.actions.forEach((action, index) => {
              if (!action.type) {
                  throw new FidesOriginError(`Action ${index + 1}: type is required`, 'VALIDATION_ERROR');
              }
              const validTypes = ['flag', 'block', 'review', 'allow'];
              if (!validTypes.includes(action.type)) {
                  throw new FidesOriginError(`Action ${index + 1}: invalid type. Must be one of: ${validTypes.join(', ')}`, 'VALIDATION_ERROR');
              }
          });
      }
      log(level, message, meta) {
          if (!this.config.debug && level === 'debug')
              return;
          const timestamp = new Date().toISOString();
          const logMessage = `[${timestamp}] [${level.toUpperCase()}] [FidesOrigin] ${message}`;
          if (meta) {
              console.log(logMessage, meta);
          }
          else {
              console.log(logMessage);
          }
      }
  }
  /**
   * FidesOrigin SDK Error Class
   */
  class FidesOriginError extends Error {
      constructor(message, code, details, status) {
          super(message);
          this.name = 'FidesOriginError';
          this.code = code;
          this.details = details;
          this.status = status;
          // Maintain proper stack trace in V8 environments
          if (Error.captureStackTrace) {
              Error.captureStackTrace(this, FidesOriginError);
          }
      }
      toJSON() {
          return {
              name: this.name,
              message: this.message,
              code: this.code,
              details: this.details,
              status: this.status
          };
      }
  }

  /**
   * Risk Assessment Helper Functions
   *
   * Provides convenient methods for risk assessment operations
   */
  /**
   * Quick risk check - one line integration
   *
   * @example
   * ```typescript
   * import { checkAddress } from '@fidesorigin/sdk';
   *
   * const risk = await checkAddress('0x123...', 'YOUR_API_KEY');
   * console.log(risk.risk.level); // 'low', 'medium', 'high', 'critical'
   * ```
   */
  async function checkAddress(address, apiKey, options = {}) {
      const { baseUrl = 'https://api.fidesorigin.com', ...riskOptions } = options;
      const client = new FidesOriginClient({
          baseUrl,
          apiKey
      });
      return client.checkAddress(address, riskOptions);
  }
  /**
   * Batch risk check for multiple addresses
   *
   * @example
   * ```typescript
   * import { checkBatchAddresses } from '@fidesorigin/sdk';
   *
   * const result = await checkBatchAddresses(
   *   ['0x123...', '0x456...'],
   *   'YOUR_API_KEY'
   * );
   * ```
   */
  async function checkBatchAddresses(addresses, apiKey, options = {}) {
      const { baseUrl = 'https://api.fidesorigin.com', chain, detailed } = options;
      const client = new FidesOriginClient({
          baseUrl,
          apiKey
      });
      return client.checkBatchAddresses({
          addresses,
          chain,
          detailed
      });
  }
  /**
   * Check if an address is considered risky
   *
   * @param riskLevel - The risk level to check
   * @param threshold - The threshold level (default: 'medium')
   * @returns true if risk level is at or above threshold
   *
   * @example
   * ```typescript
   * import { isRisky, checkAddress } from '@fidesorigin/sdk';
   *
   * const risk = await checkAddress('0x123...', 'YOUR_API_KEY');
   * if (isRisky(risk.risk.level, 'medium')) {
   *   console.log('Address is risky!');
   * }
   * ```
   */
  function isRisky(riskLevel, threshold = 'medium') {
      const levels = {
          low: 0,
          medium: 1,
          high: 2,
          critical: 3
      };
      return levels[riskLevel] >= levels[threshold];
  }
  /**
   * Check if an address is safe (low risk)
   *
   * @param riskLevel - The risk level to check
   * @returns true if risk level is 'low'
   */
  function isSafe(riskLevel) {
      return riskLevel === 'low';
  }
  /**
   * Get risk color for UI display
   *
   * @param riskLevel - The risk level
   * @returns CSS color value
   */
  function getRiskColor(riskLevel) {
      const colors = {
          low: '#10B981', // Green
          medium: '#F59E0B', // Yellow/Orange
          high: '#EF4444', // Red
          critical: '#7C2D12' // Dark Red
      };
      return colors[riskLevel] || '#6B7280';
  }
  /**
   * Get risk label for display
   *
   * @param riskLevel - The risk level
   * @returns Human readable label
   */
  function getRiskLabel(riskLevel) {
      const labels = {
          low: 'Low Risk',
          medium: 'Medium Risk',
          high: 'High Risk',
          critical: 'Critical Risk'
      };
      return labels[riskLevel] || 'Unknown Risk';
  }
  /**
   * Filter addresses by risk level
   *
   * @param addresses - Array of address risk assessments
   * @param minRiskLevel - Minimum risk level to include
   * @returns Filtered array of risky addresses
   *
   * @example
   * ```typescript
   * const riskyAddresses = filterByRiskLevel(results, 'high');
   * ```
   */
  function filterByRiskLevel(addresses, minRiskLevel) {
      return addresses.filter(addr => isRisky(addr.risk.level, minRiskLevel));
  }
  /**
   * Sort addresses by risk score (highest first)
   *
   * @param addresses - Array of address risk assessments
   * @returns Sorted array
   */
  function sortByRiskScore(addresses) {
      return [...addresses].sort((a, b) => b.risk.score - a.risk.score);
  }
  /**
   * Get risk statistics for a batch of addresses
   *
   * @param addresses - Array of address risk assessments
   * @returns Statistics object
   */
  function getRiskStatistics(addresses) {
      const stats = {
          total: addresses.length,
          byLevel: {
              low: 0,
              medium: 0,
              high: 0,
              critical: 0,
              unknown: 0
          },
          averageScore: 0,
          highestRisk: null
      };
      if (addresses.length === 0) {
          return stats;
      }
      let totalScore = 0;
      let maxScore = -1;
      addresses.forEach(addr => {
          const level = addr.risk?.level || 'unknown';
          stats.byLevel[level]++;
          const score = addr.risk?.score || 0;
          totalScore += score;
          if (score > maxScore) {
              maxScore = score;
              stats.highestRisk = addr;
          }
      });
      stats.averageScore = Math.round((totalScore / addresses.length) * 100) / 100;
      return stats;
  }
  /**
   * Risk Assessment Class
   *
   * Provides a fluent interface for risk assessment operations
   */
  class RiskAssessor {
      constructor(client) {
          this.client = client;
      }
      /**
       * Check single address risk
       */
      async check(address, options) {
          return this.client.checkAddress(address, options);
      }
      /**
       * Check multiple addresses
       */
      async checkBatch(addresses, options) {
          return this.client.checkBatchAddresses({
              addresses,
              ...options
          });
      }
      /**
       * Find high-risk addresses from a list
       */
      async findHighRisk(addresses, threshold = 'high') {
          const result = await this.checkBatch(addresses);
          return filterByRiskLevel(result.results, threshold);
      }
      /**
       * Validate if all addresses are safe
       */
      async validateAllSafe(addresses) {
          const result = await this.checkBatch(addresses);
          const riskyAddresses = filterByRiskLevel(result.results, 'medium');
          return {
              safe: riskyAddresses.length === 0,
              riskyAddresses
          };
      }
  }

  /**
   * Rules Management Helper Functions
   *
   * Provides convenient methods for managing compliance rules
   */
  /**
   * Create a new rule with fluent builder
   *
   * @example
   * ```typescript
   * import { createRuleBuilder } from '@fidesorigin/sdk';
   *
   * const rule = await createRuleBuilder(client)
   *   .name('High Risk Sanctioned Address')
   *   .description('Flag addresses on sanctions list')
   *   .condition('risk.level', 'equals', 'critical')
   *   .condition('flags.category', 'contains', 'sanctions')
   *   .action('flag', { reason: 'Sanctioned entity detected' })
   *   .priority(100)
   *   .build();
   * ```
   */
  function createRuleBuilder(client) {
      return new RuleBuilder(client);
  }
  /**
   * Rule Builder Class
   *
   * Fluent API for creating and updating rules
   */
  class RuleBuilder {
      constructor(client) {
          this.request = {
              conditions: [],
              actions: [],
              priority: 0
          };
          this.client = client;
      }
      /**
       * Set rule name
       */
      name(name) {
          this.request.name = name;
          return this;
      }
      /**
       * Set rule description
       */
      description(description) {
          this.request.description = description;
          return this;
      }
      /**
       * Add a condition to the rule
       */
      condition(field, operator, value) {
          this.request.conditions.push({ field, operator, value });
          return this;
      }
      /**
       * Add multiple conditions (all must match)
       */
      conditions(conditions) {
          this.request.conditions = [...this.request.conditions, ...conditions];
          return this;
      }
      /**
       * Add an action to the rule
       */
      action(type, params) {
          this.request.actions.push({ type, params });
          return this;
      }
      /**
       * Set actions
       */
      actions(actions) {
          this.request.actions = actions;
          return this;
      }
      /**
       * Set rule priority
       */
      priority(priority) {
          this.request.priority = priority;
          return this;
      }
      /**
       * Build and create the rule
       */
      async build() {
          if (!this.request.name) {
              throw new Error('Rule name is required');
          }
          if (!this.request.conditions?.length) {
              throw new Error('At least one condition is required');
          }
          if (!this.request.actions?.length) {
              throw new Error('At least one action is required');
          }
          return this.client.createRule(this.request);
      }
  }
  /**
   * Predefined rule templates
   */
  const RuleTemplates = {
      /**
       * Create a rule to block high-risk addresses
       */
      blockHighRisk(priority = 100) {
          return {
              name: 'Block High Risk Addresses',
              description: 'Automatically block transactions from high and critical risk addresses',
              conditions: [
                  { field: 'risk.level', operator: 'in', value: ['high', 'critical'] }
              ],
              actions: [
                  { type: 'block', params: { reason: 'High risk address detected' } }
              ],
              priority
          };
      },
      /**
       * Create a rule to flag sanctioned addresses
       */
      flagSanctioned(priority = 90) {
          return {
              name: 'Flag Sanctioned Addresses',
              description: 'Flag addresses on sanctions lists for manual review',
              conditions: [
                  { field: 'flags.category', operator: 'contains', value: 'sanctions' }
              ],
              actions: [
                  { type: 'flag', params: { reason: 'Sanctioned entity detected', severity: 'critical' } }
              ],
              priority
          };
      },
      /**
       * Create a rule for mixer detection
       */
      reviewMixerUsage(priority = 50) {
          return {
              name: 'Review Mixer Usage',
              description: 'Flag transactions involving cryptocurrency mixers',
              conditions: [
                  { field: 'type', operator: 'equals', value: 'mixer' }
              ],
              actions: [
                  { type: 'review', params: { reason: 'Mixer usage detected' } }
              ],
              priority
          };
      },
      /**
       * Create a rule for large volume transactions
       */
      reviewLargeVolume(threshold = 100000, priority = 30) {
          return {
              name: `Review Large Volume (>> $${threshold.toLocaleString()})`,
              description: `Flag addresses with transaction volume exceeding $${threshold.toLocaleString()}`,
              conditions: [
                  { field: 'stats.totalVolume', operator: 'greater_than', value: threshold }
              ],
              actions: [
                  { type: 'review', params: { reason: 'Large volume detected' } }
              ],
              priority
          };
      },
      /**
       * Create a custom rule for specific risk score threshold
       */
      riskScoreThreshold(minScore, action = 'review', priority = 50) {
          return {
              name: `Risk Score Threshold (${minScore}+)`,
              description: `Trigger action for addresses with risk score ${minScore} or higher`,
              conditions: [
                  { field: 'risk.score', operator: 'greater_than', value: minScore }
              ],
              actions: [
                  { type: action, params: { threshold: minScore } }
              ],
              priority
          };
      }
  };
  /**
   * Rules Manager Class
   *
   * High-level interface for rule management
   */
  class RulesManager {
      constructor(client) {
          this.client = client;
      }
      /**
       * List all rules with optional filtering
       */
      async list(options) {
          return this.client.listRules(options);
      }
      /**
       * Get active rules only
       */
      async getActive() {
          const response = await this.client.listRules({ status: 'active' });
          return response.rules;
      }
      /**
       * Get a rule by ID
       */
      async get(ruleId) {
          return this.client.getRule(ruleId);
      }
      /**
       * Create a new rule using the builder
       */
      builder() {
          return new RuleBuilder(this.client);
      }
      /**
       * Create a rule from a template
       */
      async createFromTemplate(template, ...args) {
          const templateFn = RuleTemplates[template];
          const request = templateFn(...args);
          return this.client.createRule(request);
      }
      /**
       * Update a rule
       */
      async update(ruleId, request) {
          return this.client.updateRule(ruleId, request);
      }
      /**
       * Activate a rule
       */
      async activate(ruleId) {
          return this.client.updateRule(ruleId, { status: 'active' });
      }
      /**
       * Deactivate a rule
       */
      async deactivate(ruleId) {
          return this.client.updateRule(ruleId, { status: 'inactive' });
      }
      /**
       * Delete a rule
       */
      async delete(ruleId) {
          return this.client.deleteRule(ruleId);
      }
      /**
       * Get rules by priority
       */
      async getByPriority(minPriority) {
          const response = await this.client.listRules();
          return response.rules.filter(rule => rule.priority >= minPriority);
      }
      /**
       * Enable default compliance rules
       */
      async enableDefaults() {
          const rules = [];
          // Block high risk
          rules.push(await this.createFromTemplate('blockHighRisk', 100));
          // Flag sanctioned
          rules.push(await this.createFromTemplate('flagSanctioned', 90));
          // Review mixer usage
          rules.push(await this.createFromTemplate('reviewMixerUsage', 50));
          return rules;
      }
  }

  /**
   * React Hook for risk assessment
   *
   * Provides reactive risk checking with polling support
   *
   * @example
   * ```tsx
   * import { useRiskCheck } from '@fidesorigin/sdk/react';
   *
   * function RiskIndicator({ address }: { address: string }) {
   *   const { data, loading, error, refetch } = useRiskCheck(address, {
   *     client,
   *     pollInterval: 30000 // Refresh every 30 seconds
   *   });
   *
   *   if (loading) return <Spinner />;
   *   if (error) return <Error message={error.message} />;
   *   if (!data) return null;
   *
   *   return (
   *     <div className={`risk-${data.risk.level}`}>
   *       Risk Level: {data.risk.level}
   *       <button onClick={refetch}>Refresh</button>
   *     </div>
   *   );
   * }
   * ```
   */
  function useRiskCheck(address, options) {
      const { client, pollInterval = 0, enabled = true, ...riskOptions } = options;
      const [state, setState] = react.useState({
          loading: false,
          error: null,
          data: null
      });
      const pollTimerRef = react.useRef(null);
      const abortControllerRef = react.useRef(null);
      const fetchRisk = react.useCallback(async () => {
          if (!address || !enabled)
              return;
          // Cancel previous request
          if (abortControllerRef.current) {
              abortControllerRef.current.abort();
          }
          abortControllerRef.current = new AbortController();
          setState(prev => ({ ...prev, loading: true, error: null }));
          try {
              const result = await client.checkAddress(address, riskOptions);
              setState({
                  loading: false,
                  error: null,
                  data: result
              });
          }
          catch (err) {
              const error = err;
              setState({
                  loading: false,
                  error: {
                      code: error.code || 'UNKNOWN_ERROR',
                      message: error.message || 'An error occurred',
                      details: error.details
                  },
                  data: null
              });
          }
      }, [address, client, enabled, ...Object.values(riskOptions)]);
      const clear = react.useCallback(() => {
          if (pollTimerRef.current) {
              clearInterval(pollTimerRef.current);
              pollTimerRef.current = null;
          }
          if (abortControllerRef.current) {
              abortControllerRef.current.abort();
              abortControllerRef.current = null;
          }
          setState({
              loading: false,
              error: null,
              data: null
          });
      }, []);
      // Initial fetch
      react.useEffect(() => {
          if (enabled && address) {
              fetchRisk();
          }
          return () => {
              if (abortControllerRef.current) {
                  abortControllerRef.current.abort();
              }
          };
      }, [address, enabled, fetchRisk]);
      // Setup polling
      react.useEffect(() => {
          if (pollInterval > 0 && enabled && address) {
              pollTimerRef.current = setInterval(fetchRisk, pollInterval);
          }
          return () => {
              if (pollTimerRef.current) {
                  clearInterval(pollTimerRef.current);
                  pollTimerRef.current = null;
              }
          };
      }, [pollInterval, enabled, address, fetchRisk]);
      return {
          loading: state.loading,
          error: state.error,
          data: state.data,
          refetch: fetchRisk,
          clear
      };
  }
  /**
   * React Hook for batch risk assessment
   *
   * @example
   * ```tsx
   * import { useBatchRiskCheck } from '@fidesorigin/sdk/react';
   *
   * function RiskList({ addresses }: { addresses: string[] }) {
   *   const { data, loading, error } = useBatchRiskCheck(addresses, { client });
   *
   *   if (loading) return <Spinner />;
   *   if (error) return <Error message={error.message} />;
   *
   *   return (
   *     <ul>
   *       {data?.results.map(risk => (
   *         <li key={risk.address}>
   *           {risk.address}: {risk.risk.level}
   *         </li>
   *       ))}
   *     </ul>
   *   );
   * }
   * ```
   */
  function useBatchRiskCheck(addresses, options) {
      const { client, chain, detailed } = options;
      const [state, setState] = react.useState({
          loading: false,
          error: null,
          data: null
      });
      const fetchRisk = react.useCallback(async () => {
          if (!addresses.length)
              return;
          setState(prev => ({ ...prev, loading: true, error: null }));
          try {
              const result = await client.checkBatchAddresses({
                  addresses,
                  chain,
                  detailed
              });
              setState({
                  loading: false,
                  error: null,
                  data: {
                      results: result.results,
                      failed: result.failed || []
                  }
              });
          }
          catch (err) {
              const error = err;
              setState({
                  loading: false,
                  error: {
                      code: error.code || 'UNKNOWN_ERROR',
                      message: error.message || 'An error occurred'
                  },
                  data: null
              });
          }
      }, [addresses, client, chain, detailed]);
      react.useEffect(() => {
          if (addresses.length > 0) {
              fetchRisk();
          }
      }, [addresses.join(','), fetchRisk]);
      return {
          loading: state.loading,
          error: state.error,
          data: state.data,
          refetch: fetchRisk
      };
  }
  /**
   * React Hook for risk level display
   *
   * Returns human-readable labels and colors for risk levels
   */
  function useRiskDisplay() {
      const getColor = react.useCallback((level) => {
          const colors = {
              low: '#10B981',
              medium: '#F59E0B',
              high: '#EF4444',
              critical: '#7C2D12'
          };
          return colors[level] || '#6B7280';
      }, []);
      const getLabel = react.useCallback((level) => {
          const labels = {
              low: 'Low Risk',
              medium: 'Medium Risk',
              high: 'High Risk',
              critical: 'Critical Risk'
          };
          return labels[level] || 'Unknown';
      }, []);
      const getIcon = react.useCallback((level) => {
          const icons = {
              low: '✓',
              medium: '⚠',
              high: '⚠',
              critical: '✕'
          };
          return icons[level] || '?';
      }, []);
      return { getColor, getLabel, getIcon };
  }

  /**
   * FidesOrigin JavaScript/TypeScript SDK
   *
   * Risk assessment and compliance for Web3
   *
   * @example
   * ```typescript
   * import { FidesOriginClient } from '@fidesorigin/sdk';
   *
   * const client = new FidesOriginClient({
   *   baseUrl: 'https://api.fidesorigin.com',
   *   apiKey: 'your-api-key'
   * });
   *
   * // Quick check
   * const risk = await client.checkAddress('0x123...');
   * console.log(risk.risk.level);
   * ```
   *
   * @packageDocumentation
   */
  // Core client
  const fides = {
      checkAddress,
      checkBatchAddresses
  };

  exports.FidesOriginClient = FidesOriginClient;
  exports.FidesOriginError = FidesOriginError;
  exports.FidesOriginWebSocket = FidesOriginWebSocket;
  exports.RiskAssessor = RiskAssessor;
  exports.RuleBuilder = RuleBuilder;
  exports.RuleTemplates = RuleTemplates;
  exports.RulesManager = RulesManager;
  exports.checkAddress = checkAddress;
  exports.checkBatchAddresses = checkBatchAddresses;
  exports.createRuleBuilder = createRuleBuilder;
  exports.default = FidesOriginClient;
  exports.fides = fides;
  exports.filterByRiskLevel = filterByRiskLevel;
  exports.getRiskColor = getRiskColor;
  exports.getRiskLabel = getRiskLabel;
  exports.getRiskStatistics = getRiskStatistics;
  exports.isAlertEvent = isAlertEvent;
  exports.isRiskUpdateEvent = isRiskUpdateEvent;
  exports.isRisky = isRisky;
  exports.isRuleMatchEvent = isRuleMatchEvent;
  exports.isSafe = isSafe;
  exports.sortByRiskScore = sortByRiskScore;
  exports.useBatchRiskCheck = useBatchRiskCheck;
  exports.useRiskCheck = useRiskCheck;
  exports.useRiskDisplay = useRiskDisplay;

  Object.defineProperty(exports, '__esModule', { value: true });

}));
//# sourceMappingURL=fidesorigin.js.map
