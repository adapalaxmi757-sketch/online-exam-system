// Tiny data layer backed by a JSON file.
// Every function here is the "repository" boundary: when you move to the cloud,
// re-implement these same functions on top of RDS / DynamoDB and nothing else changes.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const config = require('./config');

const empty = () => ({ users: [], exams: [], submissions: [] });
let db = empty();

function load() {
  if (!config.persist) return;
  try {
    db = { ...empty(), ...JSON.parse(fs.readFileSync(config.dataFile, 'utf8')) };
  } catch (e) {
    db = empty();
  }
}

function save() {
  if (!config.persist) return;
  fs.mkdirSync(path.dirname(config.dataFile), { recursive: true });
  const tmp = config.dataFile + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(db, null, 2));
  fs.renameSync(tmp, config.dataFile);
}

function insert(col, doc) {
  const rec = { id: crypto.randomUUID(), createdAt: new Date().toISOString(), ...doc };
  db[col].push(rec);
  save();
  return rec;
}

const find = (col, pred = () => true) => db[col].filter(pred);
const findOne = (col, pred) => db[col].find(pred);

function update(col, id, patch) {
  const rec = db[col].find((r) => r.id === id);
  if (!rec) return null;
  Object.assign(rec, patch);
  save();
  return rec;
}

function remove(col, pred) {
  const before = db[col].length;
  db[col] = db[col].filter((r) => !pred(r));
  save();
  return before - db[col].length;
}

function reset() {
  db = empty();
  save();
}

load();

module.exports = { insert, find, findOne, update, remove, reset };