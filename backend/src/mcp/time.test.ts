import assert from 'node:assert/strict';
import { test } from 'node:test';
import { addDaysWall, jstWallNow, parseToJstWall, wallToIso } from './time.js';

test('offset-less values are taken as JST wall clock', () => {
  assert.equal(parseToJstWall('2026-10-20T10:00'), '2026-10-20 10:00:00');
  assert.equal(parseToJstWall('2026-10-20 10:00:30'), '2026-10-20 10:00:30');
});

test('values with an offset are converted to JST', () => {
  assert.equal(parseToJstWall('2026-10-20T10:00:00+09:00'), '2026-10-20 10:00:00');
  assert.equal(parseToJstWall('2026-10-20T01:00:00Z'), '2026-10-20 10:00:00');
  assert.equal(parseToJstWall('2026-10-19T20:00:00-0500'), '2026-10-20 10:00:00');
  // crosses midnight
  assert.equal(parseToJstWall('2026-10-20T20:00:00Z'), '2026-10-21 05:00:00');
});

test('date-only values: start of day, or end of day when asked', () => {
  assert.equal(parseToJstWall('2026-10-20'), '2026-10-20 00:00:00');
  assert.equal(parseToJstWall('2026-10-20', { endOfDay: true }), '2026-10-20 23:59:59');
});

test('rejects impossible dates and garbage', () => {
  for (const bad of ['2026-02-30', '2026-13-01', '2026-10-20T24:00', '2026-10-20T10:60', 'tomorrow', '', '2026-10-20T10:00+25:00']) {
    assert.equal(parseToJstWall(bad), null, bad);
  }
  assert.equal(parseToJstWall('2028-02-29'), '2028-02-29 00:00:00'); // leap day
});

test('jstWallNow shifts by nine hours', () => {
  assert.equal(jstWallNow(new Date('2026-10-20T15:30:00Z')), '2026-10-21 00:30:00');
});

test('addDaysWall and wallToIso', () => {
  assert.equal(addDaysWall('2026-12-30 08:00:00', 3), '2027-01-02 08:00:00');
  assert.equal(wallToIso(new Date('2026-10-20T10:00:00Z')), '2026-10-20T10:00:00+09:00');
  assert.equal(wallToIso('2026-10-20 10:00:00'), '2026-10-20T10:00:00+09:00');
});
