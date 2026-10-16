(function initBusinessModel(global) {
  "use strict";
  const roundMoney = value => Math.round((Number(value) || 0) * 100) / 100;
  function participationValue(valuation, share) {
    return roundMoney((Number(valuation) || 0) * (Number(share) || 0) / 100);
  }
  function projection(partner, ipca, years = 20) {
    const factor = 1 + (Number(ipca) || 0) / 100;
    const age = Number(partner.age) || 0;
    let paid = 0;
    return Array.from({ length: years }, (_, index) => {
      const year = index + 1;
      const premium = year <= 10 ? roundMoney((Number(partner.wlPremium) || 0) * factor ** index) : 0;
      paid = roundMoney(paid + premium);
      return {
        year,
        age: age ? age + index : null,
        capital: roundMoney((Number(partner.wlCoverage) || 0) * factor ** index),
        premium,
        accumulated: paid,
        surrender: year <= 2 ? 0 : roundMoney(partner.surrenderValues?.[index] || 0),
      };
    });
  }
  const api = { participationValue, projection };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  global.BusinessModel = api;
})(typeof window !== "undefined" ? window : globalThis);
