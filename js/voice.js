/* SalesDesk Local Voice Agent — ₹0 test mode
 * No OpenAI/API key required.
 * Uses browser SpeechRecognition + Supabase RPC + browser speechSynthesis.
 */
(function(){
  "use strict";
  const $=id=>document.getElementById(id);
  let recognition=null, listening=false;

  const norm=s=>String(s||"").toLowerCase().replace(/[^a-z0-9]+/g," ").trim();

  function openVoice(){
    document.querySelectorAll("main section, .wrap > section").forEach(s=>s.classList.add("hidden"));
    $("voiceAssistant")?.classList.remove("hidden");
    $("voiceStatus").textContent="Ready";
  }

  function findParty(text){
    const n=norm(text);
    const exact=db.parties.find(p=>norm(p.name)===n);
    if(exact)return exact;
    return db.parties.slice().sort((a,b)=>norm(b.name).length-norm(a.name).length)
      .find(p=>n.includes(norm(p.name)) || norm(p.name).includes(n));
  }

  function findProduct(text){
    const n=norm(text);
    const exact=db.products.find(p=>norm(p.name)===n || norm(p.code)===n);
    if(exact)return exact;
    const aliases={
      "eastern":"Eastern tin",
      "eastern tin":"Eastern tin",
      "sri khetra tin":"SRIKHETRA TIN",
      "sri kshetra tin":"SRIKHETRA TIN",
      "sri khetra":"SRIKHETRA TIN",
      "sri khetra pouch":"SRIKHETRA POUCH",
      "pouch":"SRIKHETRA POUCH",
      "tin":"SRIKHETRA TIN"
    };
    const alias=aliases[n];
    if(alias){const p=db.products.find(x=>norm(x.name)===norm(alias));if(p)return p;}
    return db.products.slice().sort((a,b)=>norm(b.name).length-norm(a.name).length)
      .find(p=>n.includes(norm(p.name)) || norm(p.name).includes(n));
  }

  function parseCommand(text){
    const raw=String(text||"").trim(), n=norm(raw);
    if(!n)return {intent:"unknown"};
    const wantsAvailable=/\b(available|balance|left|remaining|outstanding|stock)\b/.test(n);
    const wantsQty=/\b(how much|how many|quantity|qty)\b/.test(n);
    const party=findParty(raw);
    let product=null;
    if(party){
      const withoutParty=n.replace(norm(party.name),"").trim();
      product=findProduct(withoutParty);
    }else{
      product=findProduct(raw);
    }
    if((wantsAvailable||wantsQty) && party)return {intent:"available_qty",party:party.name,product:product?.name||null};
    return {intent:"unknown",party:party?.name||null,product:product?.name||null};
  }

  async function runCommand(text){
    $("voiceTranscript").textContent='You: "'+text+'"';
    $("voiceStatus").textContent="Checking SalesDesk data…";
    $("voiceAnswer").textContent="";
    const cmd=parseCommand(text);
    if(cmd.intent!=="available_qty"){
      const msg="Try: How much Eastern tin is available for Kasturi Traders?";
      $("voiceStatus").textContent="I didn't understand";
      $("voiceAnswer").textContent=msg;
      speak(msg);
      return;
    }
    try{
      const {data,error}=await supabaseClient.rpc("get_party_stock_voice",{
        p_party_name:cmd.party,
        p_product_name:cmd.product
      });
      if(error)throw error;
      const products=Array.isArray(data?.products)?data.products:[];
      if(!products.length){
        const msg=cmd.product
          ? cmd.party+" has no available quantity for "+cmd.product+"."
          : "There is no available quantity for "+cmd.party+".";
        $("voiceStatus").textContent="Completed";
        $("voiceAnswer").textContent=msg;
        speak(msg);
        return;
      }
      const lines=products.map(p=>p.product_name+" "+fmt(p.available)+" "+p.unit);
      const msg=cmd.product
        ? cmd.party+" has "+lines[0]+" available."
        : cmd.party+" has "+lines.join(", ")+" available.";
      $("voiceStatus").textContent="Completed";
      $("voiceAnswer").textContent=msg;
      speak(msg);
    }catch(e){
      console.error("Voice agent:",e);
      const msg="I could not read the SalesDesk data. "+(e.message||"Please try again.");
      $("voiceStatus").textContent="Error";
      $("voiceAnswer").textContent=msg;
      speak(msg);
    }
  }

  function speak(text){
    if(!("speechSynthesis" in window))return;
    window.speechSynthesis.cancel();
    const u=new SpeechSynthesisUtterance(text);
    u.lang="en-IN";u.rate=.95;
    window.speechSynthesis.speak(u);
  }

  function startListening(){
    const SR=window.SpeechRecognition||window.webkitSpeechRecognition;
    if(!SR){
      $("voiceStatus").textContent="Speech input unavailable";
      $("voiceAnswer").textContent="Your browser does not provide SpeechRecognition. Use Chrome/Edge or type the test command below.";
      return;
    }
    if(listening){recognition?.stop();return;}
    recognition=new SR();
    recognition.lang="en-IN";
    recognition.interimResults=false;
    recognition.maxAlternatives=1;
    recognition.onstart=()=>{listening=true;$("voiceStatus").textContent="Listening…";$("voiceStart").textContent="Stop listening";};
    recognition.onerror=e=>{$("voiceStatus").textContent="Voice error: "+e.error;};
    recognition.onend=()=>{listening=false;$("voiceStart").textContent="Start listening";};
    recognition.onresult=e=>runCommand(e.results[0][0].transcript);
    recognition.start();
  }

  function addTestControls(){
    const panel=$("voiceAssistant")?.querySelector(".panel");if(!panel||$("voiceTestInput"))return;
    const wrap=document.createElement("div");
    wrap.style.cssText="margin-top:14px;display:flex;gap:8px;flex-wrap:wrap";
    wrap.innerHTML='<input id="voiceTestInput" style="flex:1;min-width:240px" placeholder="Type a command to test without microphone" value="How much Eastern tin is available for Kasturi Traders?"><button class="secondary" id="voiceTestRun" type="button">Run test</button>';
    panel.insertBefore(wrap,$("voiceStart"));
    $("voiceTestRun").onclick=()=>runCommand($("voiceTestInput").value);
  }

  document.addEventListener("DOMContentLoaded",()=>{
    $("voiceBtn")?.addEventListener("click",()=>{openVoice();addTestControls()});
    $("mobileVoiceFab")?.addEventListener("click",()=>{openVoice();addTestControls()});
    $("voiceStart")?.addEventListener("click",startListening);
  });
})();
