// VE-01: scheduling/lifecycle only. VE-02 owns fixed timesteps and replay.
export function createFrameLoop({request,cancel,frame,onError=()=>{}}){
  if(typeof request!=='function'||typeof cancel!=='function'||typeof frame!=='function')
    throw new TypeError('FrameLoop requires request, cancel and frame');
  let running=false,disposed=false,pending=null,starts=0,frames=0;
  function tick(timestamp){
    pending=null;
    if(!running||disposed)return;
    try{frame(timestamp);frames++;}
    catch(error){running=false;onError(error);return;}
    if(running&&!disposed)pending=request(tick);
  }
  function start(){
    if(disposed)throw new Error('FrameLoop has been disposed');
    if(running)return false;
    running=true;starts++;
    try{pending=request(tick);}
    catch(error){running=false;throw error;}
    return true;
  }
  function stop(){
    if(!running)return false;
    running=false;
    if(pending!==null){cancel(pending);pending=null;}
    return true;
  }
  return {
    start,stop,dispose(){if(disposed)return;stop();disposed=true;},
    snapshot:()=>({running,disposed,pending:pending!==null,starts,frames})
  };
}
