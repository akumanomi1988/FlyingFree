// Thin browser boundary. Tests may inject a synthetic host and clocks.
export function createBrowserEnvironment(host=globalThis){
  return {
    window:host,document:host.document,location:host.location,navigator:host.navigator,
    width:()=>host.innerWidth,height:()=>host.innerHeight,
    now:()=>host.performance.now(),epoch:()=>Date.now(),
    raf:callback=>host.requestAnimationFrame(callback),
    caf:id=>host.cancelAnimationFrame(id),
    setTimeout:(callback,ms)=>host.setTimeout(callback,ms),
    clearTimeout:id=>host.clearTimeout(id)
  };
}
