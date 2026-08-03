(() => {
  const $ = id => document.getElementById(id);
  const money = value => new Intl.NumberFormat('pt-BR', {style:'currency', currency:'BRL'}).format(Number(value) || 0);
  const compactMoney = value => {
    const n = Number(value) || 0;
    if (Math.abs(n) >= 1e6) return `R$ ${(n / 1e6).toLocaleString('pt-BR', {maximumFractionDigits:2})} mi`;
    if (Math.abs(n) >= 1e3) return `R$ ${(n / 1e3).toLocaleString('pt-BR', {maximumFractionDigits:0})} mil`;
    return money(n);
  };
  const parseNumericValue = value => {
    const raw=String(value??'').trim().replace(/\s/g,'');if(!raw)return 0;
    const cleaned=raw.replace(/[^\d,.-]/g,'');
    if(cleaned.includes(',')) return Number(cleaned.replace(/\./g,'').replace(',','.'))||0;
    if(/^\d{1,3}(\.\d{3})+$/.test(cleaned)) return Number(cleaned.replace(/\./g,''))||0;
    return Number(cleaned)||0;
  };
  const num = id => parseNumericValue($(id)?.value);
  const clamp = (n, min, max) => Math.min(max, Math.max(min, n));
  const CONSULTANTS = {
    fabio:{name:'Fabio Kenji Hassui',phone:'(11) 99270-0538',phoneHref:'+5511992700538',email:'fabio.hassui@altavistainvest.com.br'},
    alexandre:{name:'Alexandre Faustino',phone:'(11) 98097-7782',phoneHref:'+5511980977782',email:'alexandre.faustino@altavistainvest.com.br'},
    moises:{name:'Moisés Santos',phone:'(51) 99644-5044',phoneHref:'+5551996445044',email:'moises.santos@altavistainvest.com.br'}
  };
  let mode = 'single';
  let surrenderValues = [];
  let surrenderPdfImportBusy = false;

  const moneyInputIds = ['xp','otherInvestments','privatePension','realEstate','holdings','currentInsurance','spouseXp','spouseOther','spousePension','spouseRealEstate','spouseHoldings','spouseInsurance','coverageGap','annualPremium'];
  const decimalInputIds = ['ipca','annualReturn'];
  const inputIds = ['clientFirstName','clientLastName','xp','otherInvestments','privatePension','realEstate','holdings','currentInsurance','spouseXp','spouseOther','spousePension','spouseRealEstate','spouseHoldings','spouseInsurance','coverageGap','clientAge','annualPremium','ipca','projectionYears','annualReturn','consultant'];

  function formatMoneyWhileTyping(input){
    const raw=input.value.replace(/\./g,'').replace(/[^\d,]/g,'');
    const comma=raw.indexOf(','),integerRaw=(comma>=0?raw.slice(0,comma):raw).replace(/^0+(?=\d)/,''),decimal=comma>=0?raw.slice(comma+1).replace(/\D/g,'').slice(0,2):'';
    const integer=(integerRaw||'0').replace(/\B(?=(\d{3})+(?!\d))/g,'.');
    input.value=integer+(comma>=0?`,`+decimal:'');input.setSelectionRange(input.value.length,input.value.length);
  }
  function finishMoneyFormat(input){input.value=parseNumericValue(input.value).toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2});}

  function data() {
    const spouse = mode === 'couple';
    const xp = num('xp') + (spouse ? num('spouseXp') : 0);
    const other = num('otherInvestments') + (spouse ? num('spouseOther') : 0);
    const pension = num('privatePension') + (spouse ? num('spousePension') : 0);
    const realEstate = num('realEstate') + (spouse ? num('spouseRealEstate') : 0);
    const holdings = num('holdings') + (spouse ? num('spouseHoldings') : 0);
    const currentInsurance = num('currentInsurance') + (spouse ? num('spouseInsurance') : 0);
    const financial = xp + other + pension;
    const illiquid = realEstate + holdings;
    const total = financial + illiquid;
    const inventoriable = Math.max(0, total - pension);
    const liability = inventoriable * 0.15;
    const recommended = liability;
    const coverageGap = Math.max(0, num('coverageGap'));
    const coverageAfter = currentInsurance + coverageGap;
    const withoutInsurance = Math.max(0, total - liability);
    const withInsurance = Math.max(0, total - liability + coverageAfter);
    const annualPremium = num('annualPremium');
    const annualReturn = num('annualReturn') / 100;
    const monthlyReturn = annualReturn / 12;
    const paybackRaw = financial > 0 && monthlyReturn > 0 && annualPremium > 0 ? annualPremium / (financial * monthlyReturn) : 0;
    const paybackMonths = paybackRaw ? Math.ceil(paybackRaw) : 0;
    const consultantData = CONSULTANTS[$('consultant').value] || CONSULTANTS.fabio;
    const ageValue = num('clientAge');
    const age = ageValue ? clamp(ageValue, 18, 100) : null;
    const projectionYears = clamp(num('projectionYears') || 20, 12, 40);
    const firstName = $('clientFirstName').value.trim();
    const lastName = $('clientLastName').value.trim();
    const name = [firstName,lastName].filter(Boolean).join(' ') || 'Cliente';
    const familyLabel = `Família ${lastName || firstName || 'Cliente'}`;
    return {
      firstName, lastName, name, familyLabel, spouseName: $('spouseName').value || 'Cônjuge', consultant: consultantData.name, consultantData, spouse,
      xp, other, pension, realEstate, holdings, financial, illiquid, total, inventoriable, liability, recommended, currentInsurance, coverageGap, coverageAfter,
      withoutInsurance, withInsurance, annualPremium, annualReturn, monthlyReturn, paybackRaw, paybackMonths,
      age, ipca: num('ipca') || 5, projectionYears, surrenderValues:Array.from({length:projectionYears},(_,i)=>Number(surrenderValues[i])||0)
    };
  }

  function wlProjection(d) {
    const rate = d.ipca / 100;
    const years = Array.from({length:d.projectionYears}, (_, i) => i);
    return years.map(year => {
      const accumulated = Array.from({length:Math.min(year + 1, 10)}, (_, i) => d.annualPremium * Math.pow(1 + rate, i)).reduce((a,b)=>a+b,0);
      const surrender = Number(d.surrenderValues?.[year]) || 0;
      return {
      year,
      age: d.age===null ? null : d.age + year,
      capital: d.coverageGap * Math.pow(1 + rate, year),
      premium: year < 10 ? d.annualPremium * Math.pow(1 + rate, year) : 0,
      accumulated,
      accumulatedDisplay: year < 10 ? accumulated : 0,
      surrender
    };});
  }

  function syncSurrenderInputs(d) {
    const container=$('surrenderInputs'); if(!container) return;
    const signature=`${d.age??'empty'}:${d.projectionYears}`;
    if(container.dataset.signature===signature) return;
    container.dataset.signature=signature;
    container.innerHTML=Array.from({length:d.projectionYears},(_,i)=>{const age=d.age===null?'—':`${d.age+i} anos`,value=(Number(surrenderValues[i])||0).toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2});return `<label class="surrender-row"><strong>${i+1}º</strong><span>${age}</span><input type="text" inputmode="decimal" data-money-input data-surrender-index="${i}" value="${value}" aria-label="Valor de resgate no ${i+1}º ano, ${d.age===null?'idade a preencher':`idade ${d.age+i}`}" /></label>`;}).join('');
  }

  function refreshSurrenderInputs(){
    const container=$('surrenderInputs');
    const scrollTop=container?.scrollTop||0;
    if(container)delete container.dataset.signature;
    render();
    if(container)container.scrollTop=scrollTop;
  }

  function setSurrenderPdfStatus(message,state=''){
    const status=$('surrenderPdfStatus');
    if(!status)return;
    status.className=`surrender-pdf-status ${state}`.trim();
    status.textContent=message;
  }

  function pdfRecognitionMessage(reason){
    const messages={
      no_text:'Este PDF parece ser uma imagem ou digitalização. Use a colagem manual ou envie uma versão com texto pesquisável.',
      no_header:'Não encontrei um cabeçalho de resgate no PDF. Os valores atuais foram preservados.',
      ambiguous_surrender_columns:'O PDF possui mais de uma coluna de resgate e não há uma regra definida para escolher entre elas. Os valores atuais foram preservados.',
      too_few_rows:'Encontrei a tabela, mas não há linhas suficientes para importar com segurança. Os valores atuais foram preservados.',
      non_sequential_rows:'Os anos da tabela não formam uma sequência confiável. Os valores atuais foram preservados.',
      misaligned_column:'A coluna de resgate ficou ambígua neste PDF. Os valores atuais foram preservados.'
    };
    return messages[reason]||'Não consegui reconhecer a coluna de resgate com segurança. Os valores atuais foram preservados.';
  }

  async function importSurrenderPdf(file){
    const button=$('surrenderPdfButton'),drop=$('surrenderPdfDrop'),filename=$('surrenderPdfFilename'),input=$('surrenderPdfInput');
    if(surrenderPdfImportBusy){setSurrenderPdfStatus('Já existe uma cotação sendo processada. Aguarde a conclusão.','warning');return;}
    surrenderPdfImportBusy=true;
    const initial=data(),horizon=initial.projectionYears,previousValues=[...surrenderValues],previousSignature=JSON.stringify(previousValues);
    let mutationApplied=false;
    if(filename)filename.textContent=file?.name||'Nenhum arquivo selecionado';
    if(button){button.disabled=true;button.textContent='Lendo PDF…';}
    drop?.classList.add('loading');
    setSurrenderPdfStatus('Lendo a cotação e procurando a coluna de resgate…','loading');
    try{
      if(!window.SurrenderPdf?.extractSurrenderValues)throw new Error('O leitor de PDF não foi carregado. Atualize a página e tente novamente.');
      const result=await window.SurrenderPdf.extractSurrenderValues(file,{currentAge:initial.age,maxValues:80});
      if(result.confidence!=='high'){
        setSurrenderPdfStatus(pdfRecognitionMessage(result.reason),'warning');
        return;
      }
      const current=data();
      if(current.age!==initial.age||current.projectionYears!==horizon||JSON.stringify(surrenderValues)!==previousSignature){
        setSurrenderPdfStatus('A idade, o horizonte ou a tabela foram alterados durante a leitura. O PDF não foi aplicado; selecione-o novamente.','warning');
        return;
      }
      const presentIndices=(result.presentIndices||result.values.map((_,index)=>index)).filter(Number.isInteger);
      const nextValues=Array.from({length:horizon},(_,index)=>Number(previousValues[index])||0);
      presentIndices.forEach(index=>{if(index>=0&&index<horizon)nextValues[index]=Number(result.values[index])||0;});
      surrenderValues=nextValues;
      mutationApplied=true;
      refreshSurrenderInputs();
      const imported=presentIndices.filter(index=>index>=0&&index<horizon).length,ignored=presentIndices.filter(index=>index>=horizon).length,missing=Math.max(0,horizon-imported);
      const details=[`${imported} ${imported===1?'valor importado':'valores importados'} de ${result.pageCount} ${result.pageCount===1?'página':'páginas'}`];
      if(ignored)details.push(`${ignored} ${ignored===1?'linha excedeu':'linhas excederam'} o horizonte e ${ignored===1?'foi ignorada':'foram ignoradas'}`);
      if(missing)details.push(`${missing} ${missing===1?'linha não identificada permaneceu':'linhas não identificadas permaneceram'} como estava${missing===1?'':'m'}`);
      details.push('Revise os valores antes de gerar a apresentação');
      setSurrenderPdfStatus(`${details.join('. ')}.`,'success');
      if(button)button.textContent='Selecionar outro PDF';
    }catch(error){
      if(mutationApplied){surrenderValues=previousValues;try{refreshSurrenderInputs();}catch(_){/* sem ação */}}
      setSurrenderPdfStatus(error?.message||'Não foi possível ler esta cotação. Os valores atuais foram preservados.','error');
      if(filename)filename.textContent='Nenhum arquivo importado';
    }finally{
      surrenderPdfImportBusy=false;
      drop?.classList.remove('loading');
      if(button){button.disabled=false;if(button.textContent==='Lendo PDF…')button.textContent='Selecionar PDF';}
      if(input)input.value='';
    }
  }

  function pasteSurrenderColumn(event,input){
    const clipboard=event.clipboardData?.getData('text/plain')||'';
    if(!clipboard.trim())return;
    const values=clipboard.split(/\r\n|\n|\r/).flatMap(row=>{
      const cells=row.split('\t').map(cell=>cell.trim()).filter(Boolean);
      const cell=[...cells].reverse().find(value=>/\d/.test(value));
      return cell===undefined?[]:[parseNumericValue(cell)];
    });
    if(!values.length)return;
    event.preventDefault();
    const start=Number(input.dataset.surrenderIndex)||0,limit=data().projectionYears;
    const applied=values.slice(0,Math.max(0,limit-start));
    applied.forEach((value,offset)=>{surrenderValues[start+offset]=value;const field=document.querySelector(`[data-surrender-index="${start+offset}"]`);if(field)field.value=value.toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2});});
    render();
    const status=$('surrenderPasteStatus');
    if(status){const ignored=values.length-applied.length;status.className=`surrender-paste-status ${ignored?'warning':'success'}`;status.textContent=`${applied.length} ${applied.length===1?'valor colado':'valores colados'} a partir do ${start+1}º ano${ignored?`. ${ignored} excederam o horizonte e foram ignorados.`:'.'}`;}
  }

  function setText(id, text) { const el = $(id); if (el) el.textContent = text; }
  function setWealthSegment(id,value,total,{hideWhenZero=false,exact=false}={}){
    const el=$(id),amount=Math.max(0,Number(value)||0),base=Math.max(1,Number(total)||0);
    el.style.height=`${amount/base*100}%`;
    el.style.minHeight=amount>0&&!exact?'10px':hideWhenZero?'0':'10px';
    el.style.display=amount>0||!hideWhenZero?'grid':'none';
  }
  function setDonut(id, values, colors, centerText) {
    const el = $(id); const total = values.reduce((a,b)=>a+Math.max(0,b),0) || 1;
    let cursor = 0; const stops = values.map((value, i) => { const start = cursor; cursor += Math.max(0,value) / total * 100; return `${colors[i]} ${start}% ${cursor}%`; });
    el.style.background = `conic-gradient(${stops.join(',')})`; el.querySelector('span').textContent = centerText;
  }
  function legendHtml(items) { const total=items.reduce((sum,item)=>sum+Math.max(0,Number(item.value)||0),0)||1;return items.map(item => `<div class="legend-item"><span class="legend-swatch" style="background:${item.color}"></span><span>${item.label}<br><strong>${money(item.value)} · ${((Math.max(0,Number(item.value)||0)/total)*100).toLocaleString('pt-BR',{maximumFractionDigits:2})}%</strong></span></div>`).join(''); }

  function setDashboardDetail(element,title,lines=[]) {
    if(!element) return;
    element.classList.add('dashboard-mark');
    element.dataset.dashboardTitle=title;
    element.dataset.dashboardDetail=lines.filter(Boolean).join('\n');
    element.setAttribute('aria-label',[title,...lines].filter(Boolean).join('. '));
  }
  function tooltipElement() {
    let tooltip=$('dashboardTooltip');
    if(!tooltip){
      tooltip=document.createElement('div');
      tooltip.id='dashboardTooltip';tooltip.className='dashboard-tooltip';tooltip.setAttribute('role','status');tooltip.setAttribute('aria-hidden','true');
      tooltip.innerHTML='<strong></strong><span></span>';
      document.body.appendChild(tooltip);
    }
    return tooltip;
  }
  function positionTooltip(event) {
    const tooltip=tooltipElement(),gap=16;
    let left=event.clientX+gap,top=event.clientY+gap;
    const box=tooltip.getBoundingClientRect();
    if(left+box.width>window.innerWidth-12) left=event.clientX-box.width-gap;
    if(top+box.height>window.innerHeight-12) top=event.clientY-box.height-gap;
    tooltip.style.left=`${Math.max(12,left)}px`;tooltip.style.top=`${Math.max(12,top)}px`;
  }
  function showTooltip(element,event,title,detail) {
    const tooltip=tooltipElement();
    tooltip.querySelector('strong').textContent=title||element.dataset.dashboardTitle||'';
    tooltip.querySelector('span').textContent=detail??element.dataset.dashboardDetail??'';
    tooltip.classList.add('visible');tooltip.setAttribute('aria-hidden','false');
    positionTooltip(event);
  }
  function hideTooltip(){const tooltip=$('dashboardTooltip');if(tooltip){tooltip.classList.remove('visible');tooltip.setAttribute('aria-hidden','true');}}

  function prepCanvas(canvas) {
    const rect = canvas.getBoundingClientRect(); const ratio = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = Math.max(300, Math.round(rect.width * ratio)); canvas.height = Math.max(140, Math.round(rect.height * ratio));
    const ctx = canvas.getContext('2d'); ctx.setTransform(ratio,0,0,ratio,0,0); return {ctx,w:canvas.width/ratio,h:canvas.height/ratio};
  }
  function drawAxes(ctx,w,h,left,top,right,bottom,maxY,steps=4) {
    ctx.clearRect(0,0,w,h); ctx.font='11px Segoe UI'; ctx.fillStyle='#aeb9d1'; ctx.strokeStyle='#24406e'; ctx.lineWidth=1;
    for(let i=0;i<=steps;i++){const y=top+(h-top-bottom)*i/steps;ctx.beginPath();ctx.moveTo(left,y);ctx.lineTo(w-right,y);ctx.stroke();const value=maxY*(1-i/steps);ctx.fillText(compactMoney(value),2,y+4);}
    ctx.strokeStyle='#6b7da2';ctx.beginPath();ctx.moveTo(left,top);ctx.lineTo(left,h-bottom);ctx.lineTo(w-right,h-bottom);ctx.stroke();
  }
  function drawLine(ctx,points,color,width=2,dash=[]) { ctx.save();ctx.strokeStyle=color;ctx.lineWidth=width;ctx.setLineDash(dash);ctx.beginPath();points.forEach((p,i)=>i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y));ctx.stroke();ctx.restore(); }
  function drawProjection(d) {
    const canvas=$('projectionChart'); if(!canvas) return; const {ctx,w,h}=prepCanvas(canvas); const rows=wlProjection(d); const left=76,top=24,right=18,bottom=28;
    const maxY=Math.max(...rows.map(r=>r.capital),d.annualPremium*12,1)*1.08; drawAxes(ctx,w,h,left,top,right,bottom,maxY);
    const x=i=>left+(w-left-right)*i/(rows.length-1); const y=v=>h-bottom-(h-top-bottom)*v/maxY;
    drawLine(ctx,rows.map((r,i)=>({x:x(i),y:y(r.capital)})),'#d6a700',3);
    drawLine(ctx,rows.map((r,i)=>({x:x(i),y:y(r.premium)})),'#70b544',3);
    ctx.fillStyle='#c5d0e5';ctx.font='10px Segoe UI';[0,5,10,rows.length-1].filter((v,i,a)=>v<rows.length&&a.indexOf(v)===i).forEach(i=>ctx.fillText(`ano ${i}`,x(i)-12,h-8));
    ctx.fillStyle='#d6a700';ctx.fillRect(left,4,12,3);ctx.fillStyle='#d9e0ec';ctx.fillText('capital segurado',left+18,9);ctx.fillStyle='#70b544';ctx.fillRect(left+135,4,12,3);ctx.fillStyle='#d9e0ec';ctx.fillText('prêmio anual',left+153,9);
  }
  function drawPayback(d,activeMonth=null) {
    const canvas=$('paybackChart'); if(!canvas) return; const {ctx,w,h}=prepCanvas(canvas); const left=72,top=24,right=20,bottom=28; const months=12; const rates=[.006,.008,.01]; const colors=['#7d6a36','#b88700','#d6a700'];
    const maxY=Math.max(d.annualPremium*1.35,...rates.map(r=>d.financial*r*months),1); drawAxes(ctx,w,h,left,top,right,bottom,maxY);
    const x=m=>left+(w-left-right)*m/months; const y=v=>h-bottom-(h-top-bottom)*v/maxY;
    rates.forEach((rate,i)=>drawLine(ctx,Array.from({length:months+1},(_,m)=>({x:x(m),y:y(d.financial*rate*m)})),colors[i%colors.length],2));
    if(d.annualPremium>0) drawLine(ctx,[{x:x(0),y:y(d.annualPremium)},{x:x(months),y:y(d.annualPremium)}],'#8bd05f',2,[8,6]);
    if(d.financial>0&&d.annualPremium>0){rates.forEach((rate,i)=>{const crossing=Math.ceil(d.annualPremium/(d.financial*rate));if(crossing<0||crossing>months)return;ctx.save();ctx.fillStyle=i===1?'#8bd05f':i===0?'#e9a2a5':'#f0c400';ctx.strokeStyle='#fff';ctx.lineWidth=1;ctx.textAlign='center';ctx.textBaseline='middle';ctx.font='700 21px Segoe UI Symbol';ctx.strokeText('★',x(crossing),y(d.financial*rate*crossing));ctx.fillText('★',x(crossing),y(d.financial*rate*crossing));ctx.restore();});}
    ctx.fillStyle='#c5d0e5';ctx.font='10px Segoe UI';[0,2,4,6,8,10,12].forEach(m=>ctx.fillText(`M${m}`,x(m)-8,h-8));
    ctx.font='10px Segoe UI'; let lx=left; rates.forEach((rate,i)=>{ctx.fillStyle=colors[i%colors.length];ctx.fillRect(lx,4,12,3);ctx.fillStyle='#d9e0ec';const label=`${(rate*100).toLocaleString('pt-BR',{maximumFractionDigits:1})}% a.m.`;ctx.fillText(label,lx+17,9);lx+=88;});
    if(Number.isInteger(activeMonth)){
      const markerX=x(activeMonth);line(ctx,markerX,top,markerX,h-bottom,'rgba(255,255,255,.5)',1,[4,4]);
      rates.forEach((rate,i)=>{ctx.beginPath();ctx.arc(markerX,y(d.financial*rate*activeMonth),5,0,Math.PI*2);ctx.fillStyle=colors[i%colors.length];ctx.fill();ctx.strokeStyle='#fff';ctx.lineWidth=1.5;ctx.stroke();});
    }
    canvas.__dashboardMeta={d,left,right,w,months,rates};
    setDashboardDetail(canvas,'Cenário de payback',['Mova o cursor sobre o gráfico para comparar cada mês.']);
  }
  const paybackAtRate=(d,rate)=>d.financial>0&&d.annualPremium>0?Math.ceil(d.annualPremium/(d.financial*rate)):0;
  const monthLabel=months=>months?`${months} ${months===1?'MÊS':'MESES'}`:'—';
  function setWebGauge(id,value){const gauge=$(id),safe=clamp(Number(value)||0,0,10);if(!gauge)return;gauge.style.setProperty('--gauge-value',safe);gauge.querySelector('.gauge-arc')?.style.setProperty('--needle',`${-90+safe*18}deg`);setText(`${id}Value`,`${(Number(value)||0).toLocaleString('pt-BR',{maximumFractionDigits:1})}%`);}

  function render() {
    const d=data();
    syncSurrenderInputs(d);
    setText('sumTotal',money(d.total)); setText('sumPension',money(d.pension)); setText('sumLiability',money(d.liability)); setText('sumWithoutInsurance',money(d.withoutInsurance)); setText('sumWithInsurance',money(d.withInsurance)); setText('sumGap',money(d.coverageGap));
    $('successionLiabilityOutput').value=money(d.liability); $('recommendedInsurance').value=money(d.recommended);
    setText('paybackSummary',d.paybackMonths?`${d.paybackMonths} ${d.paybackMonths===1?'mês':'meses'}`:'Informe o prêmio');

    $('assetRows').innerHTML=[['Investimentos na XP',d.xp],['Outras instituições',d.other],['Imóveis e ativos físicos',d.realEstate],['Participações societárias / holdings',d.holdings],['Previdência privada (fora da base)',-d.pension]].map((a,i)=>`<div class="asset-row ${i===4?'pension':''}"><span>${a[0]}</span><strong>${a[1]<0?'-':''}${money(Math.abs(a[1]))}</strong></div>`).join('');
    setText('previewInventoriable',money(d.inventoriable)); setText('previewLiability','-'+money(d.liability)); setText('previewNet',money(d.withoutInsurance));
    setDashboardDetail(document.querySelector('#previewCosts .asset-map'),'Patrimônio inventariável',[`Base sujeita à sucessão: ${money(d.inventoriable)}`,`Previdência fora da base: ${money(d.pension)}`]);
    setDashboardDetail(document.querySelector('#previewCosts .succession-box'),'Custo estimado da sucessão',[`15% do patrimônio inventariável`,money(d.liability)]);
    setDashboardDetail(document.querySelector('#previewCosts .transmitted'),'Patrimônio líquido transmitido',[`Família recebe sem seguro: ${money(d.withoutInsurance)}`]);

    const finValues=[d.xp,d.other,d.pension]; const finColors=['#d2a500','#bd974f','#ffbf00'];
    setDonut('donutWithout',finValues,finColors,d.total?`${Math.round(d.financial/d.total*100)}%`:'0%'); $('legendWithout').innerHTML=legendHtml([{label:'XP',value:d.xp,color:finColors[0]},{label:'Outras instituições',value:d.other,color:finColors[1]},{label:'Previdência',value:d.pension,color:finColors[2]}]);
    setDashboardDetail($('donutWithout'),'Composição dos ativos financeiros',[`XP: ${money(d.xp)}`,`Outras instituições: ${money(d.other)}`,`Previdência: ${money(d.pension)}`]);
    setText('withoutFinancial',money(d.financial));setText('withoutIlliquid',money(d.illiquid));
    const baseWithout=Math.max(d.total,1);setWealthSegment('withoutBarFinancial',d.financial,baseWithout);setWealthSegment('withoutBarIlliquid',d.illiquid,baseWithout);$('withoutBarCost').style.height=`${Math.max(7,d.liability/baseWithout*100)}%`;
    $('withoutBarFinancial').textContent=compactMoney(d.financial);$('withoutBarIlliquid').textContent=compactMoney(d.illiquid);$('withoutBarCost').textContent='-'+compactMoney(d.liability);
    setDashboardDetail($('withoutBarFinancial'),'Ativos financeiros',[money(d.financial)]);setDashboardDetail($('withoutBarIlliquid'),'Patrimônio imobilizado',[money(d.illiquid)]);setDashboardDetail($('withoutBarCost'),'Passivo sucessório',[`Custo estimado: ${money(d.liability)}`]);

    const withValues=[d.xp,d.other,d.pension,d.coverageAfter],withColors=['#d2a500','#bd974f','#ffbf00','#70b544'];setDonut('donutWith',withValues,withColors,d.total+d.coverageAfter?`${Math.round(d.coverageAfter/(d.total+d.coverageAfter)*100)}%`:'0%');$('legendWith').innerHTML=legendHtml([{label:'XP',value:d.xp,color:withColors[0]},{label:'Outras instituições',value:d.other,color:withColors[1]},{label:'Previdência',value:d.pension,color:withColors[2]},{label:'Seguro de vida',value:d.coverageAfter,color:withColors[3]}]);
    setDashboardDetail($('donutWith'),'Patrimônio com proteção',[`Ativos financeiros: ${money(d.financial)}`,`Seguro de vida: ${money(d.coverageAfter)}`,`Total protegido: ${money(d.total+d.coverageAfter)}`]);
    setText('withInsurance',money(d.coverageAfter));setText('withTransmitted',money(d.withInsurance));const baseWith=Math.max(d.total+d.coverageAfter,1);setWealthSegment('withBarInsurance',d.coverageAfter,baseWith,{hideWhenZero:true,exact:true});setWealthSegment('withBarFinancial',d.financial,baseWith);setWealthSegment('withBarIlliquid',d.illiquid,baseWith);$('withBarCost').style.height=`${Math.max(7,d.liability/baseWith*100)}%`;$('withBarInsurance').textContent=compactMoney(d.coverageAfter);$('withBarFinancial').textContent=compactMoney(d.financial);$('withBarIlliquid').textContent=compactMoney(d.illiquid);$('withBarCost').textContent='-'+compactMoney(d.liability);
    setDashboardDetail($('withBarInsurance'),'Seguro de vida',[money(d.coverageAfter)]);setDashboardDetail($('withBarFinancial'),'Ativos financeiros',[money(d.financial)]);setDashboardDetail($('withBarIlliquid'),'Patrimônio imobilizado',[money(d.illiquid)]);setDashboardDetail($('withBarCost'),'Custo sucessório coberto',[money(d.liability)]);

    const projection=wlProjection(d);
    setText('projectionIpca',`IPCA: ${d.ipca.toLocaleString('pt-BR')}% a.a.`);
    setText('projectionClientName',(d.spouse?`${d.name} e ${d.spouseName}`:d.name).toLocaleUpperCase('pt-BR'));
    setText('capitalStart',money(d.coverageGap));setText('premiumTenth',money(projection[9]?.premium||0));
    const wlTableBody=$('wlTableBody');
    if(wlTableBody) wlTableBody.innerHTML=projection.map((row,index)=>`<tr class="${index===0||index===9||index===projection.length-1?'highlight ':''}${index===9?'payoff ':''}${index>=10?'paid':''}"><td>${row.age??'—'}</td><td>${money(row.capital)}</td><td>${money(row.premium)}</td><td>${money(row.accumulatedDisplay)}</td><td>${money(row.surrender)}</td></tr>`).join('');
    wlTableBody?.querySelectorAll('tr').forEach((row,index)=>{const item=projection[index];setDashboardDetail(row,`${index+1}º ano · ${item.age===null?'idade a preencher':`${item.age} anos`}`,[`Capital segurado: ${money(item.capital)}`,`Prêmio anual: ${money(item.premium)}`,`Resgate informado: ${money(item.surrender)}`]);});
    setText('consultantSummaryName',d.consultantData.name);
    const consultantPhone=$('consultantSummaryPhone'),consultantEmail=$('consultantSummaryEmail');
    if(consultantPhone){consultantPhone.textContent=d.consultantData.phone;consultantPhone.href=`tel:${d.consultantData.phoneHref}`;}
    if(consultantEmail){consultantEmail.textContent=d.consultantData.email;consultantEmail.href=`mailto:${d.consultantData.email}`;}
    drawProjection(d);
    setText('paybackAssets',money(d.financial));setText('paybackPremium',money(d.annualPremium));
    [[.006,'paybackMonths06'],[.008,'paybackMonths08'],[.01,'paybackMonths10']].forEach(([rate,id])=>setText(id,monthLabel(paybackAtRate(d,rate))));
    const currentAllocation=d.total?d.annualPremium/d.total*100:0,proposedAllocation=d.withoutInsurance?d.annualPremium/d.withoutInsurance*100:0;
    setWebGauge('gaugeCurrent',currentAllocation);setWebGauge('gaugeProposed',proposedAllocation);drawPayback(d);
    document.querySelectorAll('.scenario-grid>div,.web-gauge').forEach(card=>setDashboardDetail(card,card.querySelector('span,h4')?.textContent||'Indicador',[card.querySelector('strong')?.textContent||'']));
  }

  document.querySelectorAll('[data-status]').forEach(btn=>btn.addEventListener('click',()=>{mode=btn.dataset.status;document.querySelectorAll('[data-status]').forEach(b=>b.classList.toggle('active',b===btn));$('spouseBlock').classList.toggle('hidden',mode!=='couple');$('spouseAssets').classList.toggle('hidden',mode!=='couple');render();}));
  inputIds.forEach(id=>{const input=$(id);if(!input)return;if(moneyInputIds.includes(id)||decimalInputIds.includes(id)){finishMoneyFormat(input);input.addEventListener('focus',()=>{if(parseNumericValue(input.value)===0)input.select();});input.addEventListener('input',()=>{formatMoneyWhileTyping(input);render();});input.addEventListener('blur',()=>{finishMoneyFormat(input);render();});return;}input.addEventListener(id==='consultant'?'change':'input',render);});
  const surrenderPdfInput=$('surrenderPdfInput'),surrenderPdfButton=$('surrenderPdfButton'),surrenderPdfDrop=$('surrenderPdfDrop');
  surrenderPdfButton?.addEventListener('click',()=>surrenderPdfInput?.click());
  surrenderPdfInput?.addEventListener('change',()=>{const file=surrenderPdfInput.files?.[0];if(file)importSurrenderPdf(file);});
  ['dragenter','dragover'].forEach(type=>surrenderPdfDrop?.addEventListener(type,event=>{event.preventDefault();event.stopPropagation();surrenderPdfDrop.classList.add('dragover');}));
  ['dragleave','drop'].forEach(type=>surrenderPdfDrop?.addEventListener(type,event=>{event.preventDefault();event.stopPropagation();surrenderPdfDrop.classList.remove('dragover');}));
  surrenderPdfDrop?.addEventListener('drop',event=>{const file=event.dataTransfer?.files?.[0];if(file)importSurrenderPdf(file);});
  $('surrenderInputs')?.addEventListener('focusin',event=>{const input=event.target.closest('[data-surrender-index]');if(input&&parseNumericValue(input.value)===0)input.select();});
  $('surrenderInputs')?.addEventListener('paste',event=>{const input=event.target.closest('[data-surrender-index]');if(input)pasteSurrenderColumn(event,input);});
  $('surrenderInputs')?.addEventListener('input',event=>{const input=event.target.closest('[data-surrender-index]');if(!input)return;formatMoneyWhileTyping(input);surrenderValues[Number(input.dataset.surrenderIndex)]=parseNumericValue(input.value);render();});
  $('surrenderInputs')?.addEventListener('focusout',event=>{const input=event.target.closest('[data-surrender-index]');if(!input)return;finishMoneyFormat(input);surrenderValues[Number(input.dataset.surrenderIndex)]=parseNumericValue(input.value);render();});
  document.addEventListener('pointermove',event=>{
    const target=event.target.closest?.('[data-dashboard-title]');if(!target)return;
    if(target.id==='paybackChart'&&target.__dashboardMeta){
      const meta=target.__dashboardMeta,rect=target.getBoundingClientRect(),localX=(event.clientX-rect.left)*(meta.w/rect.width),month=clamp(Math.round((localX-meta.left)/(meta.w-meta.left-meta.right)*meta.months),0,meta.months);
      if(target.__hoverMonth!==month){target.__hoverMonth=month;drawPayback(meta.d,month);}
      const lines=[`Prêmio anual: ${money(meta.d.annualPremium)}`,...meta.rates.map(rate=>`${(rate*100).toLocaleString('pt-BR',{maximumFractionDigits:1})}% a.m.: ${money(meta.d.financial*rate*month)}`)];
      showTooltip(target,event,`Mês ${month}`,lines.join('\n'));return;
    }
    showTooltip(target,event);
  });
  document.addEventListener('pointerout',event=>{const target=event.target.closest?.('[data-dashboard-title]');if(!target||target.contains(event.relatedTarget))return;if(target.id==='paybackChart'&&target.__dashboardMeta){target.__hoverMonth=null;drawPayback(target.__dashboardMeta.d);}hideTooltip();});
  window.addEventListener('resize',()=>{clearTimeout(window.__chartResize);window.__chartResize=setTimeout(render,120);});
  const fmt=n=>money(n); const pct=n=>`${(Number(n)||0).toLocaleString('pt-BR',{maximumFractionDigits:1})}%`;
  function addBrand(slide){slide.addImage({path:'assets/logo-alta-vista.png',x:.62,y:.18,w:.48,h:.22,transparency:0});slide.addText('GESTÃO DE RISCOS',{x:1.35,y:.22,w:2.9,h:.2,fontFace:'Georgia',fontSize:9,color:'E5B957',charSpacing:4,margin:0});}
  function addHeader(pptx,slide,title){slide.background={color:'020E38'};addBrand(slide);slide.addText(title,{x:1.35,y:.56,w:8.05,h:.5,fontFace:'Arial',fontSize:24,bold:true,color:'F1F3F8',margin:0,fit:'shrink'});}
  function addCard(pptx,slide,x,y,w,h,line='A77D25',fill='061743'){slide.addShape(pptx.ShapeType.roundRect,{x,y,w,h,rectRadius:.07,fill:{color:fill,transparency:8},line:{color:line,width:1}});}
  function addDonut(pptx,slide,x,y,w,h,d,withInsurance){const labels=['XP','Outras instituições','Previdência privada'],values=[d.xp,d.other,d.pension],colors=['D2A500','BD974F','FFBF00'];if(withInsurance){labels.push('Seguro de vida');values.push(d.coverageAfter);colors.push('70B544');}slide.addChart(pptx.ChartType.doughnut,[{name:'Composição',labels,values}],{x,y,w,h,showLegend:false,showTitle:false,showValue:false,holeSize:62,showPercent:true,showCategoryName:false,chartColors:colors,border:{color:'061743',pt:0},showLeaderLines:false});}
  function addLegend(slide,items,x,y){items.forEach((it,i)=>{slide.addShape('rect',{x,y:y+i*.38,w:.09,h:.09,fill:{color:it[2]},line:{color:it[2]}});slide.addText(it[0],{x:x+.14,y:y-.03+i*.38,w:1.45,h:.16,fontSize:10,color:'F1F3F8',margin:0,fit:'shrink'});slide.addText(fmt(it[1]),{x:x+1.55,y:y-.03+i*.38,w:1.0,h:.16,fontSize:9.5,color:'BAC5D9',align:'right',margin:0,fit:'shrink'});});}
  function addWealthBar(pptx,slide,d,withInsurance){const x=6.15,w=1.55,bottom=5.35,max=Math.max(d.total+d.coverageAfter,1),scale=2.9/max;let y=bottom;const pieces=[['Ativos financeiros',d.financial,'BD974F'],['Patrimônio imobilizado',d.illiquid,'294878']];if(withInsurance)pieces.push(['Seguro de vida',d.coverageAfter,'70B544']);pieces.forEach(([label,val,color])=>{const h=Math.max(.28,val*scale);y-=h;slide.addShape(pptx.ShapeType.rect,{x,y,w,h,fill:{color},line:{color}});slide.addText(fmt(val),{x:x+.08,y:y+h/2-.11,w:w-.16,h:.22,fontSize:9,bold:true,color:'FFFFFF',align:'center',margin:0,fit:'shrink'});});const costH=Math.max(.25,d.liability*scale);slide.addShape(pptx.ShapeType.roundRect,{x,y:bottom,w,h:costH,rectRadius:.04,fill:{color:withInsurance?'BFC2C8':'FF4848'},line:{color:withInsurance?'BFC2C8':'FF4848'}});slide.addText('-'+fmt(d.liability),{x:x+.05,y:bottom+costH/2-.1,w:w-.1,h:.2,fontSize:8.5,bold:true,color:'FFFFFF',align:'center',margin:0,fit:'shrink'});}
  function buildPpt(d){
    const pptx=new PptxGenJS();pptx.layout='LAYOUT_WIDE';pptx.author='Gestão de Riscos';pptx.company='Alta Vista';pptx.subject='Sucessão patrimonial';pptx.title=`Gestão de Riscos - ${d.name}`;pptx.lang='pt-BR';
    let s=pptx.addSlide();s.background={color:'020E38'};addBrand(s);s.addText('SUCESSÃO PATRIMONIAL',{x:.8,y:2.0,w:8.4,h:.65,fontFace:'Georgia',fontSize:31,color:'F1F3F8',align:'center',margin:0});s.addText('Gestão de Riscos',{x:2.2,y:2.95,w:5.6,h:.45,fontSize:24,color:'E5B957',align:'center',margin:0});s.addText(d.name+(d.spouse?` & ${d.spouseName}`:''),{x:2,y:4.2,w:6,h:.3,fontFace:'Georgia',fontSize:16,color:'F1F3F8',align:'center',margin:0});s.addText('Apresentação confidencial',{x:3.3,y:6.6,w:3.4,h:.2,fontSize:8,color:'AEB9D1',align:'center',margin:0});
    s=pptx.addSlide();addHeader(pptx,s,'O RISCO NÃO É O PATRIMÔNIO. É A FALTA DE LIQUIDEZ.');s.addText('Na sucessão, impostos, honorários e custos precisam ser pagos antes que a família tenha liberdade para decidir o que fazer com os ativos.',{x:1.35,y:1.45,w:7.3,h:1.0,fontSize:22,color:'F1F3F8',margin:0,fit:'shrink'});addCard(pptx,s,1.35,3.2,2.2,1.65);addCard(pptx,s,3.9,3.2,2.2,1.65);addCard(pptx,s,6.45,3.2,2.2,1.65);[['Patrimônio','construído ao longo da vida'],['Sucessão','exige liquidez imediata'],['Seguro','preserva escolhas da família']].forEach((a,i)=>{const x=1.55+i*2.55;s.addText(a[0],{x,y:3.55,w:1.8,h:.3,fontSize:18,bold:true,color:i===2?'70B544':'E5B957',align:'center',margin:0});s.addText(a[1],{x,y:4.05,w:1.8,h:.45,fontSize:12,color:'F1F3F8',align:'center',margin:0,fit:'shrink'});});
    s=pptx.addSlide();addHeader(pptx,s,'CUSTOS DA SUCESSÃO');addCard(pptx,s,.45,1.35,5.1,4.85);s.addText('MAPEAMENTO DE ATIVOS INVENTARIÁVEIS',{x:.75,y:1.68,w:4.5,h:.22,fontSize:12,bold:true,color:'C7A15B',margin:0});const rows=[['Investimentos na XP',d.xp,'F1F3F8'],['Outras instituições',d.other,'F1F3F8'],['Imóveis e ativos físicos',d.realEstate,'F1F3F8'],['Participações societárias / holdings',d.holdings,'F1F3F8'],['Previdência privada (fora da base)',-d.pension,'70B544']];rows.forEach((r,i)=>{const yy=2.15+i*.55;s.addText(r[0],{x:.75,y:yy,w:3.25,h:.22,fontSize:13,color:r[2],margin:0});s.addText((r[1]<0?'-':'')+fmt(Math.abs(r[1])),{x:3.8,y:yy,w:1.4,h:.22,fontSize:13,bold:true,color:r[2],align:'right',margin:0,fit:'shrink'});s.addShape(pptx.ShapeType.line,{x:.75,y:yy+.33,w:4.45,h:0,line:{color:'1C3767',width:.7}});});s.addText('TOTAL INVENTARIÁVEL',{x:.75,y:5.45,w:2.5,h:.25,fontSize:14,bold:true,color:'F1F3F8',margin:0});s.addText(fmt(d.inventoriable),{x:3.15,y:5.4,w:2.05,h:.3,fontSize:19,bold:true,color:'D4AD61',align:'right',margin:0,fit:'shrink'});
    addCard(pptx,s,5.7,1.35,3.85,2.75,'FF4848','29102E');s.addText('ENCARGOS DA SUCESSÃO',{x:5.95,y:1.7,w:2.2,h:.24,fontSize:12,bold:true,color:'F1F3F8',margin:0});s.addText('ITCMD | Honorários | Custas processuais | Cartório',{x:5.95,y:2.25,w:2.1,h:.9,fontSize:14,color:'E7DCE6',margin:0,fit:'shrink'});s.addText('15%',{x:8.15,y:2.15,w:1.05,h:.55,fontSize:32,bold:true,color:'FF4848',align:'center',margin:0});s.addText('EROSÃO PATRIMONIAL ESTIMADA',{x:6.15,y:3.25,w:2.95,h:.24,fontSize:13,bold:true,color:'FF4848',align:'center',margin:0});s.addText('-'+fmt(d.liability),{x:6.05,y:3.62,w:3.15,h:.35,fontSize:22,bold:true,color:'FF4848',align:'center',margin:0,fit:'shrink'});addCard(pptx,s,5.7,4.3,3.85,1.9,'C1A06A','C1A06A');s.addText('PATRIMÔNIO LÍQUIDO TRANSMITIDO',{x:6.1,y:4.68,w:3.05,h:.24,fontSize:12,bold:true,color:'FFFFFF',align:'center',margin:0});s.addText(fmt(d.withoutInsurance),{x:6.0,y:5.12,w:3.25,h:.38,fontSize:23,bold:true,color:'071744',align:'center',margin:0,fit:'shrink'});s.addText('A família receberá menos patrimônio',{x:6.1,y:5.68,w:3.05,h:.2,fontSize:11,bold:true,color:'FFFFFF',align:'center',margin:0});
    function wealthSlide(title,withInsurance){const slide=pptx.addSlide();addHeader(pptx,slide,title);addCard(pptx,slide,.5,1.35,4.45,4.85);addCard(pptx,slide,5.15,1.35,4.35,4.85);slide.addText(withInsurance?'ATIVOS E PROTEÇÃO':'ATIVOS FINANCEIROS',{x:.8,y:1.68,w:2.8,h:.2,fontSize:12,bold:true,color:'C7A15B',margin:0});addDonut(pptx,slide,.75,2.05,2.55,2.25,d,withInsurance);const legend=[['XP',d.xp,'D2A500'],['Outras instituições',d.other,'BD974F'],['Previdência privada',d.pension,'FFBF00']];if(withInsurance)legend.push(['Seguro de vida',d.coverageAfter,'70B544']);addLegend(slide,legend,3.1,2.3);slide.addText(withInsurance?'SEGURO DE VIDA':'ATIVOS FINANCEIROS',{x:.8,y:4.72,w:2.5,h:.26,fontSize:14,bold:true,color:withInsurance?'70B544':'F1F3F8',margin:0});slide.addText(fmt(withInsurance?d.coverageAfter:d.financial),{x:2.8,y:4.68,w:1.75,h:.3,fontSize:15,bold:true,color:'F1F3F8',align:'right',margin:0,fit:'shrink'});slide.addText('Patrimônio imobilizado',{x:.8,y:5.25,w:2.5,h:.24,fontSize:13,color:'F1F3F8',margin:0});slide.addText(fmt(d.illiquid),{x:2.8,y:5.22,w:1.75,h:.25,fontSize:14,bold:true,color:'F1F3F8',align:'right',margin:0,fit:'shrink'});slide.addText(withInsurance?'PATRIMÔNIO PROTEGIDO':'PATRIMÔNIO TOTAL',{x:5.45,y:1.68,w:3,h:.22,fontSize:12,bold:true,color:'C7A15B',margin:0});addWealthBar(pptx,slide,d,withInsurance);const items=withInsurance?[['Seguro de vida',d.coverageAfter,'70B544'],['Patrimônio imobilizado',d.illiquid,'294878'],['Ativos financeiros',d.financial,'BD974F'],['Custo sucessório coberto',d.liability,'BFC2C8']]:[['Passivo sucessório',d.liability,'FF4848'],['Patrimônio imobilizado',d.illiquid,'294878'],['Ativos financeiros',d.financial,'BD974F']];addLegend(slide,items,8.05,2.9);slide.addText(withInsurance?'A cobertura recompõe a liquidez consumida na sucessão.':'Sem uma fonte de liquidez, o custo sai do patrimônio da família.',{x:5.55,y:5.9,w:3.45,h:.2,fontSize:11.5,bold:true,color:withInsurance?'70B544':'FF6666',align:'center',margin:0,fit:'shrink'});return slide;}
    wealthSlide('PATRIMÔNIO ATUAL — SEM SEGURO',false);wealthSlide('PATRIMÔNIO COM SEGURO RESGATÁVEL',true);
    const projection=wlProjection(d);s=pptx.addSlide();addHeader(pptx,s,'PROJEÇÃO VITALÍCIA');s.addText(`IPCA: ${pct(d.ipca)} a.a.`,{x:7.7,y:.62,w:1.4,h:.22,fontSize:12,bold:true,color:'E5B957',align:'right',margin:0});addCard(pptx,s,.45,1.35,6.55,4.95);const cats=projection.map(r=>String(r.age));s.addChart(pptx.ChartType.line,[{name:'Capital segurado',labels:cats,values:projection.map(r=>Math.round(r.capital))},{name:'Prêmio anual',labels:cats,values:projection.map(r=>Math.round(r.premium))}],{x:.75,y:1.75,w:5.95,h:3.55,showTitle:false,showLegend:true,legendPos:'b',legendColor:'F1F3F8',showValue:false,catAxisLabelFontSize:8,catAxisLabelColor:'AEB9D1',valAxisLabelFontSize:9,valAxisLabelColor:'AEB9D1',chartColors:['D6A700','70B544'],showCatName:false,lineSize:3,showMarker:false,valGridLine:{color:'29416E',width:1},catAxisLineColor:'6B7DA2',valAxisLineColor:'6B7DA2'});s.addText('10 aportes anuais',{x:.8,y:5.65,w:1.8,h:.22,fontSize:11,color:'C5D0E5',margin:0});s.addText('APÓLICE QUITADA',{x:2.8,y:5.65,w:1.8,h:.22,fontSize:12,bold:true,color:'70B544',align:'center',margin:0});s.addText('cobertura continua vitalícia →',{x:4.9,y:5.65,w:1.75,h:.22,fontSize:11,color:'C5D0E5',align:'right',margin:0});[['Capital inicial',fmt(d.coverageGap),'E5B957'],['Último prêmio | 10º aporte',fmt(projection[9]?.premium||0),'E5B957'],['Novos aportes após o 10º ano','R$ 0,00','70B544']].forEach((a,i)=>{addCard(pptx,s,7.25,1.35+i*1.63,2.3,1.38);s.addText(a[0],{x:7.48,y:1.65+i*1.63,w:1.85,h:.28,fontSize:11,bold:true,color:'C7A15B',align:'center',margin:0,fit:'shrink'});s.addText(a[1],{x:7.45,y:2.13+i*1.63,w:1.9,h:.3,fontSize:16,bold:true,color:a[2],align:'center',margin:0,fit:'shrink'});});
    s=pptx.addSlide();addHeader(pptx,s,'COMO DIVERSIFICAR COM SEUS RENDIMENTOS');addCard(pptx,s,.45,1.35,9.1,3.8);s.addText('CENÁRIO DE PAYBACK',{x:.75,y:1.65,w:2.2,h:.22,fontSize:12,bold:true,color:'C7A15B',margin:0});s.addText(`ATIVOS FINANCEIROS: ${fmt(d.financial)}`,{x:6.6,y:1.62,w:2.45,h:.25,fontSize:13,bold:true,color:'F1F3F8',align:'right',margin:0,fit:'shrink'});const labels=Array.from({length:13},(_,i)=>`Mês ${i}`);const rates=[.006,.008,.01,d.monthlyReturn].filter((v,i,a)=>v>0&&a.findIndex(x=>Math.abs(x-v)<.00001)===i);const series=rates.map((rate,i)=>({name:`Rentabilidade ${(rate*100).toLocaleString('pt-BR',{maximumFractionDigits:1})}%`,labels,values:labels.map((_,m)=>Math.round(d.financial*rate*m))}));series.push({name:'Prêmio anual',labels,values:labels.map(()=>Math.round(d.annualPremium))});s.addChart(pptx.ChartType.line,series,{x:.75,y:2.0,w:8.4,h:2.75,showLegend:true,legendPos:'b',legendColor:'F1F3F8',showValue:false,catAxisLabelFontSize:8,catAxisLabelColor:'AEB9D1',valAxisLabelFontSize:9,valAxisLabelColor:'AEB9D1',chartColors:['7D6A36','B88700','D6A700','70B544','8BD05F'],lineSize:2,showMarker:false,valGridLine:{color:'29416E',width:1}});const payCards=[['PRÊMIO ANUAL',fmt(d.annualPremium),'F1F3F8'],['RENDIMENTOS PAGAM EM',d.paybackMonths?`${d.paybackMonths} ${d.paybackMonths===1?'MÊS':'MESES'}`:'—','70B544'],['PRÊMIO / PATRIMÔNIO TOTAL',d.total?pct(d.annualPremium/d.total*100):'0%','F1F3F8']];payCards.forEach((a,i)=>{addCard(pptx,s,.55+i*3.0,5.35,2.75,1.15,i===1?'70B544':'A77D25',i===1?'173C32':'061743');s.addText(a[0],{x:.75+i*3.0,y:5.6,w:2.35,h:.2,fontSize:9.5,bold:true,color:'C7A15B',align:'center',margin:0,fit:'shrink'});s.addText(a[1],{x:.75+i*3.0,y:5.98,w:2.35,h:.24,fontSize:14,bold:true,color:a[2],align:'center',margin:0,fit:'shrink'});});
    s=pptx.addSlide();s.background={color:'020E38'};addBrand(s);s.addText('Ter patrimônio é conquista.',{x:1.5,y:2.2,w:7,h:.4,fontFace:'Georgia',fontSize:24,color:'F1F3F8',align:'center',margin:0});s.addText('Proteger o LEGADO é preservar escolhas.',{x:1.1,y:2.88,w:7.8,h:.5,fontFace:'Georgia',fontSize:25,color:'E5B957',align:'center',margin:0});s.addText(d.consultant,{x:3,y:4.55,w:4,h:.3,fontSize:15,color:'F1F3F8',align:'center',margin:0});s.addText('Apresentação confidencial',{x:3,y:5.2,w:4,h:.25,fontSize:10,color:'9BA8C2',align:'center',margin:0});
    return pptx;
  }

  async function pptWithTransitions(pptx) {
    const buffer=await pptx.write({outputType:'arraybuffer',compression:true}); const zip=await JSZip.loadAsync(buffer); const files=Object.keys(zip.files).filter(name=>/^ppt\/slides\/slide\d+\.xml$/.test(name));
    await Promise.all(files.map(async name=>{let xml=await zip.file(name).async('string');xml=xml.replace(/(descr="assets\/logo-alta-vista\.png"[\s\S]*?<p:blipFill>[\s\S]*?<\/a:blip>)\s*<a:stretch><a:fillRect\/><\/a:stretch>/,`$1<a:srcRect l="25000" r="36000" t="18000" b="48000"/><a:stretch><a:fillRect/></a:stretch>`).replace(/<p:transition\b[^>]*\/>/g,'').replace(/<p:transition\b[^>]*>[\s\S]*?<\/p:transition>/g,'');const transition='<p:transition spd="med" advClick="1"><p:fade/></p:transition>';xml=xml.includes('</p:clrMapOvr>')?xml.replace('</p:clrMapOvr>',`</p:clrMapOvr>${transition}`):xml.replace('</p:cSld>',`</p:cSld>${transition}`);zip.file(name,xml);}));
    return zip.generateAsync({type:'blob',compression:'DEFLATE'});
  }
  function downloadBlob(blob,name){const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;document.body.appendChild(a);a.click();setTimeout(()=>{URL.revokeObjectURL(url);a.remove();},500);}
  async function generateOutput(kind){
    const form=$('clientForm');if(!form.reportValidity())return;
    const status=$('status'),pptBtn=$('generatePptBtn'),pdfBtn=$('generatePdfBtn');
    pptBtn.disabled=true;pdfBtn.disabled=true;
    status.textContent=kind==='pdf'?'Montando o PDF sem os slides duplicados de efeito…':'Personalizando o PowerPoint e aplicando as transições…';
    try{
      const d=data();
      const blob=kind==='pdf'?await window.buildTemplatePdf(d):await window.buildTemplatePpt(d);
      const safe=d.familyLabel.normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/gi,'-').replace(/^-|-$/g,'');
      downloadBlob(blob,`Gestao-de-Riscos-${safe||'Familia'}.${kind==='pdf'?'pdf':'pptx'}`);
      status.textContent=kind==='pdf'?'PDF gerado sem as duplicações usadas no efeito da apresentação.':'PowerPoint gerado com os efeitos de apresentação.';
    }catch(error){console.error(error);status.textContent=`Erro ao gerar o ${kind==='pdf'?'PDF':'PowerPoint'}: ${error?.message||String(error)}`;}
    finally{pptBtn.disabled=false;pdfBtn.disabled=false;}
  }
  $('clientForm').addEventListener('submit',event=>{event.preventDefault();generateOutput('pptx');});
  $('generatePdfBtn').addEventListener('click',()=>generateOutput('pdf'));
  render();
})();
