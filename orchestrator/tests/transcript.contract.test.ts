import assert from 'node:assert/strict';
import { test } from 'node:test';

const llm = require('../src/llm/client') as Record<string, any>;
const productId = '44444444-4444-4444-8444-444444444444';

function wireCall(name: string, args: unknown, id: string) {
  return { id, type: 'function', function: { name, arguments: JSON.stringify(args) } };
}

test('provider response normalization preserves complete assistant call and raw arguments', () => {
  assert.equal(typeof llm.normalizeLlmResponse, 'function');
  if (typeof llm.normalizeLlmResponse !== 'function') return;
  const rawArguments = '{ "query" : "lamp", "category":"home" }';
  const providerMessage = {
    role: 'assistant',
    content: 'Looking up products',
    tool_calls: [{ id: 'call-raw', type: 'function', function: { name: 'search_dropi_catalog', arguments: rawArguments } }],
  };
  const normalized = llm.normalizeLlmResponse({ choices: [{ message: providerMessage }] });
  assert.equal(normalized.toolCalls[0].arguments, rawArguments);
  assert.equal(normalized.toolCalls[0].type, 'function');
  assert.deepEqual(normalized.assistantMessage, providerMessage);
});

test('provider tool batch validation rejects malformed and mismatched calls atomically', () => {
  assert.equal(typeof llm.validateProviderToolBatch, 'function');
  if (typeof llm.validateProviderToolBatch !== 'function') return;
  const validCall = wireCall('score_product', { product_id: productId }, 'call-1');
  const validResponse = {
    content: null,
    toolCalls: [{ id: validCall.id, type: validCall.type, name: validCall.function.name, arguments: validCall.function.arguments }],
    assistantMessage: { role: 'assistant', content: null, tool_calls: [validCall] },
  };
  assert.deepEqual(llm.validateProviderToolBatch(validResponse), [{
    id: 'call-1', type: 'function', name: 'score_product', arguments: validCall.function.arguments,
    parsedArguments: { product_id: productId }, wireCall: validCall,
  }]);
  const invalidResponses = [
    { ...validResponse, toolCalls: [{ ...validResponse.toolCalls[0], arguments: '{' }] },
    { ...validResponse, toolCalls: [{ ...validResponse.toolCalls[0], id: 'other-id' }] },
    { ...validResponse, toolCalls: [{ ...validResponse.toolCalls[0], name: 'publish_product' }] },
    { ...validResponse, toolCalls: [{ ...validResponse.toolCalls[0], arguments: JSON.stringify({ product_id: 'bad' }) }] },
    { ...validResponse, toolCalls: [{ ...validResponse.toolCalls[0], arguments: JSON.stringify({ product_id: productId, tenant_id: productId }) }] },
  ];
  for (const response of invalidResponses) assert.throws(() => llm.validateProviderToolBatch(response));
  const duplicate = {
    content: null,
    toolCalls: [validResponse.toolCalls[0], validResponse.toolCalls[0]],
    assistantMessage: { role: 'assistant', content: null, tool_calls: [validCall, validCall] },
  };
  assert.throws(() => llm.validateProviderToolBatch(duplicate));
});

test('transcript validator requires each assistant call to have exactly one matching tool result', () => {
  assert.equal(typeof llm.validateToolTranscript, 'function');
  if (typeof llm.validateToolTranscript !== 'function') return;
  const first = wireCall('search_dropi_catalog', { query: 'lamp' }, 'call-1');
  const second = wireCall('score_product', { product_id: productId }, 'call-2');
  const assistant = { role: 'assistant', content: null, tool_calls: [first, second] };
  const searchResult = { role: 'tool', tool_call_id: 'call-1', name: 'search_dropi_catalog', content: '{}' };
  const scoreResult = { role: 'tool', tool_call_id: 'call-2', name: 'score_product', content: '{}' };
  assert.equal(llm.validateToolTranscript([assistant, searchResult, scoreResult]), true);
  for (const messages of [
    [assistant, searchResult],
    [assistant, searchResult, searchResult],
    [assistant, { ...scoreResult, tool_call_id: 'unknown' }, searchResult],
    [assistant, { ...scoreResult, name: 'search_dropi_catalog', tool_call_id: 'call-2' }, searchResult],
    [assistant, { role: 'assistant', content: 'next turn' }, searchResult],
  ]) assert.throws(() => llm.validateToolTranscript(messages));
});
