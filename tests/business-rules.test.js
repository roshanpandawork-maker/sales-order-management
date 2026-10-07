const test=require("node:test"),assert=require("node:assert/strict");
const daily=s=>Number(s)/30;
function payroll(monthly,attendance,{bonus=0,overtime=0,advance=0,deduction=0}={}){
  const rate=daily(monthly);let paidLeave=0,lw=0,add=0,sub=0;
  for(const x of attendance){if(x==="L"){if(paidLeave<4)paidLeave++;else sub+=rate}else if(x==="LW"){if(lw<4){lw++;add+=rate}}else if(x==="A")sub+=rate;else if(x==="H")sub+=rate/2}
  return monthly+add+bonus+overtime-advance-deduction-sub;
}
test("daily rate is monthly salary divided by 30",()=>assert.equal(daily(30000),1000));
test("four L days are paid and fifth L is unpaid",()=>assert.equal(payroll(30000,["L","L","L","L","L"]),29000));
test("LW adds at most four daily rates",()=>assert.equal(payroll(30000,["LW","LW","LW","LW","LW"]),34000));
test("A deducts one daily rate and H half",()=>assert.equal(payroll(30000,["A","H"]),28500));
test("bonus/overtime add and advance/deduction subtract",()=>assert.equal(payroll(30000,[],{bonus:1000,overtime:500,advance:200,deduction:300}),31000));
test("blank attendance is not absence",()=>assert.equal(payroll(30000,[""]),30000));
test("28 and 31 day months keep the same daily rate",()=>assert.equal(daily(31000),daily(31000)));
