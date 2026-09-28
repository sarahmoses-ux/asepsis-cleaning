import {test} from 'node:test';
import assert from 'node:assert/strict';
import {estimate} from '../../shared/pricing.js';
test('recurring visits start with a deep clean',()=>assert.deepEqual(estimate({}),{total:160,firstVisit:305,recurring:true}));
test('size adjustments round up in 500 sq ft increments',()=>assert.equal(estimate({service:'deep',bedrooms:2,fullBaths:3,halfBaths:1,sqft:3501,windows:2,laundry:1,addons:['oven']}).total,430));
test('move out does not charge twice for included interiors',()=>assert.equal(estimate({service:'move',bedrooms:1,addons:['oven','fridge','cabinets']}).total,300));
test('one-time standard rate differs from recurring',()=>assert.equal(estimate({bedrooms:1,frequency:'once'}).total,150));
