// Sanity tests: node components/ai-scenarios/ai-scenarios.test.js
const M=require('./ai-scenarios.js');const cfg=require('./scenarios.json');const c=cfg.calibration;const assert=require('assert');
// psi=0 & md=0 baseline
let b=M.levelBlock(0,0.5,0.5,0.5,0.5,3,c);assert(Math.abs(b.sL-0.6)<1e-9&&Math.abs(b.dlnYL)<1e-9);
b=M.levelBlock(0.12,0,0,0,0.5,3,c);assert(Math.abs(b.sL-0.6)<1e-9&&Math.abs(b.dlnYL)<1e-6,'psi=0,a=0 baseline');
// labor share falls as psi rises with rho=0
let prev=1;for(const psi of [0,.25,.5,.75,1]){const r=M.levelBlock(.2,.5,psi,0,.5,3,c);assert(r.sL<=prev+1e-12);prev=r.sL}
// higher rho offsets
assert(M.levelBlock(.2,.5,.8,.6,.5,3,c).sL>M.levelBlock(.2,.5,.8,0,.5,3,c).sL);
// finite at extremes
const P=(o)=>Object.assign({},cfg.presets[2].paper,cfg.presets[2].illustrative,{sigma:.5,epsilon:3},cfg.extensions.defaults,o);
for(const o of [{m2030:.62,d2030:.95,a2030:1.5,psi:1,rho:0,sigma:.1,epsilon:.5},{m2030:.62,d2030:.95,a2030:1.5,psi:1,rho:1,sigma:.9,epsilon:20,feedback:1,reabsorption:.05},{m2030:.15,d2030:.11,a2026:0,a2030:0,psi:0,rho:0,power:30,chips:30,computeTax:50}]){const r=M.simulate(cfg,P(o));for(const y of r.years)for(const k in y)assert(isFinite(y[k]),k)}
// psi=0, a=0 path = baseline
const z=M.simulate(cfg,P({psi:0,a2026:0,a2030:0}));assert(Math.abs(z.last.gdpGap)<1e-6&&Math.abs(z.last.unemployment-3.8)<1e-6);
for(const p of cfg.presets){const r=M.simulate(cfg,Object.assign({},p.paper,p.illustrative,{sigma:.5,epsilon:3},cfg.extensions.defaults)).last;console.log(p.id,['gdpGap','growth','wage','laborShare','unemployment','tfp'].map(k=>k+' '+r[k].toFixed(1)+' (paper '+p.paperResults2030[k]+')').join(' | '))}
console.log('ALL TESTS PASSED');
