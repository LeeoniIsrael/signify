// Shared with the browser integration test: the processor executes inside a real body.
export function processorHtml(source) {
  const csp =
    "default-src 'none'; script-src 'unsafe-inline' 'unsafe-eval' blob:; img-src data: blob:; connect-src blob:; worker-src blob:; media-src blob:; style-src 'unsafe-inline'";
  return `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="${csp}"></head><body><script>window.addEventListener('error',event=>window.ReactNativeWebView.postMessage(JSON.stringify({type:'error',message:event.message})));${source.replace(/<\/script/gi, "<\\/script")}</script></body></html>`;
}
