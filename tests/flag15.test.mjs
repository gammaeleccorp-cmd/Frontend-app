import test from 'node:test';
import assert from 'node:assert/strict';
import {polygonError, liveSpeed, latestPosition, neshanUrl} from '../src/utils/flag15.mjs';
test('free boundary and crossed boundary validation',()=>{
 assert.equal(polygonError([[1,1],[2,1],[3,4],[1,3]]),'');
 assert.ok(polygonError([[1,1],[3,3],[1,3],[3,1]]));
 assert.ok(polygonError([[1,1],[1,1],[3,3],[2,4]]));
 assert.ok(polygonError([[1,1],[2,2],[3,3],[4,4]]));
});
test('recorded speed expires and ACC off wins',()=>{
 const now=Date.now(), sample={recorded_at:new Date(now).toISOString(),speed:10};
 assert.equal(liveSpeed(sample,now),10);
 assert.equal(liveSpeed({...sample,acc:false},now),0);
 assert.equal(liveSpeed(sample,now+90001),null);
 assert.equal(liveSpeed(null,now),null);
});
test('latest valid recorded position determines Neshan target',()=>{
 const p=latestPosition([{recordedAt:'2026-01-01',coordinates:[35,51]},{recordedAt:'2026-01-03',coordinates:[999,51]},{recordedAt:'2026-01-02',coordinates:[36,52]}]);
 assert.deepEqual(p.coordinates,[36,52]);
 assert.equal(neshanUrl(p.coordinates),'https://neshan.org/maps/@36,52,16z');
 assert.equal(latestPosition([]),undefined);
});
test('device_status zero overrides speed and older arrivals cannot restore speed',async()=>{
 const {newestSample}=await import('../src/utils/flag15.mjs');
 const older={recorded_at:'2026-11-16T07:00:00Z',speed:10,device_status:1};
 const newer={recorded_at:'2026-11-16T07:00:10Z',speed:10,device_status:0};
 const now=Date.parse(newer.recorded_at);
 assert.equal(liveSpeed(newestSample(older,newer),now),0);
 assert.equal(liveSpeed(newestSample(newer,older),now),0);
 assert.equal(liveSpeed(newer,now+90001),null);
 assert.equal(newestSample(newer,null),newer);
});
