(() => {
  const W=1600,H=900,EMU=7620,NAVY='#020e38',PANEL='#061743',GOLD='#c5a05b',GOLD2='#d5a800',WHITE='#f4f5f8',MUTED='#c6cfdf',GREEN='#70b544',RED='#ff4848',BLUE='#294878';
  const imageCache=new Map();
  const brl=value=>new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL',minimumFractionDigits:2,maximumFractionDigits:2}).format(Number(value)||0);
  const pct=value=>`${(Number(value)||0).toLocaleString('pt-BR',{maximumFractionDigits:2})}%`;
  function gaugeProfile(title=''){
    const proposed=String(title).toLocaleLowerCase('pt-BR').includes('proposta');
    return proposed?{key:'financial',label:'Ativos financeiros',optimalStart:3,optimalEnd:6}:{key:'total',label:'Patrimônio total',optimalStart:1,optimalEnd:3,highExposureStart:6};
  }
  // Keep the benchmark markers legible while mapping each percentage to a stable dial angle.
  const gaugeScale=[[0,0],[3,80],[6,140],[10,180]];
  function gaugeAngle(value){const number=Math.max(0,Math.min(10,Number(value)||0));for(let i=1;i<gaugeScale.length;i++){const [to,toAngle]=gaugeScale[i],[from,fromAngle]=gaugeScale[i-1];if(number<=to)return fromAngle+(number-from)*(toAngle-fromAngle)/(to-from);}return 180;}
  function gaugePoint(value,rx=215,ry=190){const angle=Math.PI+gaugeAngle(value)*Math.PI/180;return {x:296+Math.cos(angle)*rx,y:370+Math.sin(angle)*ry};}
  function gaugeNeedlePoints(value){const pivot={x:246,y:349},tip=gaugePoint(value,200,170),dx=tip.x-pivot.x,dy=tip.y-pivot.y,length=Math.hypot(dx,dy)||1,ux=dx/length,uy=dy/length,nx=-uy,ny=ux,bx=pivot.x-ux*12,by=pivot.y-uy*12;return [tip,{x:bx+nx*16,y:by+ny*16},{x:bx-nx*16,y:by-ny*16}];}
  function gaugeFrame(x,y,w,h){const scale=Math.min(w/520,(h-30)/265),left=x+(w-520*scale)/2-40*scale,top=y+30-120*scale;return {scale,left,top,map:p=>({x:left+p.x*scale,y:top+p.y*scale})};}
  function gaugeBandPoints(){const points=[];for(let i=0;i<=64;i++){const a=Math.PI+Math.PI*i/64;points.push({x:296+215*Math.cos(a),y:370+190*Math.sin(a)});}points.push({x:402,y:370});const cubic=(start,c1,c2,end)=>{for(let i=1;i<=32;i++){const t=i/32,u=1-t;points.push({x:u*u*u*start.x+3*u*u*t*c1.x+3*u*t*t*c2.x+t*t*t*end.x,y:u*u*u*start.y+3*u*u*t*c1.y+3*u*t*t*c2.y+t*t*t*end.y});}};cubic({x:402,y:370},{x:370,y:305},{x:318,y:272},{x:260,y:272});cubic({x:260,y:272},{x:180,y:272},{x:108,y:317},{x:81,y:370});return points;}
  const esc=value=>String(value).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  const clientLabel=d=>d.name;

  function loadImage(url){
    if(imageCache.has(url))return imageCache.get(url);
    const promise=new Promise((resolve,reject)=>{const img=new Image();img.onload=()=>resolve(img);img.onerror=()=>reject(new Error(`Não foi possível carregar ${url}`));img.src=url;});
    imageCache.set(url,promise);return promise;
  }
  async function canvasFor(slide){const canvas=document.createElement('canvas');canvas.width=W;canvas.height=H;const ctx=canvas.getContext('2d');const asset=slide===5?'assets/template-slides/slide5-only-top-v7.jpg':`assets/template-slides/slide${slide}.jpg?v=5`;ctx.drawImage(await loadImage(asset),0,0,W,H);return {canvas,ctx};}
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
  function donutPercentText(ctx,value,x,y,w,{size=17,color=WHITE,align='center'}={}){
    ctx.save();ctx.shadowColor='rgba(2,14,56,.95)';ctx.shadowBlur=5;ctx.shadowOffsetY=1;text(ctx,value,x,y,w,{size,color,bold:true,align});ctx.restore();
  }
  function line(ctx,x1,y1,x2,y2,color='#24406e',lw=1,dash=[]){ctx.save();ctx.strokeStyle=color;ctx.lineWidth=lw;ctx.setLineDash(dash);ctx.beginPath();ctx.moveTo(x1,y1);ctx.lineTo(x2,y2);ctx.stroke();ctx.restore();}
  function downArrow(ctx,cx,cy){const x=cx-6,y=cy-7;ctx.save();ctx.fillStyle='#d1aa4d';ctx.beginPath();ctx.moveTo(x+4,y);ctx.lineTo(x+8,y);ctx.lineTo(x+8,y+7);ctx.lineTo(x+12,y+7);ctx.lineTo(x+6,y+14);ctx.lineTo(x,y+7);ctx.lineTo(x+4,y+7);ctx.closePath();ctx.fill();ctx.restore();}
  function donut(ctx,cx,cy,r,inner,values,colors,{highlightIndex=-1,minHighlightShare=.03}={}){
    const safeValues=values.map(v=>Math.max(0,Number(v)||0));
    const total=safeValues.reduce((a,b)=>a+b,0)||1;
    const actualShares=safeValues.map(v=>v/total);
    const displayShares=[...actualShares];
    if(highlightIndex>=0&&displayShares[highlightIndex]>0&&displayShares[highlightIndex]<minHighlightShare){
      const delta=minHighlightShare-displayShares[highlightIndex];
      const donor=displayShares.reduce((best,share,index)=>index!==highlightIndex&&share>displayShares[best] ? index : best,highlightIndex===0?1:0);
      if(donor>=0&&displayShares[donor]>delta){displayShares[highlightIndex]=minHighlightShare;displayShares[donor]-=delta;}
    }
    let angle=-Math.PI/2;
    displayShares.forEach((share,i)=>{
      if(share<=0)return;
      const next=angle+Math.PI*2*share;
      const mid=(angle+next)/2;
      const emphasized=i===highlightIndex;
      const offset=emphasized?9:0;
      const ox=Math.cos(mid)*offset,oy=Math.sin(mid)*offset;
      ctx.save();
      ctx.beginPath();
      ctx.arc(cx+ox,cy+oy,r+(emphasized?9:0),angle,next);
      ctx.arc(cx+ox,cy+oy,inner-(emphasized?4:0),next,angle,true);
      ctx.closePath();
      ctx.fillStyle=colors[i];ctx.fill();
      if(emphasized){ctx.strokeStyle='#e1f5d5';ctx.lineWidth=4;ctx.stroke();}
      ctx.restore();
      const label=pct(actualShares[i]*100);
      if(actualShares[i]>=.075){
        const rr=(r+inner)/2;
        const lx=cx+Math.cos(mid)*rr,ly=cy+Math.sin(mid)*rr;
        donutPercentText(ctx,label,lx-42,ly,84,{size:17});
      }else{
        const sx=cx+Math.cos(mid)*(r+8),sy=cy+Math.sin(mid)*(r+8);
        let ex=cx+Math.cos(mid)*(r+29),ey=cy+Math.sin(mid)*(r+29),right=Math.cos(mid)>=0;
        if(emphasized){const elbowX=cx+12,elbowY=cy-r-18;ex=cx+62;ey=cy-r-28;right=true;line(ctx,sx,sy,elbowX,elbowY,GREEN,2);line(ctx,elbowX,elbowY,ex,ey,GREEN,2);}
        else line(ctx,sx,sy,ex,ey,'rgba(213,220,237,.72)',1.5);
        const tx=right?ex+7:ex-87;
        donutPercentText(ctx,label,tx,ey,80,{size:emphasized?18:15,color:emphasized?GREEN:WHITE,align:right?'left':'right'});
      }
      angle=next;
    });
    return {actualShares,displayShares};
  }
  async function pngBytes(canvas){const blob=await new Promise((resolve,reject)=>canvas.toBlob(b=>b?resolve(b):reject(new Error('Falha ao criar a imagem do slide.')),'image/png'));return new Uint8Array(await blob.arrayBuffer());}
  async function pngToJpegBytes(bytes){
    const bitmap=await createImageBitmap(new Blob([bytes],{type:'image/png'}));
    try{const canvas=document.createElement('canvas');canvas.width=W;canvas.height=H;const ctx=canvas.getContext('2d');ctx.drawImage(bitmap,0,0,W,H);const blob=await new Promise((resolve,reject)=>canvas.toBlob(b=>b?resolve(b):reject(new Error('Falha ao compactar uma página do PDF.')),'image/jpeg',.94));return new Uint8Array(await blob.arrayBuffer());}
    finally{bitmap.close();}
  }
  async function staticSlide(no){const {canvas}=await canvasFor(no);return pngBytes(canvas);}

  async function planningStage0(){
    const {canvas,ctx}=await canvasFor(2);
    const base=document.createElement('canvas');base.width=W;base.height=H;base.getContext('2d').drawImage(canvas,0,0);
    // Mantém o cabeçalho do modelo e abre a sequência apenas com Gestão de Ativos.
    ctx.save();ctx.globalAlpha=.9;ctx.fillStyle=NAVY;ctx.fillRect(180,180,1240,675);ctx.restore();
    // Hexágono central e a face GA, no mesmo enquadramento do slide completo.
    const center=[[785,416],[878,470],[878,579],[785,633],[692,579],[692,470]];
    const ga=[[878,470],[985,416],[985,632],[878,579]];
    const poly=(points,fill)=>{ctx.save();ctx.beginPath();points.forEach(([x,y],i)=>i?ctx.lineTo(x,y):ctx.moveTo(x,y));ctx.closePath();ctx.fillStyle=fill;ctx.fill();ctx.strokeStyle=WHITE;ctx.lineWidth=2;ctx.stroke();ctx.restore();};
    poly(center,'#061743');poly(ga,'#383740');
    // Reaproveita a marca dourada do próprio modelo no hexágono central.
    ctx.drawImage(base,748,488,75,48,738,494,105,67);
    text(ctx,'GA',895,526,76,{size:54,color:WHITE,bold:true,align:'center'});
    text(ctx,'Gestão\nDe Ativos',1080,520,280,{size:34,color:WHITE,align:'center',maxLines:2});
    line(ctx,1040,386,1375,386,GOLD,2);line(ctx,1040,656,1375,656,GOLD,2);
    line(ctx,275,386,555,386,GOLD,2);line(ctx,275,656,555,656,GOLD,2);
    return pngBytes(canvas);
  }

  async function slide1(d){
    const {canvas,ctx}=await canvasFor(1);
    // A arte-base já contém o fundo, os logotipos e a tipografia do modelo aprovado.
    // Apenas o sobrenome é substituído para manter o nome da família dinâmico.
    // Limpa o sobrenome fixo do modelo com uma faixa azul-marinho lisa e
    // suavemente integrada ao fundo, sem a mancha borrada da textura anterior.
    const cleanBand=ctx.createLinearGradient(0,716,0,794);cleanBand.addColorStop(0,'rgba(2,14,56,0)');cleanBand.addColorStop(.2,'rgba(2,14,56,1)');cleanBand.addColorStop(.8,'rgba(2,14,56,1)');cleanBand.addColorStop(1,'rgba(2,14,56,0)');ctx.fillStyle=cleanBand;ctx.fillRect(0,716,W,78);
    const surname=(d.lastName||d.firstName||'Cliente').trim().toLocaleUpperCase('pt-BR');
    const surnameWidth=520,surnameX=(W-surnameWidth)/2;fitText(ctx,`- ${surname} -`,surnameX,752,surnameWidth,{size:34,min:20,color:GOLD,bold:false,align:'center',font:'Georgia'});
    return pngBytes(canvas);
  }

  async function slide6(d,stage=3){
    const {canvas,ctx}=await canvasFor(6);
    studyTag(ctx,d);
    rect(ctx,31,198,835,626,'#03143d',20,'#9d7624',2);
    text(ctx,'MAPEAMENTO DE ATIVOS INVENTARIÁVEIS',52,262,760,{size:21,color:GOLD,bold:true});
    const values=[['Posição em investimentos (XP)',d.xp],['Posição em outras instituições',d.other],['Bens imóveis e ativos físicos',d.realEstate],['Participações societárias/Holdings',d.holdings],['Previdência Privada (Isenta de inventário)',-d.pension]];
    values.forEach(([label,v],i)=>{const y=318+i*79,color=i===4?GREEN:MUTED;text(ctx,label,52,y,485,{size:23,color});fitText(ctx,`${v<0?'-':''}${brl(Math.abs(v))}`,548,y,285,{size:27,min:18,color,bold:true,align:'right'});line(ctx,65,y+34,820,y+34,'#1d3766',1);});
    line(ctx,65,700,820,700,'#9d7624',1);
    text(ctx,'TOTAL INVENTARIÁVEL',52,730,390,{size:19,color:MUTED,bold:true});fitText(ctx,brl(d.inventoriable),455,730,378,{size:27,min:18,color:MUTED,bold:true,align:'right'});
    line(ctx,65,756,820,756,'#1d3766',1);
    text(ctx,'CAPITAL TOTAL DO CLIENTE',52,794,390,{size:21,color:WHITE,bold:true});fitText(ctx,brl(d.total),455,794,378,{size:31,min:20,color:GOLD,bold:true,align:'right'});

    rect(ctx,882,198,686,390,'#2b102d',20,RED,2);
    text(ctx,'ENCARGOS DA SUCESSÃO',914,247,430,{size:21,color:WHITE,bold:true});
    ['ITCMD | 2% à 8%','Honorários (Tabela OAB) | 6% à 8%','Custas processuais | 1%','Cartório | 1%'].forEach((label,i)=>text(ctx,label,914,305+i*37,410,{size:20,color:'#e3dce6'}));
    line(ctx,1336,302,1336,430,'#63203d',1);fitText(ctx,'15% - 20%',1345,365,205,{size:54,min:28,color:RED,bold:true,align:'center'});
    line(ctx,914,450,1538,450,'#63203d',1);text(ctx,'EROSÃO PATRIMONIAL ESTIMADA',940,486,570,{size:22,color:RED,bold:true,align:'center'});fitText(ctx,`-${brl(d.liability)}`,930,540,590,{size:40,min:27,color:RED,bold:true,align:'center'});

    rect(ctx,882,610,686,214,'#c3a067',20,'#9d7624',2);
    text(ctx,'PATRIMÔNIO LÍQUIDO TRANSMITIDO',960,654,530,{size:20,color:WHITE,bold:true,align:'center'});fitText(ctx,brl(d.withoutInsurance),950,716,550,{size:39,min:26,color:'#061743',bold:true,align:'center'});line(ctx,1015,758,1435,758,'#b27f52',1);text(ctx,'A família receberá menos patrimônio',955,790,540,{size:20,color:WHITE,bold:true,align:'center'});
    if(stage<3){
      const complete=document.createElement('canvas');complete.width=W;complete.height=H;complete.getContext('2d').drawImage(canvas,0,0);
      const backdrop=ctx.createLinearGradient(0,180,0,826);backdrop.addColorStop(0,'#03103a');backdrop.addColorStop(1,'#010a2d');
      ctx.fillStyle=backdrop;ctx.fillRect(0,181,W,645);
      ctx.save();ctx.strokeStyle='rgba(41,72,120,.16)';ctx.lineWidth=1;
      for(let x=-900;x<2400;x+=172){ctx.beginPath();ctx.moveTo(x,181);ctx.lineTo(x+645,826);ctx.stroke();ctx.beginPath();ctx.moveTo(x+645,181);ctx.lineTo(x,826);ctx.stroke();}ctx.restore();
      const panels=[[881,197,688,392],[881,609,688,216],[30,197,837,628]];
      panels.slice(0,stage).forEach(([x,y,w,h])=>ctx.drawImage(complete,x,y,w,h,x,y,w,h));
    }
    return pngBytes(canvas);
  }

  function legend(ctx,items,x,y,gap=44){items.forEach((it,i)=>{rect(ctx,x,y+i*gap-7,12,12,it.color);text(ctx,it.label,x+20,y+i*gap,250,{size:17,color:it.textColor||((it.color===GREEN)?GREEN:WHITE),bold:Boolean(it.bold||it.color===GREEN)});});}
  function stackedBar(ctx,d,x,y,w,h,withInsurance=false,reallocation=false){
    const financial=Math.max(0,d.financial-(reallocation?d.annualPremium:0));
    const pieces=[{label:'Ativos financeiros',value:financial,color:GOLD},{label:'Patrimônio imobilizado',value:d.illiquid,color:BLUE}];
    if(withInsurance)pieces.unshift({label:'Seguro de vida',value:d.coverageAfter,color:GREEN});
    if(reallocation){
      const reserveValue=Math.max(0,d.annualPremium),gap=10,reserveH=reserveValue>0?Math.max(10,Math.min(22,h*reserveValue/Math.max(d.total,1))):0;
      const mainH=h-reserveH-(reserveH?gap*2:0),mainTotal=Math.max(1,financial+d.illiquid);
      const mainPieces=[{value:financial,color:GOLD},{value:d.illiquid,color:BLUE}];
      let cursor=y+mainH;
      mainPieces.forEach((piece,index)=>{const ph=piece.value>0?mainH*piece.value/mainTotal:0;if(!ph)return;cursor-=ph;rect(ctx,x,cursor,w,ph,piece.color,index===mainPieces.length-1?[12,12,0,0]:0);if(ph>=32)fitText(ctx,brl(piece.value),x+8,cursor+ph/2,w-16,{size:17,min:11,color:WHITE,bold:true,align:'center'});});
      if(reserveH){const reserveY=y+mainH+gap;rect(ctx,x,reserveY,w,reserveH,GREEN,3,'#d7efc8',1);}
      const baseline=y+h;line(ctx,x-155,baseline,x-14,baseline,'#8795af',2,[10,8]);line(ctx,x+w+14,baseline,x+w+155,baseline,'#8795af',2,[10,8]);
      const costY=baseline+10,costH=Math.max(34,h*d.liability/Math.max(d.total,1));rect(ctx,x,costY,w,costH,RED,[0,0,12,12]);fitText(ctx,`-${brl(d.liability)}`,x+6,costY+costH/2,w-12,{size:16,min:11,color:WHITE,bold:true,align:'center'});return;
    }
    const max=Math.max(1,pieces.reduce((a,b)=>a+Math.max(0,b.value),0));
    const heights=pieces.map(piece=>piece.value>0?h*piece.value/max:0);
    const visible=pieces.map((piece,index)=>({piece,height:heights[index]})).filter(item=>item.height>0);
    let cursor=y+h;
    visible.forEach((item,visibleIndex)=>{
      const {piece,height:ph}=item;cursor-=ph;
      rect(ctx,x,cursor,w,ph,piece.color,visibleIndex===visible.length-1?[12,12,0,0]:0);
      if(ph>=32)fitText(ctx,brl(piece.value),x+8,cursor+ph/2,w-16,{size:17,min:11,color:WHITE,bold:true,align:'center'});
    });
    const baseline=y+h;
    line(ctx,x-155,baseline,x-14,baseline,'#8795af',2,[10,8]);
    line(ctx,x+w+14,baseline,x+w+155,baseline,'#8795af',2,[10,8]);
    const costY=baseline+10,costH=Math.max(34,h*d.liability/Math.max(d.total,1));
    rect(ctx,x,costY,w,costH,withInsurance?'#bfc2c8':RED,[0,0,12,12]);
    fitText(ctx,`-${brl(d.liability)}`,x+6,costY+costH/2,w-12,{size:16,min:11,color:WHITE,bold:true,align:'center'});
  }
  async function assetSlide(slide,d,type,stage=4){
    const {canvas,ctx}=await canvasFor(slide);const withInsurance=type==='with';const reallocation=type==='reallocation';studyTag(ctx,d);
    rect(ctx,70,230,700,374,'#03143d');rect(ctx,825,230,720,570,'#03143d');
    if(withInsurance){rect(ctx,56,620,732,70,'#173c32',14,'#d6dfeb',2);rect(ctx,56,700,732,124,'#03143d',14,'#9d7624',2);}
    else if(reallocation){rect(ctx,56,620,732,70,'#03143d',14,GREEN,2);rect(ctx,56,700,732,124,'#03143d',14,'#9d7624',2);}
    else rect(ctx,56,630,732,144,'#03143d',14,'#9d7624',2);
    const vals=withInsurance?[d.xp,d.other,d.pension,d.coverageAfter]:reallocation?[Math.max(0,d.xp-d.annualPremium),d.other,d.pension,d.annualPremium]:[d.xp,d.other,d.pension];
    const colors=withInsurance?[GOLD2,GOLD,'#ffbf00',GREEN]:reallocation?[GOLD2,GOLD,'#ffbf00',GREEN]:[GOLD2,GOLD,'#ffbf00'];
    donut(ctx,250,405,130,62,vals,colors,{highlightIndex:(reallocation||withInsurance)?3:-1,minHighlightShare:.045});
    const donutBrand=await loadImage('assets/marca.png');ctx.drawImage(donutBrand,214,391,72,28);
    const items=[{label:'Posição em investimentos (XP)',color:GOLD2},{label:'Posição em outras instituições',color:GOLD},{label:'Previdência Privada',color:'#ffbf00'}];
    if(withInsurance)items.push({label:'Seguro de vida',color:GREEN});if(reallocation)items.push({label:'Reserva lastreada',color:GREEN,bold:true});legend(ctx,items,420,335,55);
    const breakdownRows=withInsurance?[
      ['Seguro de vida',d.coverageAfter,{color:GREEN,labelSize:28.5,valueSize:28.5,labelBold:true}],
      ['Ativos financeiros',d.financial,{}],
      ['Patrimônio imobilizado',d.illiquid,{}]
    ]:reallocation?[
      ['Reserva lastreada',d.annualPremium,{color:GREEN,labelSize:27,valueSize:28.5,labelBold:true}],
      ['Ativos financeiros',Math.max(0,d.financial-d.annualPremium),{}],
      ['Patrimônio imobilizado',d.illiquid,{}]
    ]:[
      ['Ativos financeiros',d.financial,{valueSize:28.5}],
      ['Patrimônio imobilizado',d.illiquid,{valueSize:28.5}]
    ];
    const breakdownY=breakdownRows.length===3
      ?[655,...justifiedRowCenters(700,824,2)]
      :justifiedRowCenters(630,774,2);
    breakdownRows.forEach(([label,value,options],index)=>assetBreakdownRow(ctx,label,value,breakdownY[index],options));
    stackedBar(ctx,d,980,285,195,415,withInsurance,reallocation);
    const barLegend=withInsurance?[{label:'Passivo sucessório',color:'#bfc2c8',textColor:RED,bold:true},{label:'Patrimônio imobilizado',color:BLUE},{label:'Ativos financeiros',color:GOLD},{label:'Seguro de vida',color:GREEN,bold:true}]:reallocation?[{label:'Passivo sucessório',color:RED,textColor:RED,bold:true},{label:'Patrimônio imobilizado',color:BLUE},{label:'Ativos financeiros',color:GOLD},{label:'Reserva lastreada',color:GREEN,bold:true}]:[{label:'PASSIVO SUCESSÓRIO',color:RED,textColor:RED,bold:true},{label:'Patrimônio imobilizado',color:BLUE},{label:'Ativos financeiros',color:GOLD}];
    legend(ctx,barLegend,1250,480,38);
    const panels=slide===8
      ?[[808,180,760,647],[50,180,740,429],[50,628,740,148]]
      :[[808,180,760,647],[50,180,740,428],[50,618,740,74],[50,698,740,129]];
    if(stage<panels.length){
      const complete=document.createElement('canvas');complete.width=W;complete.height=H;complete.getContext('2d').drawImage(canvas,0,0);
      const backdrop=ctx.createLinearGradient(0,180,0,827);backdrop.addColorStop(0,'#03103a');backdrop.addColorStop(1,'#010a2d');
      ctx.fillStyle=backdrop;ctx.fillRect(0,180,W,647);
      ctx.save();ctx.strokeStyle='rgba(41,72,120,.16)';ctx.lineWidth=1;
      for(let x=-900;x<2400;x+=172){ctx.beginPath();ctx.moveTo(x,180);ctx.lineTo(x+647,827);ctx.stroke();ctx.beginPath();ctx.moveTo(x+647,180);ctx.lineTo(x,827);ctx.stroke();}ctx.restore();
      panels.slice(0,stage).forEach(([x,y,w,h])=>ctx.drawImage(complete,x,y,w,h,x,y,w,h));
    }
    return pngBytes(canvas);
  }

  function assetBreakdownRow(ctx,label,value,y,{color='#e3eaf5',labelSize=27,valueSize=27,labelBold=false}={}){
    text(ctx,label,75,y,340,{size:labelSize,color,bold:labelBold,align:'left'});
    fitText(ctx,brl(value),435,y,340,{size:valueSize,min:17,color,bold:true,align:'left'});
  }
  function justifiedRowCenters(top,bottom,count,rowHeight=32){
    const gap=(bottom-top-count*rowHeight)/(count+1);
    return Array.from({length:count},(_,index)=>top+gap*(index+1)+rowHeight*(index+.5));
  }
  function projection(d){
    const rate=d.ipca/100;
    return Array.from({length:d.projectionYears},(_,year)=>{const yearNumber=year+1;let accumulated=0;for(let i=0;i<Math.min(yearNumber,10);i++)accumulated+=d.annualPremium*Math.pow(1+rate,i);const surrender=Number(d.surrenderValues?.[year])||0,ipcaFactor=Math.pow(1+rate,yearNumber),surrenderCorrected=surrender*ipcaFactor;return{year:yearNumber,age:d.age===null?null:d.age+yearNumber,capital:d.coverageGap*ipcaFactor,premium:yearNumber<=10?d.annualPremium*Math.pow(1+rate,yearNumber-1):0,accumulated:yearNumber<=10?accumulated:0,surrender,surrenderCorrected};});
  }
  function infoIcon(ctx,cx,cy){
    ctx.save();ctx.beginPath();ctx.arc(cx,cy,15,0,Math.PI*2);ctx.fillStyle=GOLD;ctx.fill();ctx.strokeStyle=WHITE;ctx.lineWidth=2;ctx.stroke();ctx.restore();
    text(ctx,'i',cx-13,cy+1,26,{size:20,color:NAVY,bold:true,align:'center',font:'Georgia'});
  }
  function benefitPanel(ctx,x,y,w,h,title,lines,active,{infoIcons=false}={}){
    rect(ctx,x,y,w,h,'#03143d',12,active?'#9d7624':'#26375f',2);
    text(ctx,title,x+18,y+28,w-36,{size:17,color:active?GOLD:'#63718f',bold:true,align:'center'});
    if(!active)return;
    const start=y+74,gap=(h-86)/Math.max(lines.length,1);
    lines.forEach((label,index)=>{const cy=start+index*gap;fitText(ctx,label,x+24,cy,w-(infoIcons?92:48),{size:20,min:14,color:GREEN,bold:true,align:'center'});if(infoIcons)infoIcon(ctx,x+w-38,cy);});
  }
  function projectionFirstRowZoom(ctx,row,cols,top,rowH){
    if(!row)return;
    const x=46,y=top-4,w=1061,h=Math.max(52,rowH*1.7);
    ctx.save();ctx.shadowColor='rgba(0,0,0,.45)';ctx.shadowBlur=15;ctx.shadowOffsetY=5;
    rect(ctx,x,y,w,h,'#164c46',10,'#c8a04e',3);ctx.restore();
    const values=[row.age,brl(row.capital),brl(row.premium),brl(row.accumulated),brl(row.surrenderCorrected)];
    values.forEach((value,index)=>fitText(ctx,value,cols[index]+4,y+h/2,cols[index+1]-cols[index]-8,{size:index===0?22:23,min:13,color:WHITE,bold:true,align:'center'}));
  }
  async function slide11(d,stage=3){
    const {canvas,ctx}=await canvasFor(11),rows=projection(d);
    rect(ctx,30,70,1090,770,NAVY);rect(ctx,47,95,1060,46,'#ad8a3c',18);
    rect(ctx,1085,18,410,68,NAVY);fitText(ctx,clientLabel(d).toLocaleUpperCase('pt-BR'),1100,52,365,{size:18,min:10,color:WHITE,bold:true,align:'right'});
    rect(ctx,640,22,340,50,NAVY);fitText(ctx,`IPCA ${pct(d.ipca)} + 3% a.a.`,640,48,340,{size:24,min:16,color:WHITE,bold:true,align:'center'});
    const cols=[48,148,368,578,808,1105],heads=['IDADE','CAPITAL SEGURADO','APORTE ANUAL','APORTE ACUMULADO','RESGATE CORRIGIDO'];
    heads.forEach((head,i)=>text(ctx,head,cols[i],119,cols[i+1]-cols[i],{size:15,color:WHITE,bold:true,align:'center'}));
    const top=142,rowH=Math.min(31.4,627/Math.max(rows.length,1));
    const milestone10=Math.min(9,Math.max(0,rows.length-1));
    const activeRows=new Set();if(stage>=1)activeRows.add(0);if(stage>=2)activeRows.add(milestone10);if(stage>=3)activeRows.add(Math.max(0,rows.length-1));
    rows.forEach((r,i)=>{
      const y=top+i*rowH,active=activeRows.has(i);
      rect(ctx,48,y,1057,rowH,i%2?'#082350':'#061743');
      if(active)rect(ctx,48,y+1,1057,rowH-2,'rgba(39,91,73,.62)',7);
      const cell=[r.age,brl(r.capital),brl(r.premium),brl(r.accumulated),brl(r.surrenderCorrected)];
      cell.forEach((v,j)=>fitText(ctx,v,cols[j]+4,y+rowH/2,cols[j+1]-cols[j]-8,{size:active&&j>0?19:16,min:10,color:active&&(i===milestone10||i===rows.length-1)&&(j===1||j===4)?GREEN:WHITE,bold:active,align:'center'}));
    });
    if(stage>=3){
      const arrowCenters=[368,578,808];
      for(let i=10;i<Math.min(18,rows.length);i++){
        const ay=top+i*rowH+rowH/2;
        arrowCenters.forEach(ax=>downArrow(ctx,ax,ay));
      }
    }
    const footerY=top+rows.length*rowH;
    if(stage>=3){rect(ctx,48,footerY,1057,40,'#ad8a3c',0);text(ctx,'∞  Capital segurado e resgate seguem vitalícios  ∞',65,footerY+20,1025,{size:17,color:WHITE,align:'center',font:'Georgia'});}

    rect(ctx,1128,88,432,758,NAVY);
    benefitPanel(ctx,1148,94,405,204,'BENEFÍCIOS SECURITÁRIOS',['AGRAVAMENTO DO RISCO','CONGELAMENTO DE IDADE'],stage>=1);
    benefitPanel(ctx,1148,310,405,278,'BENEFÍCIOS FINANCEIROS E TRIBUTÁRIOS',['ALAVANCAGEM','ISENÇÃO DE IMPOSTOS*','QUITAÇÃO NO 10º ANO','SEM NECESSIDADE DE NOVOS APORTES'],stage>=2);
    benefitPanel(ctx,1148,600,405,242,'BENEFÍCIOS LEGAIS',['Proteção do crédito','Impenhorabilidade','Congelamento de Risco','Incomunicabilidade'],stage>=3,{infoIcons:true});
    if(stage===1)projectionFirstRowZoom(ctx,rows[0],cols,top,rowH);
    return pngBytes(canvas);
  }

  function studyTag(ctx,d){
    const x=1095,y=14,w=460,h=44,pad=18;
    const label=`${d.studyLabel||'Estudo individual'} · ${d.name}`.toLocaleUpperCase('pt-BR');
    // Alguns fundos do modelo ainda carregam o selo anterior como imagem.
    // Limpa toda a faixa antes de redesenhar para evitar resíduos entre etapas.
    rect(ctx,x-12,0,w+24,72,NAVY);
    rect(ctx,x,y,w,h,'rgba(3,20,61,.92)',9,'#9d7624',2);
    let size=14;
    ctx.save();
    do{
      ctx.font=`700 ${size}px Arial`;
      if(ctx.measureText(label).width<=w-pad*2)break;
      size-=.5;
    }while(size>8);
    ctx.fillStyle=GOLD;
    ctx.textAlign='center';
    ctx.textBaseline='middle';
    ctx.fillText(label,x+w/2,y+h/2,w-pad*2);
    ctx.restore();
  }
  async function slide7(d){
    const {canvas,ctx}=await canvasFor(7);
    rect(ctx,88,246,740,126,NAVY);
    fitText(ctx,'GERAR LIQUIDEZ',94,315,755,{size:102,min:64,color:GOLD,bold:true});
    studyTag(ctx,d);return pngBytes(canvas);
  }

  function gauge(ctx,x,y,w,h,title,value){
    const profile=gaugeProfile(title),frame=gaugeFrame(x,y,w,h),background=ctx.createLinearGradient(x,y,x,y+h);background.addColorStop(0,'#001740');background.addColorStop(1,'#001233');rect(ctx,x,y,w,h,background);
    text(ctx,title,x+24,y+15,w-48,{size:15,color:'#d0ad75',bold:true,align:'center'});
    ctx.save();ctx.translate(frame.left,frame.top);ctx.scale(frame.scale,frame.scale);
    ctx.beginPath();ctx.moveTo(81,370);ctx.ellipse(296,370,215,190,0,Math.PI,2*Math.PI);ctx.lineTo(402,370);ctx.bezierCurveTo(370,305,318,272,260,272);ctx.bezierCurveTo(180,272,108,317,81,370);ctx.closePath();ctx.fillStyle='#d0ad75';ctx.fill();
    const markers=[profile.optimalStart,profile.optimalEnd,...(profile.highExposureStart?[profile.highExposureStart]:[])];
    markers.forEach(mark=>{const outside=gaugePoint(mark);if(!(profile.key==='total'&&mark===profile.optimalStart)){const inside=mark===3?{x:260,y:272}:{x:381,y:328};line(ctx,inside.x,inside.y,outside.x,outside.y,'#001233',7);}text(ctx,`${mark}%`,outside.x-32,outside.y-25,64,{size:20,color:'#fff',bold:true,align:'center'});});
    const needle=gaugeNeedlePoints(value);ctx.beginPath();ctx.moveTo(needle[0].x,needle[0].y);ctx.lineTo(needle[1].x,needle[1].y);ctx.lineTo(needle[2].x,needle[2].y);ctx.closePath();ctx.fillStyle='#fff';ctx.fill();ctx.beginPath();ctx.arc(246,349,22,0,Math.PI*2);ctx.fill();ctx.beginPath();ctx.arc(246,349,9,0,Math.PI*2);ctx.fillStyle='#001233';ctx.fill();
    text(ctx,'Ótimo',profile.key==='total'?146:131,258,68,{size:15,color:'#001233',bold:true,align:'center'});
    text(ctx,'Recomendado',profile.key==='total'?292:250,239,116,{size:15,color:'#001233',bold:true,align:'center'});
    text(ctx,'Alta',413,296,70,{size:16,color:'#001233',bold:true,align:'center'});text(ctx,'Exposição',399,314,98,{size:16,color:'#001233',bold:true,align:'center'});
    rect(ctx,128,317,80,50,'#ffc971',25);fitText(ctx,pct(value),132,342,72,{size:18,min:13,color:'#001233',bold:true,align:'center'});
    text(ctx,'10%',526,370,62,{size:20,color:'#fff',bold:true});ctx.restore();
  }
  const monthsAtRate=(d,rate)=>d.financial>0&&d.annualPremium>0?Math.ceil(d.annualPremium/(d.financial*rate)):0;
  const monthsText=months=>months?`${months} ${months===1?'MÊS':'MESES'}`:'—';
  async function slide13(d,{includeGauge=true}={}){
    const {canvas,ctx}=await canvasFor(13);studyTag(ctx,d);rect(ctx,0,150,W,H-150,NAVY);rect(ctx,40,160,1520,420,'#03143d',14,'#9d7624',2);text(ctx,'CENÁRIO DE PAYBACK',75,188,300,{size:18,color:GOLD,bold:true});
    rect(ctx,500,171,300,58,'#bc985d',10);text(ctx,'Ativos financeiros',515,184,270,{size:14,color:WHITE,align:'center'});fitText(ctx,brl(d.financial),515,208,270,{size:28,min:19,color:WHITE,bold:true,align:'center'});
    const monthlyRates=[.006,.008,.01],colors=['#7d6a36','#b88700','#d6a700'];
    const x0=170,y0=500,x1=805,y1=245,max=Math.max(d.annualPremium*1.25,d.financial*.01*12,1);
    for(let i=0;i<=5;i++){const y=y0-(y0-y1)*i/5;line(ctx,x0,y,x1,y,'#1d3764',1);fitText(ctx,brl(max*i/5),55,y,100,{size:12,min:9,color:WHITE,bold:true,align:'right'});}
    for(let m=0;m<=12;m++){const x=x0+(x1-x0)*m/12;line(ctx,x,y0,x,y1,'#1d3764',1);text(ctx,`MÊS ${m}`,x-28,y0+24,56,{size:10,color:WHITE,bold:true,align:'center'});}
    monthlyRates.forEach((rate,i)=>{ctx.save();ctx.strokeStyle=colors[i];ctx.lineWidth=4;ctx.beginPath();for(let m=0;m<=12;m++){const x=x0+(x1-x0)*m/12,y=y0-(y0-y1)*(d.financial*rate*m/max);m?ctx.lineTo(x,y):ctx.moveTo(x,y);}ctx.stroke();ctx.restore();});
    const py=y0-(y0-y1)*(d.annualPremium/max);line(ctx,x0,py,x1,py,GREEN,4,[16,12]);fitText(ctx,brl(d.annualPremium),640,py-24,150,{size:19,min:14,color:WHITE,bold:true,align:'center'});
    monthlyRates.forEach((rate,i)=>{const month=monthsAtRate(d,rate);if(month<0||month>12)return;const mx=x0+(x1-x0)*month/12,my=y0-(y0-y1)*(d.financial*rate*month/max);text(ctx,'★',mx-18,my,36,{size:34,color:i===1?'#8bd05f':i===0?'#e9a2a5':'#f0c400',bold:true,align:'center'});});
    const legendItems=[{label:'Valor do seguro',color:GREEN,dash:true},...monthlyRates.map((rate,i)=>({label:`Rentabilidade ${(rate*100).toLocaleString('pt-BR',{maximumFractionDigits:1})}% a.m.`,color:colors[i]}))];
    legendItems.forEach((item,i)=>{const lx=95+i*185;line(ctx,lx,552,lx+25,552,item.color,3,item.dash?[10,7]:[]);text(ctx,item.label,lx+33,552,145,{size:11,color:WHITE,bold:item.dash});});
    rect(ctx,850,177,680,120,'#03143d',5,'#9d7624',2);text(ctx,'ALOCAÇÃO ANUAL',875,203,630,{size:18,color:GOLD,bold:true,align:'center'});fitText(ctx,brl(d.annualPremium),875,257,630,{size:44,min:30,color:'#8bd05f',bold:true,align:'center'});
    rect(ctx,850,318,680,66,'#03143d',5,'#9d7624',2);text(ctx,'RENDIMENTOS PAGAM A ALOCAÇÃO ANUAL EM',870,351,640,{size:18,color:GOLD,bold:true,align:'center'});
    const rateMonths=monthlyRates.map(rate=>monthsAtRate(d,rate));const starColors=['#e9a2a5','#8bd05f','#f0c400'];
    monthlyRates.forEach((rate,i)=>{const x=850+i*230;rect(ctx,x,408,210,100,i===1?'#173c32':'#03143d',5,i===1?GREEN:'#9d7624',2);text(ctx,'★',x+18,438,34,{size:30,color:starColors[i],bold:true});text(ctx,`${(rate*100).toLocaleString('pt-BR',{minimumFractionDigits:1,maximumFractionDigits:1})}% a.m.`,x+55,438,140,{size:18,color:i===1?GREEN:GOLD,bold:true});fitText(ctx,monthsText(rateMonths[i]),x+20,480,170,{size:28,min:20,color:i===1?GREEN:WHITE,bold:true,align:'center'});});
    const currentAllocation=d.total?d.annualPremium/d.total*100:0,proposedAllocation=d.financial?d.annualPremium/d.financial*100:0;
    if(includeGauge){
      gauge(ctx,40,600,490,275,'Alocação atual vs patrimônio total',currentAllocation);
      gauge(ctx,555,600,490,275,'Alocação proposta vs ativos financeiros',proposedAllocation);
    }
    rect(ctx,1070,600,490,275,'#03143d',12,'#9d7624',2);text(ctx,'PERFIL DE SAÚDE',1094,634,442,{size:21,color:GOLD,bold:true,align:'center'});text(ctx,'?',1110,738,410,{size:92,color:WHITE,bold:true,align:'center'});text(ctx,'A PREENCHER',1094,842,442,{size:17,color:MUTED,bold:true,align:'center'});
    return pngBytes(canvas);
  }
  async function slide14(d){
    const {canvas,ctx}=await canvasFor(14);
    const card=ctx.createLinearGradient(295,0,1340,0);card.addColorStop(0,'#03143d');card.addColorStop(.72,'#04183f');card.addColorStop(1,'#061b43');
    rect(ctx,295,315,1045,315,card,24,'rgba(197,160,91,.72)',2);
    text(ctx,'SEU CONSULTOR',295,354,1045,{size:15,color:GOLD,bold:true,font:'Georgia',align:'center'});
    fitText(ctx,d.consultantData.name,295,405,1045,{size:37,min:26,color:WHITE,bold:false,font:'Georgia',align:'center'});
    line(ctx,405,447,1230,447,'rgba(197,160,91,.55)',1);
    text(ctx,'E-MAIL',295,478,1045,{size:14,color:GOLD,bold:true,align:'center'});fitText(ctx,d.consultantData.email,295,515,1045,{size:30,min:22,color:WHITE,bold:true,align:'center'});
    text(ctx,'TELEFONE',295,563,1045,{size:14,color:GOLD,bold:true,align:'center'});fitText(ctx,d.consultantData.phone,295,600,1045,{size:30,min:23,color:WHITE,bold:true,align:'center'});
    return pngBytes(canvas);
  }

  const legalInfoSlides=[
    {key:'protecaoCredito',title:'Proteção do crédito',lead:'O crédito ao capital segurado não pode ser renunciado ou reduzido por negócio jurídico, salvo as exceções previstas na lei.',law:'Lei 15.040/2024 · art. 117'},
    {key:'impenhorabilidade',title:'Impenhorabilidade',lead:'Os capitais devidos por morte ou perda da integridade física são impenhoráveis.',law:'Lei 15.040/2024 · art. 122  |  CPC · art. 833, VI'},
    {key:'congelamentoRisco',title:'Congelamento de Risco',lead:'Nos seguros de vida e de integridade física, mesmo diante de agravamento relevante do risco, a seguradora só pode cobrar a diferença de prêmio.',law:'Lei 15.040/2024 · art. 17'},
    {key:'incomunicabilidade',title:'Incomunicabilidade',lead:'O capital segurado devido por morte não integra a herança e, portanto, não se submete à regra da legítima na partilha de bens. É direcionado diretamente aos beneficiários indicados.',law:'Lei 15.040/2024 · arts. 113 e 116'}
  ];
  function legalParagraph(ctx,value,x,top,width,{size,color=WHITE,bold=false}={}){
    ctx.save();ctx.fillStyle=color;ctx.textAlign='left';ctx.textBaseline='top';ctx.font=`${bold?'700':'400'} ${size}px Arial`;
    const lines=[],words=String(value).trim().split(/\s+/);let current=[];
    for(const word of words){const candidate=[...current,word];if(current.length&&ctx.measureText(candidate.join(' ')).width>width){lines.push(current);current=[word];}else current=candidate;}
    if(current.length)lines.push(current);
    const height=size+(lines.length-1)*size*1.5;
    if(top===null){ctx.restore();return height;}
    lines.forEach((line,index)=>{
      const y=top+index*size*1.5;
      if(index===lines.length-1||line.length===1){ctx.fillText(line.join(' '),x,y);return;}
      const wordWidths=line.map(word=>ctx.measureText(word).width),gap=(width-wordWidths.reduce((sum,n)=>sum+n,0))/(line.length-1);
      let cursor=x;line.forEach((word,i)=>{ctx.fillText(word,cursor,y);cursor+=wordWidths[i]+gap;});
    });
    ctx.restore();return height;
  }
  async function legalInfoSlide(){
    const {canvas,ctx}=await canvasFor(11);rect(ctx,0,0,W,H,NAVY);
    const brandMark=await loadImage('assets/marca.png');ctx.drawImage(brandMark,82,49,43,17);
    text(ctx,'GESTÃO DE RISCOS',143,58,440,{size:18,color:GOLD,bold:true,font:'Georgia'});
    text(ctx,'BENEFÍCIOS LEGAIS DO SEGURO DE VIDA',82,120,1180,{size:38,color:WHITE,bold:true});
    const rowTops=[150,278,406,534],rowHeight=116;
    legalInfoSlides.forEach((info,index)=>{
      const y=rowTops[index];rect(ctx,82,y,1436,rowHeight,'#061743',14,'#284878',2);
      fitText(ctx,info.title,112,y+31,270,{size:20,min:15,color:GOLD,bold:true});
      const leadHeight=legalParagraph(ctx,info.lead,440,null,1048,{size:17,bold:true});
      const lawHeight=legalParagraph(ctx,info.law,440,null,1048,{size:14,bold:true});
      const paragraphGap=8,bodyTop=y+(rowHeight-leadHeight-lawHeight-paragraphGap)/2;
      line(ctx,408,y+12,408,y+104,'#284878',1);
      legalParagraph(ctx,info.lead,440,bodyTop,1048,{size:17,bold:true});
      legalParagraph(ctx,info.law,440,bodyTop+leadHeight+paragraphGap,1048,{size:14,color:GOLD,bold:true});
    });
    rect(ctx,1350,34,168,52,'#0a2050',12,GOLD,2);text(ctx,'← VOLTAR',1362,60,144,{size:17,color:WHITE,bold:true,align:'center'});
    return pngBytes(canvas);
  }
  const fullSlidePic=()=>`<p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr><p:pic><p:nvPicPr><p:cNvPr id="2" name="Slide personalizado"/><p:cNvPicPr/><p:nvPr/></p:nvPicPr><p:blipFill><a:blip r:embed="rId999"/><a:stretch><a:fillRect/></a:stretch></p:blipFill><p:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="12192000" cy="6858000"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></p:spPr></p:pic></p:spTree>`;
  async function replaceSlide(zip,no,bytes,{hidden=false}={}){
    const xmlPath=`ppt/slides/slide${no}.xml`,relsPath=`ppt/slides/_rels/slide${no}.xml.rels`,mediaPath=`ppt/media/custom-slide${no}.png`;
    let xml=await zip.file(xmlPath).async('string');xml=xml.replace(/\s+show="0"(?=[\s>])/g,'').replace(/<p:spTree\b[^>]*>[\s\S]*?<\/p:spTree>/,fullSlidePic()).replace(/<p:timing\b[^>]*>[\s\S]*?<\/p:timing>/g,'');
    if(hidden)xml=xml.replace(/<p:sld\b/,'<p:sld show="0"');
    let rels=await zip.file(relsPath).async('string');rels=rels.replace(/<Relationship\b[^>]*\bId="rId999"[^>]*\/>/g,'').replace('</Relationships>',`<Relationship Id="rId999" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="../media/custom-slide${no}.png"/></Relationships>`);
    zip.file(xmlPath,xml);zip.file(relsPath,rels);zip.file(mediaPath,bytes);
  }
  async function applyPresentationTransitions(zip){
    const fade='<p:transition spd="med" advClick="1" xmlns:p14="http://schemas.microsoft.com/office/powerpoint/2010/main" p14:dur="650"><p:fade/></p:transition>';
    const paths=Object.keys(zip.files).filter(path=>/^ppt\/slides\/slide\d+\.xml$/.test(path));
    for(const path of paths){
      let xml=await zip.file(path).async('string');
      const existing=xml.match(/<p:transition\b[^>]*(?:\/>|>[\s\S]*?<\/p:transition>)/)?.[0];
      if(existing)xml=xml.replace(existing,fade);
      else if(xml.includes('</p:clrMapOvr>'))xml=xml.replace('</p:clrMapOvr>',`</p:clrMapOvr>${fade}`);
      else if(xml.includes('</p:cSld>'))xml=xml.replace('</p:cSld>',`</p:cSld>${fade}`);
      else throw new Error(`Não foi possível inserir a transição em ${path}.`);
      zip.file(path,xml);
    }
  }
  function editableShape(id,name,{x,y,w,h,rotation=0,geometry='rect',fill,gradient=null,adjustment=null}){
    const transform=`<a:xfrm${rotation?` rot="${Math.round(rotation*60000)}"`:''}><a:off x="${Math.round(x*EMU)}" y="${Math.round(y*EMU)}"/><a:ext cx="${Math.round(w*EMU)}" cy="${Math.round(h*EMU)}"/></a:xfrm>`;
    const fillXml=gradient?`<a:gradFill rotWithShape="1"><a:gsLst><a:gs pos="0"><a:srgbClr val="${gradient[0]}"/></a:gs><a:gs pos="100000"><a:srgbClr val="${gradient[1]}"/></a:gs></a:gsLst><a:lin ang="5400000" scaled="1"/></a:gradFill>`:`<a:solidFill><a:srgbClr val="${fill}"/></a:solidFill>`;
    return `<p:sp><p:nvSpPr><p:cNvPr id="${id}" name="${esc(name)}"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr><p:spPr>${transform}<a:prstGeom prst="${geometry}"><a:avLst>${adjustment===null?'':`<a:gd name="adj" fmla="val ${adjustment}"/>`}</a:avLst></a:prstGeom>${fillXml}<a:ln><a:noFill/></a:ln></p:spPr><p:txBody><a:bodyPr/><a:lstStyle/><a:p/></p:txBody></p:sp>`;
  }
  function editableText(id,name,{x,y,w,h,value,color=WHITE,fontPt=12,bold=false,fontFace='Arial'}){
    const size=Math.round(fontPt*100),body=`<a:bodyPr wrap="none" lIns="0" tIns="0" rIns="0" bIns="0" anchor="ctr"/><a:lstStyle/><a:p><a:pPr algn="ctr"/><a:r><a:rPr lang="pt-BR" sz="${size}" b="${bold?1:0}" dirty="0"><a:solidFill><a:srgbClr val="${color}"/></a:solidFill><a:latin typeface="${fontFace}"/><a:ea typeface="${fontFace}"/><a:cs typeface="${fontFace}"/></a:rPr><a:t>${esc(value)}</a:t></a:r><a:endParaRPr lang="pt-BR" sz="${size}"/></a:p>`;
    const transform=`<a:xfrm><a:off x="${Math.round(x*EMU)}" y="${Math.round(y*EMU)}"/><a:ext cx="${Math.round(w*EMU)}" cy="${Math.round(h*EMU)}"/></a:xfrm>`;
    return `<p:sp><p:nvSpPr><p:cNvPr id="${id}" name="${esc(name)}"/><p:cNvSpPr txBox="1"/><p:nvPr/></p:nvSpPr><p:spPr>${transform}<a:prstGeom prst="rect"><a:avLst/></a:prstGeom><a:noFill/><a:ln><a:noFill/></a:ln></p:spPr><p:txBody>${body}</p:txBody></p:sp>`;
  }
  function editableFreeform(id,name,{x,y,w,h,points,fill}){
    const pathW=Math.max(1,Math.round(w*EMU)),pathH=Math.max(1,Math.round(h*EMU));
    const local=points.map(point=>({x:Math.round((point.x-x)*EMU),y:Math.round((point.y-y)*EMU)}));
    const commands=local.map((point,index)=>`<a:${index?'lnTo':'moveTo'}><a:pt x="${point.x}" y="${point.y}"/></a:${index?'lnTo':'moveTo'}>`).join('');
    const transform=`<a:xfrm><a:off x="${Math.round(x*EMU)}" y="${Math.round(y*EMU)}"/><a:ext cx="${pathW}" cy="${pathH}"/></a:xfrm>`;
    const geometry=`<a:custGeom><a:avLst/><a:gdLst/><a:ahLst/><a:cxnLst/><a:rect l="0" t="0" r="${pathW}" b="${pathH}"/><a:pathLst><a:path w="${pathW}" h="${pathH}" fill="norm" stroke="0">${commands}<a:close/></a:path></a:pathLst></a:custGeom>`;
    return `<p:sp><p:nvSpPr><p:cNvPr id="${id}" name="${esc(name)}"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr><p:spPr>${transform}${geometry}<a:solidFill><a:srgbClr val="${fill}"/></a:solidFill><a:ln><a:noFill/></a:ln></p:spPr><p:txBody><a:bodyPr/><a:lstStyle/><a:p/></p:txBody></p:sp>`;
  }
  async function addEditableGauge(zip,slideNo,{x,y,w,h,title,value}){
    const xmlPath=`ppt/slides/slide${slideNo}.xml`;let xml=await zip.file(xmlPath).async('string');
    const usedIds=[...xml.matchAll(/<p:cNvPr\b[^>]*\bid="(\d+)"/g)].map(match=>Number(match[1]));let nextId=Math.max(2,...usedIds)+1;
    const shapes=[],profile=gaugeProfile(title),frame=gaugeFrame(x,y,w,h),map=frame.map;
    const label=title.includes('ATUAL')?'atual':'proposta';
    const addText=(name,value,cx,cy,sw,sh,fontPt,color)=>{const p=map({x:cx,y:cy}),width=sw*frame.scale,height=sh*frame.scale;shapes.push(editableText(nextId++,`Velocímetro ${label} · ${name}`,{x:p.x-width/2,y:p.y-height/2,w:width,h:height,value,color,fontPt,bold:true,fontFace:name==='faixa ótima'?'Arial Black':'Arial'}));};
    shapes.push(editableShape(nextId++,`Velocímetro ${label} · fundo azul`,{x,y,w,h,geometry:'rect',gradient:['001740','001233']}));
    shapes.push(editableText(nextId++,`Título do velocímetro ${label}`,{x:x+26,y:y+6,w:w-52,h:18,value:title,color:'D0AD75',fontPt:8.5,bold:true}));
    shapes.push(editableFreeform(nextId++,`Velocímetro ${label} · arco dourado`,{x,y,w,h,points:gaugeBandPoints().map(map),fill:'D0AD75'}));
    const markers=[profile.optimalStart,profile.optimalEnd,...(profile.highExposureStart?[profile.highExposureStart]:[])];
    markers.forEach(mark=>{
      const outside=gaugePoint(mark);
      if(!(profile.key==='total'&&mark===profile.optimalStart)){
        const inside=mark===3?{x:260,y:272}:{x:381,y:328},dx=outside.x-inside.x,dy=outside.y-inside.y,len=Math.hypot(dx,dy)||1,nx=-dy/len*3.5,ny=dx/len*3.5;
        const divider=[{x:inside.x+nx,y:inside.y+ny},{x:outside.x+nx,y:outside.y+ny},{x:outside.x-nx,y:outside.y-ny},{x:inside.x-nx,y:inside.y-ny}].map(map);
        shapes.push(editableFreeform(nextId++,`Velocímetro ${label} · limite ${mark}%`,{x,y,w,h,points:divider,fill:'001233'}));
      }
      addText(`referência ${mark}%`,`${mark}%`,outside.x,outside.y-25,64,26,11,'FFFFFF');
    });
    shapes.push(editableFreeform(nextId++,`Velocímetro ${label} · ponteiro branco`,{x,y,w,h,points:gaugeNeedlePoints(value).map(map),fill:'FFFFFF'}));
    const pivot=map({x:246,y:349}),pill=map({x:128,y:317});
    shapes.push(editableShape(nextId++,`Velocímetro ${label} · eixo branco`,{x:pivot.x-22*frame.scale,y:pivot.y-22*frame.scale,w:44*frame.scale,h:44*frame.scale,geometry:'ellipse',fill:'FFFFFF'}));
    shapes.push(editableShape(nextId++,`Velocímetro ${label} · centro azul`,{x:pivot.x-9*frame.scale,y:pivot.y-9*frame.scale,w:18*frame.scale,h:18*frame.scale,geometry:'ellipse',fill:'001233'}));
    addText('faixa ótima','Ótimo',profile.key==='total'?180:165,258,68,26,10,'001233');
    addText('faixa recomendada','Recomendado',profile.key==='total'?350:308,239,116,26,10,'001233');
    addText('alta exposição · linha 1','Alta',448,296,70,22,9.5,'001233');addText('alta exposição · linha 2','Exposição',448,314,98,22,9.5,'001233');
    shapes.push(editableShape(nextId++,`Velocímetro ${label} · cápsula do percentual`,{x:pill.x,y:pill.y,w:80*frame.scale,h:50*frame.scale,geometry:'roundRect',fill:'FFC971',adjustment:50000}));
    addText('percentual',pct(value),168,342,76,44,12.5,'001233');
    addText('limite da escala','10%',553,370,54,28,11,'FFFFFF');
    xml=xml.replace('</p:spTree>',`${shapes.join('')}</p:spTree>`);zip.file(xmlPath,xml);
  }

  async function addSlideJumpHotspot(zip,sourceSlide,targetSlide,{x=0,y=0,w=12192000,h=6858000,name='Atalho interno'}={}){
    const xmlPath=`ppt/slides/slide${sourceSlide}.xml`,relsPath=`ppt/slides/_rels/slide${sourceSlide}.xml.rels`;
    let xml=await zip.file(xmlPath).async('string'),rels=await zip.file(relsPath).async('string');
    const relNumbers=[...rels.matchAll(/\bId="rId(\d+)"/g)].map(match=>Number(match[1])),rid=`rId${Math.max(0,...relNumbers)+1}`;
    const shapeIds=[...xml.matchAll(/<p:cNvPr\b[^>]*\bid="(\d+)"/g)].map(match=>Number(match[1])),shapeId=Math.max(2,...shapeIds)+1;
    const hotspot=`<p:sp><p:nvSpPr><p:cNvPr id="${shapeId}" name="${name}"><a:hlinkClick r:id="${rid}" action="ppaction://hlinksldjump"/></p:cNvPr><p:cNvSpPr/><p:nvPr/></p:nvSpPr><p:spPr><a:xfrm><a:off x="${x}" y="${y}"/><a:ext cx="${w}" cy="${h}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom><a:solidFill><a:srgbClr val="FFFFFF"><a:alpha val="0"/></a:srgbClr></a:solidFill><a:ln><a:noFill/></a:ln></p:spPr><p:txBody><a:bodyPr/><a:lstStyle/><a:p/></p:txBody></p:sp>`;
    xml=xml.replace('</p:spTree>',`${hotspot}</p:spTree>`);
    rels=rels.replace('</Relationships>',`<Relationship Id="${rid}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="slide${targetSlide}.xml"/></Relationships>`);
    zip.file(xmlPath,xml);zip.file(relsPath,rels);
  }
  async function addShowJumpHotspot(zip,sourceSlide,{x=0,y=0,w=12192000,h=6858000,name='Retornar ao slide anterior',jump='lastslideviewed'}={}){
    const xmlPath=`ppt/slides/slide${sourceSlide}.xml`;let xml=await zip.file(xmlPath).async('string');
    const shapeIds=[...xml.matchAll(/<p:cNvPr\b[^>]*\bid="(\d+)"/g)].map(match=>Number(match[1])),shapeId=Math.max(2,...shapeIds)+1;
    const hotspot=`<p:sp><p:nvSpPr><p:cNvPr id="${shapeId}" name="${name}"><a:hlinkClick action="ppaction://hlinkshowjump?jump=${jump}"/></p:cNvPr><p:cNvSpPr/><p:nvPr/></p:nvSpPr><p:spPr><a:xfrm><a:off x="${x}" y="${y}"/><a:ext cx="${w}" cy="${h}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom><a:solidFill><a:srgbClr val="FFFFFF"><a:alpha val="0"/></a:srgbClr></a:solidFill><a:ln><a:noFill/></a:ln></p:spPr><p:txBody><a:bodyPr/><a:lstStyle/><a:p/></p:txBody></p:sp>`;
    xml=xml.replace('</p:spTree>',`${hotspot}</p:spTree>`);zip.file(xmlPath,xml);
  }
  async function ensureRiskNavigation(zip){
    const xmlPath='ppt/slides/slide2.xml',relsPath='ppt/slides/_rels/slide2.xml.rels';
    const xml=await zip.file(xmlPath).async('string'),rels=await zip.file(relsPath).async('string');
    const targetRelation=[...rels.matchAll(/<Relationship\b[^>]*\/>/g)].map(match=>match[0]).find(tag=>/\bType="[^"]*\/slide"/.test(tag)&&/\bTarget="slide3\.xml"/.test(tag));
    const targetRid=targetRelation?.match(/\bId="([^"]+)"/)?.[1];
    if(targetRid&&new RegExp(`<a:hlinkClick\\b[^>]*\\br:id="${targetRid.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')}"`).test(xml))return;
    await addSlideJumpHotspot(zip,2,3,{x:6551001,y:5529625,w:3237251,h:954107,name:'Abrir risco da não acumulação'});
  }
  async function prepareProjectionStages(zip){
    const read=async path=>{const file=zip.file(path);if(!file)throw new Error(`Parte OOXML ausente: ${path}`);return file.async('string');};
    if(zip.file('ppt/slides/slide15.xml')||zip.file('ppt/slides/slide16.xml'))throw new Error('Os slides adicionais de projeção já existem no modelo.');

    let slide12=await read('ppt/slides/slide12.xml');
    const slide12WasHidden=/<p:sld\b[^>]*\bshow="0"/.test(slide12);
    slide12=slide12.replace(/\s+show="0"(?=[\s>])/,'');
    zip.file('ppt/slides/slide12.xml',slide12);

    const cloneBase=(await read('ppt/slides/slide11.xml')).replace(/\s+show="0"(?=[\s>])/g,'').replace(/<p:timing\b[^>]*>[\s\S]*?<\/p:timing>/g,'');
    const relXml='<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideLayout" Target="../slideLayouts/slideLayout1.xml"/></Relationships>';
    [15,16].forEach((no,index)=>{const xml=cloneBase.replace(/(<p14:creationId\b[^>]*\bval=")\d+("[^>]*\/>)/,(_,before,after)=>`${before}${3662746429+index}${after}`);zip.file(`ppt/slides/slide${no}.xml`,xml);zip.file(`ppt/slides/_rels/slide${no}.xml.rels`,relXml);});

    const relPath='ppt/_rels/presentation.xml.rels';let rels=await read(relPath);
    const slide12Tag=[...rels.matchAll(/<Relationship\b[^>]*\/>/g)].map(match=>match[0]).find(tag=>/\bTarget="slides\/slide12\.xml"/.test(tag));
    const slide12Rid=slide12Tag?.match(/\bId="([^"]+)"/)?.[1];if(!slide12Rid)throw new Error('Relacionamento do slide 12 não encontrado.');
    const usedRids=[...rels.matchAll(/\bId="rId(\d+)"/g)].map(match=>Number(match[1]));const nextRid=Math.max(0,...usedRids)+1,newRid15=`rId${nextRid}`,newRid16=`rId${nextRid+1}`;
    rels=rels.replace('</Relationships>',`<Relationship Id="${newRid15}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="slides/slide15.xml"/><Relationship Id="${newRid16}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="slides/slide16.xml"/></Relationships>`);zip.file(relPath,rels);

    let presentation=await read('ppt/presentation.xml');const ids=[...presentation.matchAll(/<p:sldId\b[^>]*\bid="(\d+)"/g)].map(match=>Number(match[1]));const newSlideId=Math.max(255,...ids)+1;
    const escapedRid=slide12Rid.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');const slide12Pattern=new RegExp(`<p:sldId\\b(?=[^>]*\\br:id="${escapedRid}")[^>]*/>`);const slide12IdTag=presentation.match(slide12Pattern)?.[0];if(!slide12IdTag)throw new Error('sldId do slide 12 não encontrado.');
    presentation=presentation.replace(slide12Pattern,`${slide12IdTag}<p:sldId id="${newSlideId}" r:id="${newRid15}"/><p:sldId id="${newSlideId+1}" r:id="${newRid16}"/>`);zip.file('ppt/presentation.xml',presentation);

    let contentTypes=await read('[Content_Types].xml');contentTypes=contentTypes.replace('</Types>','<Override PartName="/ppt/slides/slide15.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/><Override PartName="/ppt/slides/slide16.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/></Types>');zip.file('[Content_Types].xml',contentTypes);
    const appFile=zip.file('docProps/app.xml');if(appFile){let app=await appFile.async('string');app=app.replace(/<Slides>(\d+)<\/Slides>/,(_,count)=>`<Slides>${Number(count)+2}</Slides>`);if(slide12WasHidden)app=app.replace(/<HiddenSlides>(\d+)<\/HiddenSlides>/,(_,count)=>`<HiddenSlides>${Math.max(0,Number(count)-1)}</HiddenSlides>`);app=app.replace(/(<vt:lpstr>Títulos de slides<\/vt:lpstr><\/vt:variant><vt:variant><vt:i4>)(\d+)(<\/vt:i4>)/,(_,before,count,after)=>`${before}${Number(count)+2}${after}`).replace(/(<TitlesOfParts><vt:vector\b[^>]*\bsize=")(\d+)("[^>]*>)([\s\S]*?)(<\/vt:vector><\/TitlesOfParts>)/,(_,before,size,middle,body,after)=>`${before}${Number(size)+2}${middle}${body}<vt:lpstr>Apresentação do PowerPoint</vt:lpstr><vt:lpstr>Apresentação do PowerPoint</vt:lpstr>${after}`);zip.file('docProps/app.xml',app);}
  }
  async function prepareLegalInfoSlides(zip){
    const read=async path=>{const file=zip.file(path);if(!file)throw new Error(`Parte OOXML ausente: ${path}`);return file.async('string');};
    const slideNumber=17;if([17,18,19].some(no=>zip.file(`ppt/slides/slide${no}.xml`)))throw new Error('Os slides legais adicionais já existem no modelo.');
    const cloneBase=(await read('ppt/slides/slide11.xml')).replace(/\s+show="0"(?=[\s>])/g,'').replace(/<p:timing\b[^>]*>[\s\S]*?<\/p:timing>/g,'');
    const relXml='<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideLayout" Target="../slideLayouts/slideLayout1.xml"/></Relationships>';
    const slideXml=cloneBase.replace(/(<p14:creationId\b[^>]*\bval=")\d+("[^>]*\/>)/,(_,before,after)=>`${before}3720000100${after}`);zip.file(`ppt/slides/slide${slideNumber}.xml`,slideXml);zip.file(`ppt/slides/_rels/slide${slideNumber}.xml.rels`,relXml);
    const relPath='ppt/_rels/presentation.xml.rels';let rels=await read(relPath);const usedRids=[...rels.matchAll(/\bId="rId(\d+)"/g)].map(match=>Number(match[1])),rid=`rId${Math.max(0,...usedRids)+1}`;
    rels=rels.replace('</Relationships>',`<Relationship Id="${rid}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="slides/slide${slideNumber}.xml"/></Relationships>`);zip.file(relPath,rels);
    let presentation=await read('ppt/presentation.xml');const ids=[...presentation.matchAll(/<p:sldId\b[^>]*\bid="(\d+)"/g)].map(match=>Number(match[1]));let nextId=Math.max(255,...ids)+1;
    const slide16Rel=[...rels.matchAll(/<Relationship\b[^>]*\/>/g)].map(match=>match[0]).find(tag=>/Target="slides\/slide16\.xml"/.test(tag)),slide16Rid=slide16Rel?.match(/\bId="([^"]+)"/)?.[1];if(!slide16Rid)throw new Error('Relacionamento do slide final da projeção não encontrado.');
    const slide16Pattern=new RegExp(`<p:sldId\\b(?=[^>]*\\br:id="${slide16Rid}")[^>]*/>`),slide16Tag=presentation.match(slide16Pattern)?.[0];if(!slide16Tag)throw new Error('Posição do slide final da projeção não encontrada.');
    presentation=presentation.replace(slide16Pattern,`${slide16Tag}<p:sldId id="${nextId}" r:id="${rid}"/>`);zip.file('ppt/presentation.xml',presentation);
    let types=await read('[Content_Types].xml');types=types.replace('</Types>',`<Override PartName="/ppt/slides/slide${slideNumber}.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/></Types>`);zip.file('[Content_Types].xml',types);
    const appFile=zip.file('docProps/app.xml');if(appFile){let app=await appFile.async('string');app=app.replace(/<Slides>(\d+)<\/Slides>/,(_,n)=>`<Slides>${Number(n)+1}</Slides>`);if(/<HiddenSlides>\d+<\/HiddenSlides>/.test(app))app=app.replace(/<HiddenSlides>(\d+)<\/HiddenSlides>/,(_,n)=>`<HiddenSlides>${Number(n)+1}</HiddenSlides>`);else app=app.replace(/(<Slides>\d+<\/Slides>)/,`$1<HiddenSlides>1</HiddenSlides>`);app=app.replace(/(<TitlesOfParts><vt:vector\b[^>]*\bsize=")(\d+)("[^>]*>)([\s\S]*?)(<\/vt:vector><\/TitlesOfParts>)/,(_,before,size,middle,body,after)=>`${before}${Number(size)+1}${middle}${body}<vt:lpstr>Benefícios legais do seguro de vida</vt:lpstr>${after}`);zip.file('docProps/app.xml',app);}
    return slideNumber;
  }
  async function prepareClickRevealStages(zip,sourceSlide,count,label){
    const read=async path=>{const file=zip.file(path);if(!file)throw new Error(`Parte OOXML ausente: ${path}`);return file.async('string');};
    const existing=Object.keys(zip.files).map(path=>path.match(/^ppt\/slides\/slide(\d+)\.xml$/)?.[1]).filter(Boolean).map(Number);
    const targets=Array.from({length:count},(_,index)=>Math.max(...existing)+index+1);
    const source=(await read(`ppt/slides/slide${sourceSlide}.xml`)).replace(/\s+show="0"(?=[\s>])/g,'').replace(/<p:timing\b[^>]*>[\s\S]*?<\/p:timing>/g,'').replace(/<p:transition\b[^>]*>[\s\S]*?<\/p:transition>/g,'').replace(/<p:transition\b[^>]*\/>/g,'');
    const sourceRels=(await read(`ppt/slides/_rels/slide${sourceSlide}.xml.rels`)).replace(/<Relationship\b(?=[^>]*\bType="[^"]*\/notesSlide")[^>]*\/>/g,'');
    const relPath='ppt/_rels/presentation.xml.rels';let rels=await read(relPath),presentation=await read('ppt/presentation.xml'),types=await read('[Content_Types].xml');
    const sourceRelation=[...rels.matchAll(/<Relationship\b[^>]*\/>/g)].map(match=>match[0]).find(tag=>tag.includes(`Target="slides/slide${sourceSlide}.xml"`));
    const sourceRid=sourceRelation?.match(/\bId="([^"]+)"/)?.[1];if(!sourceRid)throw new Error(`Relacionamento do slide ${sourceSlide} não encontrado.`);
    const sourcePattern=new RegExp(`<p:sldId\\b(?=[^>]*\\br:id="${sourceRid}")[^>]*/>`),sourceTag=presentation.match(sourcePattern)?.[0];if(!sourceTag)throw new Error(`Posição do slide ${sourceSlide} não encontrada.`);
    const firstRid=Math.max(0,...[...rels.matchAll(/\bId="rId(\d+)"/g)].map(match=>Number(match[1])))+1;
    let nextId=Math.max(255,...[...presentation.matchAll(/<p:sldId\b[^>]*\bid="(\d+)"/g)].map(match=>Number(match[1])))+1,inserted='';
    for(let index=0;index<targets.length;index++){
      const target=targets[index],rid=`rId${firstRid+index}`;
      const xml=source.replace(/(<p14:creationId\b[^>]*\bval=")\d+("[^>]*\/>)/,(_,before,after)=>`${before}${3720000200+target}${after}`);
      zip.file(`ppt/slides/slide${target}.xml`,xml);zip.file(`ppt/slides/_rels/slide${target}.xml.rels`,sourceRels);
      rels=rels.replace('</Relationships>',`<Relationship Id="${rid}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="slides/slide${target}.xml"/></Relationships>`);
      types=types.replace('</Types>',`<Override PartName="/ppt/slides/slide${target}.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/></Types>`);
      inserted+=`<p:sldId id="${nextId++}" r:id="${rid}"/>`;
    }
    presentation=presentation.replace(sourcePattern,`${sourceTag}${inserted}`);
    zip.file(relPath,rels);zip.file('ppt/presentation.xml',presentation);zip.file('[Content_Types].xml',types);
    const appFile=zip.file('docProps/app.xml');if(appFile){let app=await appFile.async('string');app=app.replace(/<Slides>(\d+)<\/Slides>/,(_,n)=>`<Slides>${Number(n)+targets.length}</Slides>`);app=app.replace(/(<TitlesOfParts><vt:vector\b[^>]*\bsize=")(\d+)("[^>]*>)([\s\S]*?)(<\/vt:vector><\/TitlesOfParts>)/,(_,before,size,middle,body,after)=>`${before}${Number(size)+targets.length}${middle}${body}${`<vt:lpstr>${esc(label)}</vt:lpstr>`.repeat(targets.length)}${after}`);zip.file('docProps/app.xml',app);}
    return targets;
  }
  async function preparePlanningStages(zip){
    if(zip.file('ppt/slides/slide17.xml'))throw new Error('O slide adicional de planejamento já existe no modelo.');
    const read=async path=>{const file=zip.file(path);if(!file)throw new Error(`Parte OOXML ausente: ${path}`);return file.async('string');};
    const sourceXml=(await read('ppt/slides/slide2.xml')).replace(/\s+show="0"(?=[\s>])/g,'').replace(/<p:timing\b[^>]*>[\s\S]*?<\/p:timing>/g,'');
    const sourceRels=(await read('ppt/slides/_rels/slide2.xml.rels')).replace(/<Relationship\b(?=[^>]*\bType="[^"]*\/notesSlide")[^>]*\/>/g,'');
    zip.file('ppt/slides/slide17.xml',sourceXml);zip.file('ppt/slides/_rels/slide17.xml.rels',sourceRels);
    const relPath='ppt/_rels/presentation.xml.rels';let rels=await read(relPath);const used=[...rels.matchAll(/\bId="rId(\d+)"/g)].map(m=>Number(m[1]));const rid=`rId${Math.max(...used)+1}`;rels=rels.replace('</Relationships>',`<Relationship Id="${rid}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="slides/slide17.xml"/></Relationships>`);zip.file(relPath,rels);
    let presentation=await read('ppt/presentation.xml');const ids=[...presentation.matchAll(/<p:sldId\b[^>]*\bid="(\d+)"/g)].map(m=>Number(m[1]));const newId=Math.max(255,...ids)+1;const slide2Tag=[...rels.matchAll(/<Relationship\b[^>]*\/>/g)].map(m=>m[0]).find(t=>/Target="slides\/slide2\.xml"/.test(t));const slide2Rid=slide2Tag?.match(/\bId="([^"]+)"/)?.[1];const pattern=new RegExp(`<p:sldId\\b(?=[^>]*\\br:id="${slide2Rid}")[^>]*/>`);const tag=presentation.match(pattern)?.[0];if(!tag)throw new Error('sldId do slide 2 não encontrado.');presentation=presentation.replace(pattern,`${tag}<p:sldId id="${newId}" r:id="${rid}"/>`);zip.file('ppt/presentation.xml',presentation);
    let types=await read('[Content_Types].xml');types=types.replace('</Types>','<Override PartName="/ppt/slides/slide17.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/></Types>');zip.file('[Content_Types].xml',types);
    const appFile=zip.file('docProps/app.xml');if(appFile){let app=await appFile.async('string');app=app.replace(/<Slides>(\d+)<\/Slides>/,(_,n)=>`<Slides>${Number(n)+1}</Slides>`);app=app.replace(/(<vt:lpstr>Títulos de slides<\/vt:lpstr><\/vt:variant><vt:variant><vt:i4>)(\d+)(<\/vt:i4>)/,(_,a,n,b)=>`${a}${Number(n)+1}${b}`);zip.file('docProps/app.xml',app);}
  }
  const projectionSlideNumbers=[11,12,15,16];
  const studySlideNumbers=[6,7,8,9,10,11,12,15,16,13];
  async function renderCommonSlides(d){const tasks=[[1,()=>slide1(d)],[3,()=>staticSlide(3)],[4,()=>staticSlide(4)],[5,()=>staticSlide(5)],[14,()=>slide14(d)]];const rendered=[];for(const [no,render] of tasks)rendered.push([no,await render()]);return rendered;}
  async function renderOverviewSlides(d,{includeGauge=true}={}){const tasks=[[6,()=>slide6(d)],[7,()=>slide7(d)],[8,()=>assetSlide(8,d,'current')],[9,()=>assetSlide(9,d,'reallocation')],[10,()=>assetSlide(10,d,'with')],[13,()=>slide13(d,{includeGauge})]];const rendered=[];for(const [no,render] of tasks)rendered.push([no,await render()]);return rendered;}
  async function renderProjectionSlides(d){const tasks=[[11,()=>slide11(d,0)],[12,()=>slide11(d,1)],[15,()=>slide11(d,2)],[16,()=>slide11(d,3)]];const rendered=[];for(const [no,render] of tasks)rendered.push([no,await render()]);return rendered;}
  async function renderStudySlides(d){const overview=new Map(await renderOverviewSlides(d)),projectionSlides=new Map(await renderProjectionSlides(d));return studySlideNumbers.map(no=>[no,overview.get(no)||projectionSlides.get(no)]);}
  function combineStudiesForPpt(d,studies){
    if(studies.length<2)return studies[0]||d;
    const sum=key=>studies.reduce((total,study)=>total+(Number(study?.[key])||0),0);
    const input={xp:sum('xp'),other:sum('other'),pension:sum('pension'),realEstate:sum('realEstate'),holdings:sum('holdings'),currentInsurance:sum('currentInsurance'),coverageGap:sum('coverageGap'),annualPremium:sum('annualPremium'),annualReturn:Number(studies[0]?.annualReturn)||0};
    const calculated=window.RiskStudy?.calculatePerson?window.RiskStudy.calculatePerson(input):{...input,financial:input.xp+input.other+input.pension,illiquid:input.realEstate+input.holdings};
    if(!calculated.total){calculated.total=calculated.financial+calculated.illiquid;calculated.inventoriable=Math.max(0,calculated.total-input.pension);calculated.liability=calculated.inventoriable*.15;calculated.recommended=calculated.liability;calculated.coverageAfter=input.currentInsurance+input.coverageGap;calculated.withoutInsurance=Math.max(0,calculated.total-calculated.liability);calculated.withInsurance=Math.max(0,calculated.total-calculated.liability+calculated.coverageAfter);calculated.monthlyReturn=input.annualReturn/12;calculated.paybackMonths=calculated.financial&&calculated.monthlyReturn&&input.annualPremium?Math.ceil(input.annualPremium/(calculated.financial*calculated.monthlyReturn)):0;}
    return {...studies[0],...calculated,name:d.familyLabel||studies[0].familyLabel||studies[0].name,studyLabel:'Estudo familiar consolidado'};
  }
  async function cloneHiddenProjectionSlides(zip){
    const read=async path=>{const file=zip.file(path);if(!file)throw new Error(`Parte OOXML ausente: ${path}`);return file.async('string');};
    const existing=Object.keys(zip.files).map(path=>path.match(/^ppt\/slides\/slide(\d+)\.xml$/)?.[1]).filter(Boolean).map(Number),firstNew=Math.max(...existing)+1;
    const relPath='ppt/_rels/presentation.xml.rels';let rels=await read(relPath);const usedRids=[...rels.matchAll(/\bId="rId(\d+)"/g)].map(match=>Number(match[1])),firstRid=Math.max(...usedRids)+1;
    let presentation=await read('ppt/presentation.xml'),types=await read('[Content_Types].xml');const ids=[...presentation.matchAll(/<p:sldId\b[^>]*\bid="(\d+)"/g)].map(match=>Number(match[1]));let nextId=Math.max(255,...ids)+1;
    const slide14Rel=[...rels.matchAll(/<Relationship\b[^>]*\/>/g)].map(match=>match[0]).find(tag=>/Target="slides\/slide14\.xml"/.test(tag));const slide14Rid=slide14Rel?.match(/\bId="([^"]+)"/)?.[1];if(!slide14Rid)throw new Error('Relacionamento do slide final não encontrado.');const slide14Pattern=new RegExp(`<p:sldId\\b(?=[^>]*\\br:id="${slide14Rid}")[^>]*/>`);const slide14Tag=presentation.match(slide14Pattern)?.[0];if(!slide14Tag)throw new Error('Posição do slide final não encontrada.');
    const mapping=[];let inserted='';
    for(let index=0;index<projectionSlideNumbers.length;index++){
      const source=projectionSlideNumbers[index],target=firstNew+index,rid=`rId${firstRid+index}`;let xml=await read(`ppt/slides/slide${source}.xml`),slideRels=await read(`ppt/slides/_rels/slide${source}.xml.rels`);xml=xml.replace(/\s+show="0"(?=[\s>])/g,'').replace(/<p:sld\b/,'<p:sld show="0"').replace(/(<p14:creationId\b[^>]*\bval=")\d+("[^>]*\/>)/,(_,before,after)=>`${before}${4100000000-index}${after}`);slideRels=slideRels.replace(/<Relationship\b(?=[^>]*\bType="[^"]*\/notesSlide")[^>]*\/>/g,'');zip.file(`ppt/slides/slide${target}.xml`,xml);zip.file(`ppt/slides/_rels/slide${target}.xml.rels`,slideRels);rels=rels.replace('</Relationships>',`<Relationship Id="${rid}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="slides/slide${target}.xml"/></Relationships>`);types=types.replace('</Types>',`<Override PartName="/ppt/slides/slide${target}.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/></Types>`);inserted+=`<p:sldId id="${nextId++}" r:id="${rid}"/>`;mapping.push([source,target]);
    }
    presentation=presentation.replace(slide14Pattern,`${inserted}${slide14Tag}`);zip.file(relPath,rels);zip.file('ppt/presentation.xml',presentation);zip.file('[Content_Types].xml',types);
    const appFile=zip.file('docProps/app.xml');if(appFile){let app=await appFile.async('string'),count=mapping.length;app=app.replace(/<Slides>(\d+)<\/Slides>/,(_,n)=>`<Slides>${Number(n)+count}</Slides>`);if(/<HiddenSlides>\d+<\/HiddenSlides>/.test(app))app=app.replace(/<HiddenSlides>(\d+)<\/HiddenSlides>/,(_,hiddenCount)=>`<HiddenSlides>${Number(hiddenCount)+count}</HiddenSlides>`);else app=app.replace(/(<Slides>\d+<\/Slides>)/,`$1<HiddenSlides>${count}</HiddenSlides>`);app=app.replace(/(<TitlesOfParts><vt:vector\b[^>]*\bsize=")(\d+)("[^>]*>)([\s\S]*?)(<\/vt:vector><\/TitlesOfParts>)/,(_,before,size,middle,body,after)=>`${before}${Number(size)+count}${middle}${body}${'<vt:lpstr>Projeção do cônjuge</vt:lpstr>'.repeat(count)}${after}`);zip.file('docProps/app.xml',app);}
    return mapping;
  }
  window.buildTemplatePpt=async d=>{
    if(!window.JSZip)throw new Error('A biblioteca JSZip não foi carregada.');
    const response=await fetch('assets/modelo-base.pptx?v=3');if(!response.ok)throw new Error('O arquivo-modelo do PowerPoint não foi encontrado.');
    const zip=await JSZip.loadAsync(await response.arrayBuffer());
    await prepareProjectionStages(zip);
    const legalTarget=await prepareLegalInfoSlides(zip);
    const costStageTargets=await prepareClickRevealStages(zip,6,3,'Custos da sucessão');
    const currentAssetStageTargets=await prepareClickRevealStages(zip,8,3,'Patrimônio atual');
    const reallocationStageTargets=await prepareClickRevealStages(zip,9,4,'Patrimônio em realocação');
    const insuranceStageTargets=await prepareClickRevealStages(zip,10,4,'Patrimônio com seguro de vida');
    const studies=Array.isArray(d.studies)&&d.studies.length?d.studies:[d];
    for(const [no,bytes] of await renderCommonSlides(d))await replaceSlide(zip,no,bytes,{hidden:no===3});
    await ensureRiskNavigation(zip);
    const combined=combineStudiesForPpt(d,studies);
    for(const [no,bytes] of await renderOverviewSlides(combined,{includeGauge:false}))await replaceSlide(zip,no,bytes);
    await replaceSlide(zip,6,await slide6(combined,0));
    for(let index=0;index<costStageTargets.length;index++)await replaceSlide(zip,costStageTargets[index],await slide6(combined,index+1));
    await replaceSlide(zip,8,await assetSlide(8,combined,'current',0));
    for(let index=0;index<currentAssetStageTargets.length;index++)await replaceSlide(zip,currentAssetStageTargets[index],await assetSlide(8,combined,'current',index+1));
    await replaceSlide(zip,9,await assetSlide(9,combined,'reallocation',0));
    for(let index=0;index<reallocationStageTargets.length;index++)await replaceSlide(zip,reallocationStageTargets[index],await assetSlide(9,combined,'reallocation',index+1));
    await replaceSlide(zip,10,await assetSlide(10,combined,'with',0));
    for(let index=0;index<insuranceStageTargets.length;index++)await replaceSlide(zip,insuranceStageTargets[index],await assetSlide(10,combined,'with',index+1));
    const currentAllocation=combined.total?combined.annualPremium/combined.total*100:0,proposedAllocation=combined.financial?combined.annualPremium/combined.financial*100:0;
    await addEditableGauge(zip,13,{x:40,y:600,w:490,h:275,title:'Alocação atual vs patrimônio total',value:currentAllocation});
    await addEditableGauge(zip,13,{x:555,y:600,w:490,h:275,title:'Alocação proposta vs ativos financeiros',value:proposedAllocation});
    for(const [no,bytes] of await renderProjectionSlides(studies[0]))await replaceSlide(zip,no,bytes);
    await replaceSlide(zip,legalTarget,await legalInfoSlide(),{hidden:true});await addShowJumpHotspot(zip,legalTarget,{x:1350*EMU,y:34*EMU,w:168*EMU,h:52*EMU,name:'Voltar da base legal'});
    const legalIconCenters=[674,713,752,791];for(let index=0;index<legalInfoSlides.length;index++)await addSlideJumpHotspot(zip,16,legalTarget,{x:1492*EMU,y:(legalIconCenters[index]-22)*EMU,w:46*EMU,h:44*EMU,name:`Abrir explicação: ${legalInfoSlides[index].title}`});
    if(studies.length>1){
      const mapping=await cloneHiddenProjectionSlides(zip),spouseSlides=new Map(await renderProjectionSlides(studies[1])),hiddenTargets=mapping.map(([,target])=>target);
      for(const [source,target] of mapping)await replaceSlide(zip,target,spouseSlides.get(source),{hidden:true});
      for(const source of projectionSlideNumbers)await addSlideJumpHotspot(zip,source,hiddenTargets[0],{x:11320000,y:0,w:780000,h:650000,name:'Abrir projeção do cônjuge'});
      const spouseFinal=mapping.find(([source])=>source===16)?.[1];if(spouseFinal)for(let index=0;index<legalInfoSlides.length;index++)await addSlideJumpHotspot(zip,spouseFinal,legalTarget,{x:1492*EMU,y:(legalIconCenters[index]-22)*EMU,w:46*EMU,h:44*EMU,name:`Abrir explicação: ${legalInfoSlides[index].title}`});
      for(let index=0;index<hiddenTargets.length;index++)await addSlideJumpHotspot(zip,hiddenTargets[index],hiddenTargets[index+1]||13,{name:index===hiddenTargets.length-1?'Retornar ao estudo familiar':'Avançar projeção do cônjuge'});
    }
    await applyPresentationTransitions(zip);
    return zip.generateAsync({type:'blob',compression:'DEFLATE'});
  };
  window.buildTemplatePdf=async d=>{
    if(!window.PDFLib)throw new Error('A biblioteca de PDF não foi carregada.');
    const studies=Array.isArray(d.studies)&&d.studies.length?d.studies:[d],effectOnly=new Set([11,12,15]);
    const rendered=[[1,await slide1(d)],[2,await staticSlide(2)],[3,await staticSlide(3)],[4,await staticSlide(4)],[5,await staticSlide(5)]];
    for(const study of studies)rendered.push(...await renderStudySlides(study));rendered.push([14,await slide14(d)]);
    const pdf=await PDFLib.PDFDocument.create();
    pdf.setTitle(`Gestão de Riscos - ${d.familyLabel||d.name}`);pdf.setAuthor('Alta Vista');pdf.setSubject('Planejamento sucessório');
    for(const [no,bytes] of rendered){
      if(effectOnly.has(no))continue;
      const page=pdf.addPage([W,H]),image=await pdf.embedJpg(await pngToJpegBytes(bytes));page.drawImage(image,{x:0,y:0,width:W,height:H});
    }
    const bytes=await pdf.save({useObjectStreams:true});return new Blob([bytes],{type:'application/pdf'});
  };
})();
