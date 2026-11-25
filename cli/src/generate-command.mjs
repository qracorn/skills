import {generateStaticQr, webLink, wifiPayload} from './poster-core.mjs';
import {InputError, readUtf8, writeNew} from './io.mjs';
import {extname} from 'node:path';

function optionsFor(args, wifi) {
  const allowed = wifi ? ['--input','--output'] : ['--input','--output','--text','--url'];
  const options = {};
  for (let i=0; i<args.length; i++) {
    const key=args[i];
    if (!allowed.includes(key) || Object.hasOwn(options,key)) throw new InputError('Unknown or repeated option. Use the command help.');
    const next=args[i+1];
    if ((key==='--url' || key==='--text') && (next===undefined || allowed.includes(next))) {
      options[key]=true;
    } else {
      if (next===undefined || allowed.includes(next)) throw new InputError('An option is missing its value.');
      options[key]=next;
      i++;
    }
  }
  return options;
}

async function readContent(options) {
  const url=options['--url'], text=options['--text'], file=options['--input'];
  if (url!==undefined && text!==undefined) throw new InputError('Choose either URL or text input.');
  const literal=url ?? text;
  if (file!==undefined && typeof literal==='string') throw new InputError('Choose one input source.');
  const content=file===undefined ? literal : await readUtf8(file);
  if (typeof content!=='string' || !content.length) throw new InputError('Supply text or a URL, directly or through --input.');
  if (url!==undefined && !webLink(content)) throw new InputError('Supply a complete HTTP(S) URL without a username, password or spaces.');
  return content;
}

async function readWifi(filename) {
  if (!filename) throw new InputError('Supply Wi-Fi settings as UTF-8 JSON with --input FILE or --input -.');
  let config;
  const input=await readUtf8(filename);
  try {config=JSON.parse(input.replace(/^\uFEFF/,''));}
  catch {throw new InputError('The Wi-Fi input must contain valid JSON.');}
  if (!config || Array.isArray(config) || typeof config!=='object') throw new InputError('The Wi-Fi input must be a JSON object.');
  const {ssid,security,password='',hidden=false}=config;
  if (typeof ssid!=='string' || !ssid.length || ssid.length>128) throw new InputError('Supply a network name of 1–128 characters.');
  if (!['WPA','WEP','nopass'].includes(security)) throw new InputError('Choose WPA, WEP or nopass for security.');
  if (typeof password!=='string' || (security!=='nopass' && !password.length)) throw new InputError('Supply a password for WPA or WEP.');
  if (typeof hidden!=='boolean') throw new InputError('The hidden field must be true or false.');
  return wifiPayload(ssid,security,password,hidden);
}

export async function generateCode(args, wifi) {
  const options=optionsFor(args,wifi);
  const output=options['--output'];
  const format=typeof output==='string' ? extname(output).slice(1).toLowerCase() : '';
  if (!['png','svg'].includes(format)) throw new InputError('Choose a new output file ending in .png or .svg.');
  const content=wifi ? await readWifi(options['--input']) : await readContent(options);
  let code;
  try {code=await generateStaticQr(content);}
  catch {throw new InputError('The content could not fit in a QR code. Try a shorter input.');}
  const data=format==='svg' ? code.svg : Buffer.from(code.png.slice('data:image/png;base64,'.length), 'base64');
  await writeNew(output,data);
  return {output,format};
}
