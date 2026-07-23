(() => {
  const W=1600,H=900,NAVY='#020e38',PANEL='#061743',GOLD='#c5a05b',GOLD2='#d5a800',WHITE='#f4f5f8',MUTED='#c6cfdf',GREEN='#70b544',RED='#ff4848',BLUE='#294878';
  const imageCache=new Map();
  const brl=value=>new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL',minimumFractionDigits:2,maximumFractionDigits:2}).format(Number(value)||0);
  const pct=value=>`${(Number(value)||0).toLocaleString('pt-BR',{maximumFractionDigits:2})}%`;
  const esc=value=>String(value).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  const clientLabel=d=>d.spouse?`${d.name} e ${d.spouseName}`:d.name;

  function loadImage(url){
    if(imageCache.has(url))return imageCache.get(url);
    const promise=new Promise((resolve,reject)=>{const img=new Image();img.onload=()=>resolve(img);img.onerror=()=>reject(new Error(`Não foi possível carregar ${url}`));img.src=url;});
    imageCache.set(url,promise);return promise;
  }
  async function canvasFor(slide){const canvas=document.createElement('canvas');canvas.width=W;canvas.height=H;const ctx=canvas.getContext('2d');ctx.drawImage(await loadImage(`assets/template-slides/slide${slide}.jpg`),0,0,W,H);return {canvas,ctx};}
  const rect=(ctx,x,y,w,h,fill,r=0,stroke=null,lw=1)=>{ctx.save();ctx.beginPath();if(r){ctx.roundRect(x,y,w,h,r);}else ctx.rect(x,y,w,h);ctx.fillStyle=fill;ctx.fill();if(stroke){ctx.strokeStyle=stroke;ctx.lineWidth=lw;ctx.stroke();}ctx.restore();};
  function text(ctx,value,x,y,w,{size=26,color=WHITE,bold=false,align='left',font='Arial',baseline='middle',maxLines=1}={}){
    ctx.save();ctx.fillStyle=color;ctx.textAlign=align;ctx.textBaseline=baseline;ctx.font=`${bold?'700':'400'} ${size}px ${font}`;
    const anchor=align==='center'?x+w/2:align==='right'?x+w:x;
    let lines=[String(value)];
    if(maxLines>1){lines=[];let line='';for(const word of String(value).split(/\s+/)){const test=line?`${line} ${word}`:word;if(ctx.measureText(test).width>w&&line){lines.push(line);line=word;}else line=test;}if(line)lines.push(line);lines=lines.slice(0,maxLines);}
    const step=size*1.2;lines.forEach((line,i)=>ctx.fillText(line,anchor,y+(i-(lines.length-1)/2)*step));ctx.restore();
  }
  function fitText(ctx,value,x,y,w,{size=26,min=12,color=WHITE,bold=false,align='left',font='Arial'}={}){
    let current=size;ctx.save();do{ctx.font=`${bold?'700':'400'} ${current}px ${font}`;if(ctx.measureText(String(value)).width<=w)break;current--;}while(current>min);ctx.restore();text(ctx,value,x,y,w,{size:current,color,bold,align,font});
  }
  function line(ctx,x1,y1,x2,y2,color='#24406e',lw=1,dash=[]){ctx.save();ctx.strokeStyle=color;ctx.lineWidth=lw;ctx.setLineDash(dash);ctx.beginPath();ctx.moveTo(x1,y1);ctx.lineTo(x2,y2);ctx.stroke();ctx.restore();}
  function donut(ctx,cx,cy,r,inner,values,colors){const total=values.reduce((a,b)=>a+Math.max(0,b),0)||1;let a=-Math.PI/2;values.forEach((v,i)=>{const next=a+Math.PI*2*Math.max(0,v)/total;ctx.beginPath();ctx.arc(cx,cy,r,a,next);ctx.arc(cx,cy,inner,next,a,true);ctx.closePath();ctx.fillStyle=colors[i];ctx.fill();a=next;});}
  async function pngBytes(canvas){const blob=await new Promise((resolve,reject)=>canvas.toBlob(b=>b?resolve(b):reject(new Error('Falha ao criar a imagem do slide.')),'image/png'));return new Uint8Array(await blob.arrayBuffer());}
  async function staticSlide(no){const {canvas}=await canvasFor(no);return pngBytes(canvas);}

  async function slide1(d){
    const {canvas,ctx}=await canvasFor(1);
    const band=ctx.createLinearGradient(250,0,1350,0);band.addColorStop(0,'rgba(2,14,56,0)');band.addColorStop(.18,'rgba(2,14,56,.94)');band.addColorStop(.30,'rgba(2,14,56,1)');band.addColorStop(.70,'rgba(2,14,56,1)');band.addColorStop(.82,'rgba(2,14,56,.94)');band.addColorStop(1,'rgba(2,14,56,0)');
    rect(ctx,250,620,1100,175,band);line(ctx,455,642,1145,642,'rgba(197,160,91,.75)',1);line(ctx,455,774,1145,774,'rgba(197,160,91,.55)',1);
    text(ctx,'PLANEJAMENTO SUCESSÓRIO PARA',500,675,600,{size:14,color:GOLD,bold:true,align:'center',font:'Georgia'});
    fitText(ctx,clientLabel(d),390,724,820,{size:38,min:22,color:WHITE,bold:false,align:'center',font:'Georgia'});
    return pngBytes(canvas);
  }

  async function slide6(d){
    const {canvas,ctx}=await canvasFor(6);
    rect(ctx,31,198,835,626,'#03143d',20,'#9d7624',2);
    text(ctx,'MAPEAMENTO DE ATIVOS INVENTARIÁVEIS',52,262,760,{size:21,color:GOLD,bold:true});
    const values=[['Posição em investimentos (XP)',d.xp],['Posição em outras instituições',d.other],['Bens imóveis e ativos físicos',d.realEstate],['Participações societárias/Holdings',d.holdings],['Previdência Privada (Isenta de inventário)',-d.pension]];
    values.forEach(([label,v],i)=>{const y=318+i*79,color=i===4?GREEN:MUTED;text(ctx,label,52,y,485,{size:23,color});fitText(ctx,`${v<0?'-':''}${brl(Math.abs(v))}`,548,y,285,{size:27,min:18,color,bold:true,align:'right'});line(ctx,65,y+34,820,y+34,'#1d3766',1);});
    line(ctx,65,713,820,713,'#9d7624',1);text(ctx,'TOTAL INVENTARIÁVEL',52,770,390,{size:22,color:WHITE,bold:true});fitText(ctx,brl(d.inventoriable),455,770,378,{size:33,min:22,color:GOLD,bold:true,align:'right'});

    rect(ctx,882,198,686,390,'#2b102d',20,RED,2);
    text(ctx,'ENCARGOS DA SUCESSÃO',914,247,430,{size:21,color:WHITE,bold:true});
    ['ITCMD | 2% à 8%','Honorários (Tabela OAB) | 6% à 8%','Custas processuais | 1%','Cartório | 1%'].forEach((label,i)=>text(ctx,label,914,305+i*37,410,{size:20,color:'#e3dce6'}));
    line(ctx,1336,302,1336,430,'#63203d',1);text(ctx,'15%',1355,365,185,{size:72,color:RED,bold:true,align:'center'});
    line(ctx,914,450,1538,450,'#63203d',1);text(ctx,'EROSÃO PATRIMONIAL ESTIMADA',940,486,570,{size:22,color:RED,bold:true,align:'center'});fitText(ctx,`-${brl(d.liability)}`,930,540,590,{size:40,min:27,color:RED,bold:true,align:'center'});

    rect(ctx,882,610,686,214,'#c3a067',20,'#9d7624',2);
    text(ctx,'PATRIMÔNIO LÍQUIDO TRANSMITIDO',960,654,530,{size:20,color:WHITE,bold:true,align:'center'});fitText(ctx,brl(d.withoutInsurance),950,716,550,{size:39,min:26,color:'#061743',bold:true,align:'center'});line(ctx,1015,758,1435,758,'#b27f52',1);text(ctx,'A família receberá MENOS patrimônio',955,790,540,{size:20,color:WHITE,bold:true,align:'center'});
    return pngBytes(canvas);
  }

  function legend(ctx,items,x,y,gap=44){items.forEach((it,i)=>{rect(ctx,x,y+i*gap-7,12,12,it.color);text(ctx,it.label,x+20,y+i*gap,250,{size:17,color:it.color===GREEN?GREEN:WHITE,bold:it.color===GREEN});});}
  function stackedBar(ctx,d,x,y,w,h,withInsurance=false,reallocation=false){
    const financial=Math.max(0,d.financial-(reallocation?d.annualPremium:0));
    const pieces=[{label:'Ativos financeiros',value:financial,color:GOLD},{label:'Patrimônio imobilizado',value:d.illiquid,color:BLUE}];
    if(withInsurance)pieces.unshift({label:'Seguro de vida',value:d.coverageAfter,color:GREEN});
    if(reallocation)pieces.unshift({label:'Reserva lastreada',value:d.annualPremium,color:'#7fb8a4'});
    const max=Math.max(1,pieces.reduce((a,b)=>a+b.value,0));let cursor=y+h;
    pieces.forEach(piece=>{const ph=piece.value>0?h*piece.value/max:0;if(ph<=0)return;cursor-=ph;rect(ctx,x,cursor,w,ph,piece.color,piece===pieces[pieces.length-1]?12:0);const piecePct=piece.value/max*100;if(ph>=54){fitText(ctx,brl(piece.value),x+8,cursor+ph/2-11,w-16,{size:17,min:11,color:WHITE,bold:true,align:'center'});fitText(ctx,pct(piecePct),x+8,cursor+ph/2+14,w-16,{size:14,min:10,color:WHITE,bold:true,align:'center'});}else if(ph>=26)fitText(ctx,`${brl(piece.value)} · ${pct(piecePct)}`,x+6,cursor+ph/2,w-12,{size:15,min:9,color:WHITE,bold:true,align:'center'});});
    const baseline=y+h;
    line(ctx,x-155,baseline,x-14,baseline,'#8795af',2,[10,8]);
    line(ctx,x+w+14,baseline,x+w+155,baseline,'#8795af',2,[10,8]);
    const costY=baseline+10,costH=Math.max(34,h*d.liability/Math.max(d.total,1)),costPct=d.liability/Math.max(d.total,1)*100;rect(ctx,x,costY,w,costH,withInsurance?'#bfc2c8':RED,withInsurance?0:0);if(costH>=54){fitText(ctx,`-${brl(d.liability)}`,x+6,costY+costH/2-10,w-12,{size:16,min:11,color:WHITE,bold:true,align:'center'});fitText(ctx,pct(costPct),x+6,costY+costH/2+13,w-12,{size:14,min:10,color:WHITE,bold:true,align:'center'});}else fitText(ctx,`-${brl(d.liability)} · ${pct(costPct)}`,x+6,costY+costH/2,w-12,{size:15,min:9,color:WHITE,bold:true,align:'center'});
  }
  async function assetSlide(slide,d,type){
    const {canvas,ctx}=await canvasFor(slide);const withInsurance=type==='with';const reallocation=type==='reallocation';
    rect(ctx,70,230,700,374,'#03143d');rect(ctx,825,230,720,570,'#03143d');
    if(withInsurance){rect(ctx,56,620,732,70,'#173c32',14,'#d6dfeb',2);rect(ctx,56,700,732,124,'#03143d',14,'#9d7624',2);}
    else if(reallocation){rect(ctx,56,620,732,70,'#03143d',14,GREEN,2);rect(ctx,56,700,732,124,'#03143d',14,'#9d7624',2);}
    else rect(ctx,56,630,732,144,'#03143d',14,'#9d7624',2);
    const vals=withInsurance?[d.xp,d.other,d.pension,d.coverageAfter]:reallocation?[Math.max(0,d.xp-d.annualPremium),d.other,d.pension,d.annualPremium]:[d.xp,d.other,d.pension];
    const colors=withInsurance?[GOLD2,GOLD,'#ffbf00',GREEN]:reallocation?[GOLD2,GOLD,'#ffbf00','#7fb8a4']:[GOLD2,GOLD,'#ffbf00'];
    donut(ctx,250,405,130,62,vals,colors);
    const items=[{label:'Posição em investimentos (XP)',color:GOLD2},{label:'Posição em outras instituições',color:GOLD},{label:'Previdência Privada',color:'#ffbf00'}];
    if(withInsurance)items.push({label:'SEGURO DE VIDA',color:GREEN});if(reallocation)items.push({label:'RESERVA LASTREADA',color:'#7fb8a4'});legend(ctx,items,420,335,55);
    if(withInsurance){text(ctx,'SEGURO DE VIDA',90,665,340,{size:28,color:WHITE,bold:true});fitText(ctx,brl(d.coverageAfter),430,665,300,{size:28,min:18,color:WHITE,bold:true,align:'right'});text(ctx,'Ativos Financeiros',90,735,340,{size:25,color:MUTED});fitText(ctx,brl(d.financial),430,735,300,{size:25,min:17,color:MUTED,bold:true,align:'right'});text(ctx,'Patrimônio imobilizado',90,802,340,{size:25,color:MUTED});fitText(ctx,brl(d.illiquid),430,802,300,{size:25,min:17,color:MUTED,bold:true,align:'right'});}
    else if(reallocation){text(ctx,'RESERVA LASTREADA',90,665,340,{size:26,color:'#a9d9ca',bold:true});fitText(ctx,brl(d.annualPremium),430,665,300,{size:27,min:18,color:WHITE,bold:true,align:'right'});text(ctx,'ATIVOS FINANCEIROS',90,735,340,{size:24,color:MUTED});fitText(ctx,brl(Math.max(0,d.financial-d.annualPremium)),430,735,300,{size:25,min:17,color:MUTED,bold:true,align:'right'});text(ctx,'Patrimônio imobilizado',90,802,340,{size:24,color:MUTED});fitText(ctx,brl(d.illiquid),430,802,300,{size:25,min:17,color:MUTED,bold:true,align:'right'});}
    else{text(ctx,'Ativos Financeiros',90,680,340,{size:26,color:MUTED});fitText(ctx,brl(d.financial),430,680,300,{size:28,min:18,color:MUTED,bold:true,align:'right'});text(ctx,'Patrimônio imobilizado',90,738,340,{size:26,color:MUTED});fitText(ctx,brl(d.illiquid),430,738,300,{size:28,min:18,color:MUTED,bold:true,align:'right'});}
    stackedBar(ctx,d,980,285,195,415,withInsurance,reallocation);
    const barLegend=withInsurance?[{label:'Passivo sucessório',color:'#bfc2c8'},{label:'Patrimônio imobilizado',color:BLUE},{label:'Ativos Financeiros',color:GOLD},{label:'SEGURO DE VIDA',color:GREEN}]:reallocation?[{label:'Passivo sucessório',color:RED},{label:'Patrimônio imobilizado',color:BLUE},{label:'Ativos Financeiros',color:GOLD},{label:'Reserva lastreada',color:'#7fb8a4'}]:[{label:'PASSIVO SUCESSÓRIO',color:RED},{label:'Patrimônio imobilizado',color:BLUE},{label:'Ativos Financeiros',color:GOLD}];
    legend(ctx,barLegend,1250,480,38);return pngBytes(canvas);
  }

  function projection(d){
    const rate=d.ipca/100;
    return Array.from({length:d.projectionYears},(_,year)=>{let accumulated=0;for(let i=0;i<Math.min(year+1,10);i++)accumulated+=d.annualPremium*Math.pow(1+rate,i);const surrender=Number(d.surrenderValues?.[year])||0;return{year,age:d.age+year,capital:d.coverageGap*Math.pow(1+rate,year),premium:year<10?d.annualPremium*Math.pow(1+rate,year):0,accumulated:year<10?accumulated:0,surrender};});
  }
  async function slide11(d){
    const {canvas,ctx}=await canvasFor(11),rows=projection(d);
    rect(ctx,30,70,1090,770,NAVY);rect(ctx,47,95,1060,46,'#ad8a3c',18);
    rect(ctx,1085,18,410,68,NAVY);fitText(ctx,clientLabel(d).toLocaleUpperCase('pt-BR'),1100,52,365,{size:18,min:10,color:WHITE,bold:true,align:'right'});
    rect(ctx,640,22,340,50,NAVY);text(ctx,`IPCA: ${pct(d.ipca)} a.a.`,640,48,340,{size:27,color:WHITE,bold:true,align:'center'});
    const cols=[48,160,405,650,875,1105],heads=['IDADE','CAPITAL SEGURADO','APORTE ANUAL','APORTE ACUMULADO','RESGATE'];
    heads.forEach((head,i)=>text(ctx,head,cols[i],119,cols[i+1]-cols[i],{size:17,color:WHITE,bold:true,align:'center'}));
    const top=142,rowH=31.4;
    rows.forEach((r,i)=>{const y=top+i*rowH;rect(ctx,48,y,1057,rowH,i%2?'#082350':'#061743');if(i===0||i===rows.length-1)rect(ctx,134,y+1,965,rowH-2,'rgba(39,91,73,.58)',7,GREEN,2);if(i===9)rect(ctx,48,y+1,1057,rowH-2,'rgba(72,30,51,.72)',7,RED,3);const cell=[r.age,brl(r.capital),brl(r.premium),brl(r.accumulated),brl(r.surrender)];cell.forEach((v,j)=>fitText(ctx,v,cols[j]+4,y+rowH/2,cols[j+1]-cols[j]-8,{size:(i===0||i===9||i===rows.length-1)&&j>0?20:17,min:11,color:i===9?WHITE:(i===rows.length-1&&(j===1||j===4)?GREEN:WHITE),bold:i===0||i===9||i===rows.length-1,align:'center'}));});
    rect(ctx,48,top+rows.length*rowH,1057,40,'#ad8a3c',0);text(ctx,'∞  C a p i t a l   S e g u r a d o   e   R e s g a t e   s e g u e m   v i t a l í c i o s  ∞',65,top+rows.length*rowH+20,1025,{size:17,color:WHITE,align:'center',font:'Georgia'});
    return pngBytes(canvas);
  }

  async function slide13(d){
    const {canvas,ctx}=await canvasFor(13);rect(ctx,62,160,1475,420,'#03143d');text(ctx,'CENÁRIO DE PAYBACK',92,185,330,{size:18,color:GOLD,bold:true});
    fitText(ctx,brl(d.financial),1220,190,265,{size:28,min:20,color:WHITE,bold:true,align:'center'});
    const x0=250,y0=500,x1=1440,y1=230,max=Math.max(d.annualPremium*1.2,d.financial*Math.max(.12/12,d.monthlyReturn)*12,1);
    for(let i=0;i<=5;i++){const y=y0-(y0-y1)*i/5;line(ctx,x0,y,x1,y,'#1d3764',1);fitText(ctx,brl(max*i/5),75,y,145,{size:14,min:10,color:WHITE,bold:true,align:'right'});}
    for(let m=0;m<=12;m++){const x=x0+(x1-x0)*m/12;line(ctx,x,y0,x,y1,'#1d3764',1);text(ctx,`MÊS ${m}`,x-35,y0+28,70,{size:13,color:WHITE,bold:true,align:'center'});}
    const annualRates=[.08,.10,.12,d.annualReturn].filter((rate,i,all)=>rate>0&&all.findIndex(item=>Math.abs(item-rate)<.00001)===i),colors=['#7d6a36','#b88700','#d6a700',GREEN];annualRates.forEach((annualRate,i)=>{const rate=annualRate/12;ctx.save();ctx.strokeStyle=colors[i];ctx.lineWidth=annualRate===d.annualReturn?5:4;ctx.beginPath();for(let m=0;m<=12;m++){const x=x0+(x1-x0)*m/12,y=y0-(y0-y1)*(d.financial*rate*m/max);m?ctx.lineTo(x,y):ctx.moveTo(x,y);}ctx.stroke();ctx.restore();});
    const py=y0-(y0-y1)*(d.annualPremium/max);line(ctx,x0,py,x1,py,GREEN,4,[16,12]);fitText(ctx,brl(d.annualPremium),1220,py-25,240,{size:23,min:17,color:WHITE,bold:true,align:'center'});
    annualRates.forEach((annualRate,i)=>{const lx=320+i*285;line(ctx,lx,548,lx+34,548,colors[i],4);text(ctx,`${(annualRate*100).toLocaleString('pt-BR',{maximumFractionDigits:1})}% a.a.`,lx+45,548,190,{size:14,color:WHITE,bold:annualRate===d.annualReturn});});
    const cardY=595,cardW=460;[[55,'RECOMENDAÇÃO ALOCAÇÃO VS PATRIMÔNIO TOTAL',d.total?d.annualPremium/d.total*100:0],[570,'RECOMENDAÇÃO ALOCAÇÃO VS PATRIMÔNIO LÍQUIDO',d.financial?d.annualPremium/d.financial*100:0]].forEach(([x,label,val])=>{rect(ctx,x,cardY,cardW,240,'#03143d');text(ctx,label,x+25,640,cardW-50,{size:18,color:GOLD,bold:true,align:'center',maxLines:2});fitText(ctx,pct(val),x+80,760,cardW-160,{size:47,min:30,color:WHITE,bold:true,align:'center'});});
    rect(ctx,1085,cardY,445,240,'#03143d');text(ctx,'PERFIL DE SAÚDE',1110,640,395,{size:19,color:GOLD,bold:true,align:'center'});fitText(ctx,d.health||'A preencher',1120,760,375,{size:34,min:21,color:WHITE,bold:true,align:'center'});
    return pngBytes(canvas);
  }
  async function slide14(d){
    const {canvas,ctx}=await canvasFor(14);
    const card=ctx.createLinearGradient(295,0,1340,0);card.addColorStop(0,'#03143d');card.addColorStop(.72,'#04183f');card.addColorStop(1,'#061b43');
    rect(ctx,295,315,1045,315,card,24,'rgba(197,160,91,.72)',2);
    text(ctx,'SEU CONSULTOR',430,354,820,{size:15,color:GOLD,bold:true,font:'Georgia'});
    fitText(ctx,d.consultantData.name,430,405,825,{size:37,min:26,color:WHITE,bold:false,font:'Georgia'});
    line(ctx,430,447,1255,447,'rgba(197,160,91,.55)',1);
    text(ctx,'E-MAIL',430,478,160,{size:14,color:GOLD,bold:true});fitText(ctx,d.consultantData.email,430,515,820,{size:30,min:22,color:WHITE,bold:true});
    text(ctx,'TELEFONE',430,563,160,{size:14,color:GOLD,bold:true});fitText(ctx,d.consultantData.phone,430,600,520,{size:30,min:23,color:WHITE,bold:true});
    return pngBytes(canvas);
  }

  const fullSlidePic=()=>`<p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr><p:pic><p:nvPicPr><p:cNvPr id="2" name="Slide personalizado"/><p:cNvPicPr/><p:nvPr/></p:nvPicPr><p:blipFill><a:blip r:embed="rId999"/><a:stretch><a:fillRect/></a:stretch></p:blipFill><p:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="12192000" cy="6858000"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></p:spPr></p:pic></p:spTree>`;
  async function replaceSlide(zip,no,bytes){
    const xmlPath=`ppt/slides/slide${no}.xml`,relsPath=`ppt/slides/_rels/slide${no}.xml.rels`,mediaPath=`ppt/media/custom-slide${no}.png`;
    let xml=await zip.file(xmlPath).async('string');xml=xml.replace(/<p:spTree\b[^>]*>[\s\S]*?<\/p:spTree>/,fullSlidePic()).replace(/<p:timing\b[^>]*>[\s\S]*?<\/p:timing>/g,'');
    let rels=await zip.file(relsPath).async('string');rels=rels.replace('</Relationships>',`<Relationship Id="rId999" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="../media/custom-slide${no}.png"/></Relationships>`);
    zip.file(xmlPath,xml);zip.file(relsPath,rels);zip.file(mediaPath,bytes);
  }
  async function removeDuplicateWlSlide(zip){
    const relPath='ppt/_rels/presentation.xml.rels';let rels=await zip.file(relPath).async('string');const match=rels.match(/<Relationship\b(?=[^>]*\bTarget="slides\/slide12\.xml")(?=[^>]*\bId="([^"]+)")[^>]*\/>/i)||rels.match(/<Relationship\b(?=[^>]*\bId="([^"]+)")(?=[^>]*\bTarget="slides\/slide12\.xml")[^>]*\/>/i);if(!match)return;
    const rid=match[1];let presentation=await zip.file('ppt/presentation.xml').async('string');presentation=presentation.replace(new RegExp(`<p:sldId\\b[^>]*r:id="${rid}"[^>]*/>`),'');zip.file('ppt/presentation.xml',presentation);
  }
  async function applyTransitionsToAllSlides(zip){
    const transition='<p:transition spd="med" advClick="1"><p:fade/></p:transition>';
    const files=Object.keys(zip.files).filter(name=>/^ppt\/slides\/slide\d+\.xml$/.test(name));
    for(const name of files){
      let xml=await zip.file(name).async('string');
      xml=xml.replace(/<p:transition\b[^>]*\/>/g,'').replace(/<p:transition\b[^>]*>[\s\S]*?<\/p:transition>/g,'');
      xml=xml.includes('</p:clrMapOvr>')?xml.replace('</p:clrMapOvr>',`</p:clrMapOvr>${transition}`):xml.replace('</p:cSld>',`</p:cSld>${transition}`);
      zip.file(name,xml);
    }
  }
  window.buildTemplatePpt=async d=>{
    if(!window.JSZip)throw new Error('A biblioteca JSZip não foi carregada.');
    const response=await fetch('assets/modelo-base.pptx');if(!response.ok)throw new Error('O arquivo-modelo do PowerPoint não foi encontrado.');
    const zip=await JSZip.loadAsync(await response.arrayBuffer());
    const rendered=await Promise.all([[1,slide1(d)],[2,staticSlide(2)],[3,staticSlide(3)],[4,staticSlide(4)],[5,staticSlide(5)],[6,slide6(d)],[7,staticSlide(7)],[8,assetSlide(8,d,'current')],[9,assetSlide(9,d,'reallocation')],[10,assetSlide(10,d,'with')],[11,slide11(d)],[13,slide13(d)],[14,slide14(d)]].map(async([no,promise])=>[no,await promise]));
    for(const [no,bytes] of rendered)await replaceSlide(zip,no,bytes);
    await removeDuplicateWlSlide(zip);
    await applyTransitionsToAllSlides(zip);
    return zip.generateAsync({type:'blob',compression:'DEFLATE'});
  };
})();
