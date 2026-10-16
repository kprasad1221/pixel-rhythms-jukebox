export function installMeters(master, context, videos) {
    let analyser, channels, waveData, channelData;
    const history = new Float32Array(180);
    const meterLevels = [0, 0];
    const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");
    function setupMeters() {
      analyser = context.createAnalyser();
      analyser.fftSize = 1024;
      master.connect(analyser);
      waveData = new Float32Array(analyser.fftSize);
      const splitter = context.createChannelSplitter(2);
      master.connect(splitter);
      channels = [0,1].map(i => {
        const a = context.createAnalyser(); a.fftSize = 1024;
        splitter.connect(a, i); return a;
      });
      channelData = channels.map(a => new Float32Array(a.fftSize));
    }
    const surfaces = ['meters','scope','ribbon'].map(id => {
      const canvas = document.getElementById(id);
      return {canvas, ctx:canvas.getContext('2d'), width:0, height:0};
    });
    const observer = new ResizeObserver(() => surfaces.forEach(s => {
      const rect = s.canvas.getBoundingClientRect();
      const dpr = Math.min(devicePixelRatio || 1, 2);
      s.width = rect.width; s.height = rect.height;
      s.canvas.width = Math.round(rect.width*dpr); s.canvas.height = Math.round(rect.height*dpr);
      s.ctx.setTransform(dpr,0,0,dpr,0,0);
    }));
    surfaces.forEach(s => observer.observe(s.canvas));
    let lastDraw = 0;
    function drawFeedback(now) {
      requestAnimationFrame(drawFeedback);
      if (document.hidden || now-lastDraw < (reducedMotion.matches ? 150 : 33)) return;
      lastDraw = now;
      const playing = context?.state === 'running' && videos.some(v => !v.paused && v.readyState >= 2);
      let rms = 0;
      if (analyser && playing) {
        analyser.getFloatTimeDomainData(waveData);
        for (const sample of waveData) rms += sample*sample;
        rms = Math.sqrt(rms/waveData.length);
      } else if (waveData) waveData.fill(0);
      history.copyWithin(0,1); history[history.length-1] = Math.min(1,rms*3);
      surfaces.forEach(s => s.ctx.clearRect(0,0,s.width,s.height));
      const m = surfaces[0], c = m.ctx, w = m.width, h = m.height;
      if (w && h) {
        const top = 20, height = Math.max(20,h-48), count = 26;
        for (let ch=0;ch<2;ch++) {
          let peak=0;
          if (channels && playing) { channels[ch].getFloatTimeDomainData(channelData[ch]); for (const v of channelData[ch]) peak=Math.max(peak,Math.abs(v)); }
          const level = Math.max(0,Math.min(1,(20*Math.log10(Math.max(peak,0.001))+48)/48));
          meterLevels[ch]=Math.max(level,meterLevels[ch]*0.88);
          const x=w*(ch ? .52 : .22), bar=Math.max(9,w*.12);
          for(let i=0;i<count;i++) {
            c.fillStyle=i/count<meterLevels[ch] ? (ch ? '#f1d785' : '#52dfef') : '#244955';
            c.fillRect(x,top+height-(i+1)*height/count,bar,Math.max(2,height/count-3));
          }
          c.fillStyle='#c4dfe5'; c.font='10px system-ui'; c.textAlign='center'; c.fillText(ch?'R':'L',x+bar/2,h-12);
        }
        c.fillStyle='#a7c7d1';c.font='9px system-ui';c.textAlign='left';
        [0,-12,-24,-36,-48].forEach((v,i)=>c.fillText(String(v),w*.77,top+5+i*(height-5)/4));
      }
      const scope=surfaces[1];
      if(scope.width && scope.height) {
        const c=scope.ctx,w=scope.width,h=scope.height;
        c.strokeStyle='#3e6978';c.lineWidth=.5;c.beginPath();c.moveTo(12,h/2);c.lineTo(w-12,h/2);c.stroke();
        if(waveData && playing) {
          c.strokeStyle='#78e7ed';c.lineWidth=1.4;c.beginPath();
          for(let i=0;i<256;i++) { const x=12+i/255*(w-24), y=h/2+waveData[i*4]*(h*.4); if(i)c.lineTo(x,y);else c.moveTo(x,y); } c.stroke();
        }
      }
      const r=surfaces[2];
      for(let i=0;i<history.length;i++) {
        const x=10+i/history.length*(r.width-20), amplitude=Math.max(1,history[i]*(r.height-10));
        r.ctx.fillStyle=i/history.length>.7?'#efdc9d':'#62dce9';
        r.ctx.globalAlpha=history[i]>.005 ? .9 : .2;
        r.ctx.fillRect(x,(r.height-amplitude)/2,Math.max(1,(r.width-20)/history.length-2),amplitude);
      }
      r.ctx.globalAlpha=1;
    }
    setupMeters();
    requestAnimationFrame(drawFeedback);


}
