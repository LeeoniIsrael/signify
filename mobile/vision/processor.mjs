import { HandLandmarker } from '@mediapipe/tasks-vision';
import * as ort from 'onnxruntime-web/wasm';
import { normalizeRgba } from '../../src/lib/recognition.ts';

// Local models, local video frames. CSP blocks remote pages, uploads, and CDNs.
const files = new Map(), parts = new Map(), urls = [];
let hands, session, busy = false, stream, loopTimer, live = false, epoch = 0, lastVideoTime = -1, lastHand;
const tile = document.createElement('canvas'); tile.width = tile.height = 28;
const context = tile.getContext('2d', { willReadFrequently: true });
const video = document.createElement('video');
video.autoplay = true; video.muted = true; video.playsInline = true;
video.setAttribute('playsinline', '');
video.style.cssText = 'width:100%;height:100%;object-fit:cover;transform:scaleX(-1);position:absolute;inset:0;';
document.body.style.cssText = 'margin:0;background:#1A2520;overflow:hidden;width:100vw;height:100vh;';
document.body.appendChild(video);
const post = m => window.ReactNativeWebView.postMessage(JSON.stringify(m));
function bytes(base64) { const d = atob(base64), r = new Uint8Array(d.length); for (let i=0;i<d.length;i++) r[i]=d.charCodeAt(i); return r; }
function blob(name, type) { const u=URL.createObjectURL(new Blob([files.get(name)],{type})); urls.push(u); return u; }
async function initialize() {
  post({type:'status',state:'loading',message:'Starting hand tracking…'});
  hands=await HandLandmarker.createFromOptions({wasmLoaderPath:blob('mpLoader','text/javascript'),wasmBinaryPath:blob('mpWasm','application/wasm')},{
    baseOptions:{modelAssetBuffer:files.get('hands'),delegate:'CPU'},runningMode:'VIDEO',numHands:1,
    minHandDetectionConfidence:.65,minHandPresenceConfidence:.65,minTrackingConfidence:.65,
  });
  post({type:'status',state:'loading',message:'Starting letter recognition…'});
  ort.env.wasm.numThreads=1; ort.env.wasm.proxy=false;
  ort.env.wasm.wasmPaths={mjs:blob('ortLoader','text/javascript'),wasm:blob('ortWasm','application/wasm')};
  session=await ort.InferenceSession.create(files.get('cnn'),{executionProviders:['wasm'],graphOptimizationLevel:'all'});
  // Warm the small CNN before the first camera frame, rather than during the first sign.
  const tensor=new ort.Tensor('float32',new Float32Array(784),[1,1,28,28]);
  const output=await session.run({[session.inputNames[0]]:tensor}); tensor.dispose(); Object.values(output).forEach(t=>t.dispose());
  files.clear(); parts.clear(); post({type:'ready'});
}
function pause() {
  live=false; epoch++; clearTimeout(loopTimer);
  stream?.getTracks().forEach(t=>t.stop()); stream=undefined;
  video.srcObject=null; lastHand=undefined; lastVideoTime=-1;
}
async function startStream() {
  pause(); live=true; const run=epoch;
  try {
    if (!navigator.mediaDevices?.getUserMedia) throw new Error('Streaming is unavailable');
    const acquired=await navigator.mediaDevices.getUserMedia({audio:false,video:{facingMode:'user',width:{ideal:480},height:{ideal:640},frameRate:{ideal:30,max:30}}});
    if (!live || run!==epoch) { acquired.getTracks().forEach(t=>t.stop()); return; }
    stream=acquired; video.srcObject=stream; await video.play();
    if (!live || run!==epoch) return;
    post({type:'streamReady'}); void streamFrame(run);
  } catch (error) {
    if (live && run===epoch) { pause(); post({type:'streamUnavailable',reason:String(error?.message||error)}); }
  }
}
async function analyze(image, width, height, id, run) {
  const started=performance.now();
  post({type:'activity',phase:'tracking'});
  const detected=hands.detectForVideo(image,started);
  const landmarks=detected.landmarks[0]||[];
  const trackedAt=performance.now();
  const prediction={type:'prediction',id,logits:[],hasHand:landmarks.length===21,landmarks,width,height,motion:0,quality:'no-hand',detectorMs:trackedAt-started,cnnMs:0};
  if (landmarks.length===21) {
    const xs=landmarks.map(p=>p.x*width), ys=landmarks.map(p=>p.y*height);
    const minX=Math.min(...xs),maxX=Math.max(...xs),minY=Math.min(...ys),maxY=Math.max(...ys);
    const handWidth=maxX-minX,handHeight=maxY-minY;
    const margin=Math.max(24,handWidth*.22);
    const left=Math.max(0,minX-margin),top=Math.max(0,minY-margin),right=Math.min(width,maxX+margin),bottom=Math.min(height,maxY+margin);
    const scale=Math.max(.05,Math.hypot(landmarks[0].x-landmarks[9].x,landmarks[0].y-landmarks[9].y));
    if (lastHand) prediction.motion=Math.max(...landmarks.map((p,i)=>Math.hypot(p.x-lastHand[i].x,p.y-lastHand[i].y)))/scale;
    lastHand=landmarks;
    prediction.quality=minX<width*.01||maxX>width*.99||minY<height*.01||maxY>height*.99?'clipped':handWidth<40||handHeight<50?'too-small':prediction.motion>.24?'moving':'good';
    // Keep showing tracked joints when a sign isn't usable; never classify an incomplete hand crop.
    if (prediction.quality==='good' || prediction.quality==='moving') {
      post({type:'activity',phase:'classifying'});
      context.drawImage(image,left,top,right-left,bottom-top,0,0,28,28);
      const tensor=new ort.Tensor('float32',normalizeRgba(context.getImageData(0,0,28,28).data),[1,1,28,28]);
      let output; const cnnStart=performance.now();
      try { output=await session.run({[session.inputNames[0]]:tensor}); prediction.logits=Array.from(output[session.outputNames[0]].data); }
      finally { tensor.dispose(); if(output) Object.values(output).forEach(t=>t.dispose()); }
      prediction.cnnMs=performance.now()-cnnStart;
    }
  } else lastHand=undefined;
  if (run===epoch) post({...prediction,latencyMs:performance.now()-started});
}
async function streamFrame(run) {
  if (!live || run!==epoch) return;
  if (busy) { loopTimer=setTimeout(()=>void streamFrame(run),16); return; }
  const started=performance.now();
  if (video.readyState>=2 && video.currentTime!==lastVideoTime) {
    busy=true; lastVideoTime=video.currentTime;
    try { await analyze(video,video.videoWidth,video.videoHeight,undefined,run); }
    catch(error) { if (live && run===epoch) { post({type:'error',message:String(error?.message||error)}); pause(); } }
    finally { busy=false; }
  }
  // Aim for 12 fresh analyses/sec; inference gets backpressure, video preview stays native-rate.
  if (live && run===epoch) loopTimer=setTimeout(()=>void streamFrame(run),Math.max(0,83-(performance.now()-started)));
}
async function frame(payload) {
  if(busy||!session||!hands) return; busy=true; const run=epoch;
  try { const image=new Image(); image.src='data:image/jpeg;base64,'+payload.base64; await image.decode(); await analyze(image,image.naturalWidth,image.naturalHeight,payload.id,run); image.src=''; }
  finally {busy=false;}
}
window.SignifyVision={async receive(p){
  try {
    if(p.type==='begin')parts.set(p.name,[]);
    if(p.type==='part')parts.get(p.name).push(p.data);
    if(p.type==='end'){files.set(p.name,bytes(parts.get(p.name).join('')));parts.delete(p.name);}
    if(p.type==='initialize')await initialize();
    if(p.type==='stream')void startStream();
    if(p.type==='pause')pause();
    if(p.type==='frame')await frame(p);
    if(p.seq!==undefined)post({type:'ack',seq:p.seq});
  }catch(error){post({type:'error',message:String(error?.message||error)});}
}};
window.addEventListener('unload',()=>{pause();hands?.close();session?.release();urls.forEach(u=>URL.revokeObjectURL(u));});
post({type:'boot',version:2});
