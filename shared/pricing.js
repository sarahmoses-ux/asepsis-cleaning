export const rates = {
  weekly: [120,130,150,185,245], fortnightly: [120,140,160,200,260], monthly: [135,155,175,215,280],
  standard: [150,170,190,235,295], deep: [245,275,305,375,475], move: [300,340,380,470,590]
};
export const extras = { oven:35, fridge:35, cabinets:40, pets:20, garage:30 };
export function estimate({bedrooms=3, service='standard', frequency='fortnightly', fullBaths=2, halfBaths=0, sqft=2000, windows=0, laundry=0, addons=[]}) {
  const index = Math.min(5,Math.max(1,Number(bedrooms)))-1;
  const recurring = service==='standard' && frequency!=='once';
  const surcharge = Math.max(0,fullBaths-2)*25 + halfBaths*15 + Math.ceil(Math.max(0,sqft-3000)/500)*25 + windows*5 + laundry*20 + addons.reduce((sum,key)=>sum+(service==='move' && ['oven','fridge','cabinets'].includes(key)?0:extras[key]||0),0);
  return {total:rates[recurring?frequency:service][index]+surcharge, firstVisit:rates[recurring?'deep':service][index]+surcharge, recurring};
}
