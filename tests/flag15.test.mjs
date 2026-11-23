import test from 'node:test';
import assert from 'node:assert/strict';
import {polygonError, liveSpeed, latestPosition, recentRecordedPoints, neshanUrl} from '../src/utils/flag15.mjs';
test('free boundary and crossed boundary validation',()=>{
 assert.equal(polygonError([[1,1],[1,3],[2,4],[3,3],[3,1],[2,0]]),'');
 assert.ok(polygonError([[1,1],[3,3],[1,3],[3,1],[2,0],[4,0]]));
 assert.ok(polygonError([[1,1],[1,1],[2,3],[3,3],[4,2],[4,1]]));
 assert.ok(polygonError([[1,1],[2,2],[3,3],[4,4],[5,5],[6,6]]));
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
 assert.equal(neshanUrl(p.coordinates),'https://nshn.ir/?lat=36&lng=52');
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

test('recorded history keeps the newest 100 valid points without mutating input',()=>{
 const valid=Array.from({length:105},(_,i)=>({id:i,recordedAt:new Date(Date.UTC(2026,0,1,0,i)).toISOString(),coordinates:[35+i/1000,51+i/1000]}));
 const history=[...valid,{recordedAt:'2027-01-01',coordinates:[999,51]},{recordedAt:'bad',coordinates:[35,51]},{recordedAt:'2027-01-01',coordinates:[0,0]},{recordedAt:'2027-01-01',coordinates:[35,Infinity]}];
 const original=history.slice();
 const points=recentRecordedPoints(history);
 assert.equal(points.length,100);
 assert.equal(points[0].id,104);
 assert.equal(points.at(-1).id,5);
 assert.deepEqual(history,original);
 assert.deepEqual(recentRecordedPoints([]),[]);
});

test('six-point geofence validates vertex count and coordinate ranges', () => {
 assert.match(polygonError([[1,1],[1,2],[2,2],[2,1]]), /شش نقطه/);
 assert.ok(polygonError([[1,1],[1,3],[2,4],[3,3],[3,1],[200,0]]));
});
test('Neshan vehicle routing intent matches provider format', async () => {
 const {neshanRouteUrl} = await import('../src/utils/flag15.mjs');
 assert.equal(neshanRouteUrl([35,51],[36,52]), 'https://nshn.ir?origin=35%2C51&destination=36%2C52&vehicle=d');
 assert.equal(neshanRouteUrl([35,51],[36,52],'m'), 'https://nshn.ir?origin=35%2C51&destination=36%2C52&vehicle=m');
});
