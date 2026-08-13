import assert from 'node:assert/strict';
import test from 'node:test';

await import('../public/assets/study-model.js');
const {calculatePerson}=globalThis.RiskStudy;

test('calcula cada cônjuge sem somar o patrimônio do outro',()=>{
  const titular=calculatePerson({xp:1000000,pension:200000,realEstate:500000,currentInsurance:50000,coverageGap:150000,annualPremium:12000,annualReturn:.03});
  const conjuge=calculatePerson({xp:300000,pension:50000,realEstate:100000,currentInsurance:10000,coverageGap:60000,annualPremium:6000,annualReturn:.03});
  assert.equal(titular.total,1700000);
  assert.equal(titular.liability,225000);
  assert.equal(titular.coverageAfter,200000);
  assert.equal(conjuge.total,450000);
  assert.equal(conjuge.liability,60000);
  assert.equal(conjuge.coverageAfter,70000);
  assert.notEqual(titular.total,conjuge.total);
});

test('mantém prêmio e payback individuais',()=>{
  const pessoaA=calculatePerson({xp:1000000,annualPremium:12000,annualReturn:.06});
  const pessoaB=calculatePerson({xp:250000,annualPremium:12000,annualReturn:.06});
  assert.equal(pessoaA.paybackMonths,3);
  assert.equal(pessoaB.paybackMonths,10);
});
