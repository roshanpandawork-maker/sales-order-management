
(function(){
  var path=location.pathname;
  var marker='/p/';
  var i=path.indexOf(marker);
  if(i!==-1){
    var slug=decodeURIComponent(path.slice(i+marker.length).replace(/\/+$/,''));
    if(slug){
      var base=path.slice(0,i);
      location.replace(base+'/p/?c='+encodeURIComponent(slug));
      return;
    }
  }
  document.body.innerHTML='<p style="font-family:system-ui;text-align:center;margin-top:20vh">Page not found.</p>';
})();

