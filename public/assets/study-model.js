(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  root.RiskStudy=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  const number=value=>Number(value)||0;
  function calculatePerson(input={}){
    const xp=Math.max(0,number(input.xp)),other=Math.max(0,number(input.other)),pension=Math.max(0,number(input.pension)),realEstate=Math.max(0,number(input.realEstate)),holdings=Math.max(0,number(input.holdings));
    const currentInsurance=Math.max(0,number(input.currentInsurance)),coverageGap=Math.max(0,number(input.coverageGap)),annualPremium=Math.max(0,number(input.annualPremium)),annualReturn=Math.max(0,number(input.annualReturn));
    const financial=xp+other+pension,illiquid=realEstate+holdings,total=financial+illiquid,inventoriable=Math.max(0,total-pension),liability=inventoriable*.15,recommended=liability,coverageAfter=currentInsurance+coverageGap,withoutInsurance=Math.max(0,total-liability),withInsurance=Math.max(0,total-liability+coverageAfter),monthlyReturn=annualReturn/12,paybackRaw=financial>0&&monthlyReturn>0&&annualPremium>0?annualPremium/(financial*monthlyReturn):0,paybackMonths=paybackRaw?Math.ceil(paybackRaw):0;
    return {xp,other,pension,realEstate,holdings,currentInsurance,coverageGap,annualPremium,annualReturn,financial,illiquid,total,inventoriable,liability,recommended,coverageAfter,withoutInsurance,withInsurance,monthlyReturn,paybackRaw,paybackMonths};
  }
  return {calculatePerson};
});
