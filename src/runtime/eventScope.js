// All DOM listeners installed by a runtime are owned by this scope.
export function createEventScope(){
  const subscriptions=[];let disposed=false;
  return {
    on(target,name,callback,options){
      if(disposed)throw new Error('EventScope has been disposed');
      target.addEventListener(name,callback,options);
      const remove=()=>target.removeEventListener(name,callback,options);
      subscriptions.push(remove);
      return remove;
    },
    dispose(){
      if(disposed)return;
      disposed=true;
      for(let i=subscriptions.length-1;i>=0;i--)subscriptions[i]();
      subscriptions.length=0;
    },
    get size(){return subscriptions.length;},
    get disposed(){return disposed;}
  };
}
