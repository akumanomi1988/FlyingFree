// Presentation adapter: DOM controls and picker know no Three.js or ecology.
export function createBrowserUI({document,window,location,events,birds,getBird,worldSeed,newSeed,actions}){
  const $=id=>document.getElementById(id);
  let bound=false;
  function refreshPicker(){
    const picker=$('bird-options');
    if(!picker)return;
    const currentBird=getBird();
    picker.replaceChildren();
    for(const bird of birds){
      const button=document.createElement('button');
      button.className='species-option'+(bird.id===currentBird.id?' selected':'');
      button.type='button';button.dataset.bird=bird.id;
      button.setAttribute('aria-pressed',String(bird.id===currentBird.id));
      const name=document.createElement('span');name.className='species-title';name.textContent=bird.name;
      const tag=document.createElement('span');tag.className='species-habitat';tag.textContent=bird.habitat;
      button.append(name,tag);
      picker.append(button);
    }
    $('bird-habitat').textContent=currentBird.habitat;
    $('bird-description').textContent=currentBird.detail;
    $('species-total').textContent=birds.length+' ESPECIES';
  }
  function bind(){
    if(bound)return false;
    bound=true;
    refreshPicker();
    const on=(target,name,callback,options)=>events.on(target,name,callback,options);
    const enterExperience=withLocation=>{
      $('intro').classList.add('off');
      void actions.audioToggle();
      if(withLocation)void actions.connectClimate(false);
    };
    on($('enter-btn'),'click',()=>enterExperience(true));
    on($('skip-location-btn'),'click',()=>enterExperience(false));
    on($('audio-btn'),'click',actions.audioToggle);
    on($('tv-audio'),'click',actions.audioToggle);
    on($('photo-btn'),'click',actions.photo);
    on($('tv-btn'),'click',()=>actions.setTVMode(!actions.tvActive()));
    on($('tv-exit'),'click',()=>actions.setTVMode(false));
    on($('weather-btn'),'click',()=>void actions.connectClimate(false));
    on($('tv-consent'),'click',()=>void actions.connectClimate(false));
    on($('help-btn'),'click',()=>$('help').classList.toggle('hidden'));
    on($('new-island'),'click',()=>{
      let next=newSeed();
      if(next===worldSeed)next=(next%2147483647)+1;
      const url=new URL(location.href);
      url.searchParams.set('seed',String(next));
      location.assign(url.href);
    });
    const toggleMap=()=>{
      const hidden=$('mini-map').classList.toggle('hidden');
      $('map-btn').setAttribute('aria-pressed',String(!hidden));
    };
    const toggleVitals=()=>{
      const hidden=document.body.classList.toggle('hide-bird-hud');
      $('hud-btn').setAttribute('aria-pressed',String(!hidden));
    };
    on($('map-btn'),'click',toggleMap);
    on($('hud-btn'),'click',toggleVitals);
    on($('close-help'),'click',()=>$('help').classList.add('hidden'));
    const picker=$('bird-picker');
    on($('bird-options'),'click',event=>{
      const selected=event.target?.closest?.('[data-bird]');
      if(selected&&$('bird-options').contains(selected))actions.selectBird(selected.dataset.bird);
    });
    on($('bird-btn'),'click',()=>picker.classList.toggle('hidden'));
    on($('close-birds'),'click',()=>picker.classList.add('hidden'));
    on(window,'pointermove',actions.revealTVControls,{passive:true});
    on(window,'focus',actions.revealTVControls);
    on(document,'visibilitychange',actions.visibilityChange);
    on(window,'keydown',event=>{
      if(event.ctrlKey||event.altKey||event.metaKey)return;
      const key=event.key.toLowerCase();
      if([' ','1','2','3','4','5','6','7','8','h','f','p','m','b','t','r','n','i','escape'].includes(key))event.preventDefault();
      actions.revealTVControls();
      switch(key){
        case '1':actions.setHour(actions.phase('dawn'));break;
        case '2':actions.setHour(actions.phase('noon'));break;
        case '3':actions.setHour(actions.phase('sunset'));break;
        case '4':actions.setHour(23);break;
        case '5':actions.changeWeather();break;
        case '6':actions.setTimeSpeed(1);break;
        case '7':actions.setTimeSpeed(60);break;
        case '8':actions.setTimeSpeed(600);break;
        case 'r':actions.resetTime();break;
        case ' ':actions.flap();break;
        case 'h':document.body.classList.toggle('no-ui');break;
        case 'n':toggleMap();break;
        case 'i':toggleVitals();break;
        case 't':actions.setTVMode(!actions.tvActive());break;
        case 'f':if(!document.fullscreenElement)document.documentElement.requestFullscreen?.().catch(()=>{});else document.exitFullscreen?.();break;
        case 'p':actions.photo();break;
        case 'm':void actions.audioToggle();break;
        case 'b':picker.classList.toggle('hidden');break;
        case 'escape':picker.classList.add('hidden');$('help').classList.add('hidden');break;
      }
    });
    return true;
  }
  return {bind,refreshPicker};
}
