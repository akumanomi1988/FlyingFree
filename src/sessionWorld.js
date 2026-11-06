// An unseeded visit is intentionally a different island. A URL ?seed=N is
// deterministic for screenshots, bugs, shared links and automated QA.
export function chooseSessionSeed(explicit=null,randomWord=null){
  if(Number.isInteger(explicit)&&explicit>=1&&explicit<=2147483647)return explicit;
  let word=randomWord;
  if(word===null){
    if(globalThis.crypto?.getRandomValues){
      const words=new Uint32Array(1);
      globalThis.crypto.getRandomValues(words);
      word=words[0];
    }else{
      word=Math.floor(Math.random()*4294967296);
    }
  }
  if(!Number.isFinite(word))throw new RangeError('Invalid world entropy');
  return (Math.floor(word)>>>0)%2147483647+1;
}
