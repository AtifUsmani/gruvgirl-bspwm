/*
##
##  Enhancer for YouTube™
##  =====================
##
##  Author: Maxime RF <https://www.mrfdev.com>
##
##  This file is protected by copyright laws and international copyright
##  treaties, as well as other intellectual property laws and treaties.
##
##  All rights not expressly granted to you are retained by the author.
##  Read the license.txt file for more details.
##
##  © MRFDEV.com - All Rights Reserved
##
*/
(function(){document.title="Enhancer for YouTube\u2122";var y=document.location.href.split("/pop-up-player/")[1],D=/playlist/.test(y),c=document.createElement("iframe");c.setAttribute("id","pop-up-player");c.setAttribute("allow","accelerometer;autoplay;encrypted-media;gyroscope;picture-in-picture");c.setAttribute("allowfullscreen","");c.setAttribute("src","https://www.youtube.com/embed/"+y);c.addEventListener("DOMContentLoaded",function(){document.title=c.contentDocument.title});c.addEventListener("load",
function(){var l=c.contentDocument.createElement("script");l.textContent="("+function(f,z){function E(){A.dispatchEvent(new Event("mouseover"));A.dispatchEvent(new Event("mouseout"));p||(p=e.querySelector(".ytp-tooltip:not(.ytp-efyt-tooltip)"));p&&""!==p.style.top&&(w.textContent=this.dataset.tooltip,g.style.display="block",g.style.top=p.style.top,g.style.left="loop"===this.id?this.parentNode.parentNode.parentNode.offsetLeft+"px":this.parentNode.parentNode.parentNode.offsetLeft+this.offsetLeft+this.offsetWidth/
2-g.getBoundingClientRect().width/2+"px")}function F(){g.style.display="none"}function B(d,x,m){var h=document.createElement("button"),q=document.createElementNS("http://www.w3.org/2000/svg","use"),a=document.createElementNS("http://www.w3.org/2000/svg","svg"),b=document.createElementNS("http://www.w3.org/2000/svg","path");h.className="ytp-button ytp-efyt-button";a.setAttributeNS(null,"version","1.1");a.setAttributeNS(null,"viewBox","0 0 36 36");a.setAttributeNS(null,"height","100%");a.setAttributeNS(null,
"width","100%");q.setAttribute("class","ytp-svg-shadow");q.setAttributeNS("http://www.w3.org/1999/xlink","href","#ytp-efyt-"+d);b.setAttributeNS(null,"id","ytp-efyt-"+d);b.setAttributeNS(null,"d",x);b.setAttributeNS(null,"fill","#fff");m&&b.setAttributeNS(null,"transform",m);a.appendChild(q);a.appendChild(b);h.appendChild(a);h.addEventListener("mouseover",E);h.addEventListener("mouseout",F);return h}var e=document.querySelector(".html5-video-player");if(e){var r=e.querySelector(".html5-main-video"),
C=e.querySelector(".ytp-title-text"),t=e.querySelector(".ytp-right-controls"),A=e.querySelector(".ytp-settings-button"),p=e.querySelector(".ytp-tooltip:not(.ytp-efyt-tooltip)"),w=document.createElement("span");w.className="ytp-tooltip-text";var k=document.createElement("div");k.appendChild(w);k.className="ytp-tooltip-text-wrapper";var g=document.createElement("div");g.appendChild(k);g.className="ytp-tooltip ytp-efyt-tooltip";g.style.display="none";e.appendChild(g);k=document.createDocumentFragment();
var u=B("screenshot","M 26.079999,10.02 H 22.878298 L 21.029999,8 h -6.06 l -1.8483,2.02 H 9.9200015 c -1.111,0 -2.02,0.909 -2.02,2.02 v 12.12 c 0,1.111 0.909,2.02 2.02,2.02 H 26.079999 c 1.111,0 2.019999,-0.909 2.019999,-2.02 V 12.04 c 0,-1.111 -0.909,-2.02 -2.019999,-2.02 z m 0,14.14 H 9.9200015 V 12.04 h 4.0904965 l 1.8483,-2.02 h 4.2824 l 1.8483,2.02 h 4.0905 z m -8.08,-11.11 c -2.7876,0 -5.05,2.2624 -5.05,5.05 0,2.7876 2.2624,5.05 5.05,5.05 2.7876,0 5.049999,-2.2624 5.049999,-5.05 0,-2.7876 -2.262399,-5.05 -5.049999,-5.05 z m 0,8.08 c -1.6665,0 -3.03,-1.3635 -3.03,-3.03 0,-1.6665 1.3635,-3.03 3.03,-3.03 1.6665,0 3.03,1.3635 3.03,3.03 0,1.6665 -1.3635,3.03 -3.03,3.03 z");
u.dataset.tooltip="Screenshot";u.id="efyt-screenshot";u.addEventListener("click",function(){if(r){var d=document.createElement("canvas"),x=d.getContext("2d"),m=r.clientWidth,h=r.clientHeight,q=function(a){var b=Math.floor(a/3600),n=Math.floor(a%3600/60);a=Math.floor(a%3600%60);return(0<b?b+"h":"")+(0<n?(0<b&&10>n?"0":"")+n+"m":0<b&&0===n?"00m":"0m")+(10>a?"0":"")+a+"s"}(parseInt(e.getCurrentTime(),10));d.width=m;d.height=h;x.drawImage(r,0,0,m,h);d.toBlob(function(a){var b=e.getVideoData(),n=b.author.replace(/[\\/:*?"<>|]+/g,
"").replace(/\s+/g," ").trim(),G=b.title.replace(/[\\/:*?"<>|]+/g,"").replace(/\s+/g," ").trim();b=b.video_id;var v=document.createElement("a");v.href=URL.createObjectURL(a);v.download=`${n} - ${G} [${b} - ${m}x${h} - ${q}].png`;v.click();URL.revokeObjectURL(v.href)})}});k.appendChild(u);if("Win32"===f||"Win64"===f)f=B("always-on-top","m 8.9100208,16.209245 1.1357702,1.107864 3.40731,3.323584 -3.096422,3.172343 -1.1082212,1.1354 1.1333272,1.105476 1.108223,-1.1354 3.096426,-3.172343 3.409753,3.32596 1.13577,1.10786 1.108217,-1.135397 1.10823,-1.135397 1.10585,-1.132969 -2.273983,-2.218097 2.44707,-2.507075 0.0022,0.0023 1.13577,1.107865 3.324668,-3.406198 -1.13577,-1.107864 L 19.139583,8 l -2.216444,2.270796 -1.108224,1.135401 1.13577,1.107856 0.0022,0.0023 -2.44707,2.50708 -2.273987,-2.218101 -1.105843,1.132962 -1.108223,1.135398 z m 2.2439942,-0.02752 1.108224,-1.135401 2.270878,2.215077 0.456606,-0.467802 9.41e-4,8.16e-4 4.204537,-4.307635 -1.133324,-1.105477 -0.0022,-0.0023 1.10822,-1.135397 5.678856,5.539298 -1.108227,1.135398 -1.135766,-1.107864 -4.204543,4.307638 9.41e-4,9.41e-4 -0.456607,0.467807 2.270878,2.215067 -1.108224,1.135403 z"),
f.dataset.tooltip="Always on top \ud83d\uddd7",f.id="efyt-always-on-top",f.addEventListener("click",function(){document.dispatchEvent(new Event("efyt-always-on-top"))}),k.appendChild(f);t&&!t.querySelector(".ytp-efyt-button")&&t.insertBefore(k,t.firstChild);C&&e.addEventListener("onStateChange",function(d){window.top.document.title=C.textContent+" - Enhancer for YouTube\u2122"});z&&(document.addEventListener("efyt-load-playlist",function(d){d=JSON.parse(d.detail).playlist;e.loadPlaylist(d.videos,
d.index,d.start)}),document.dispatchEvent(new Event("efyt-playlist")))}}.toString()+')("'+window.navigator.platform+'", '+D+")";c.contentDocument.addEventListener("efyt-playlist",function(){try{chrome.runtime.sendMessage({request:"playlist"})}catch(f){}});c.contentDocument.addEventListener("efyt-always-on-top",function(){try{chrome.runtime.sendMessage({request:"always-on-top"})}catch(f){}});c.contentDocument.head.appendChild(l);l.remove()},{once:!0});document.body.appendChild(c);chrome.runtime.onMessage.addListener(function(l,
f,z){"playlist"===l.message&&c.contentDocument.defaultView.document.dispatchEvent(new c.contentDocument.defaultView.CustomEvent("efyt-load-playlist",{detail:JSON.stringify({playlist:l.playlist})}))})})();