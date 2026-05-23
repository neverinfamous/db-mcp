import Database from 'better-sqlite3';
import { loadSpatialite } from './src/adapters/sqlite-native/extensions.ts';

const db = new Database(':memory:');
loadSpatialite(db, {info:()=>{}, warning:()=>{}, error:()=>{}} as any);

const wkt = 'POINT(-73.9857 40.7484)';
const srid = 4326;

console.log('BIND CAST:', db.prepare("SELECT AsText(GeomFromText(?, CAST(? AS INTEGER))) as r").get(wkt, srid));
