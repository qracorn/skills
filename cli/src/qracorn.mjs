#!/usr/bin/env node
import {readFile} from 'node:fs/promises';
import packageMetadata from '../package.json' with {type:'json'};
import {generateCode} from './generate-command.mjs';
import {InputError,boundedFile,writeNew} from './io.mjs';
import {runPosterCheck} from './poster-command.mjs';
import {wifiFields} from './poster-core.mjs';
import {readImage} from './read.mjs';

const commands={
  read:{usage:'qracorn read IMAGE [--raw-output NEW.json]',formats:['PNG','JPEG','WebP'],limits:{imageMiB:12,megapixels:16,codes:20},output:'Text and corner positions in display pixels. When limitReached is true, inspect smaller sections for additional codes. Recognized Wi-Fi passwords are hidden in stdout. --raw-output saves the complete report locally.'},
  generate:{usage:'qracorn generate (--url URL | --text TEXT | [--url|--text] --input FILE|-) --output NEW.png|NEW.svg',output:'An 896px static QR code with a four-module margin. Text input is preserved, including trailing newlines.'},
  wifi:{usage:'qracorn wifi --input FILE|- --output NEW.png|NEW.svg',input:{ssid:'network name',security:'WPA | WEP | nopass',password:'required for WPA and WEP',hidden:'optional boolean'},output:'The QR image contains the network credentials. The JSON report contains the output path and format.'},
  check:{usage:'qracorn check IMAGE EXPECTED.json | qracorn check --batch MANIFEST.json',formats:['PNG','JPEG'],exitCodes:{0:'All expected links matched.',1:'The command could not run.',2:'The completed report contains issues or input errors.'}},
};

function usage(command) {
  if (command) return commands[command];
  return {name:'qracorn',usage:'qracorn <command> [options]',commands:Object.keys(commands),help:'qracorn <command> --help'};
}

function safeCode(code) {
  if (!/^WIFI:/i.test(code.text)) return code;
  // A malformed Wi-Fi payload can still contain a password with no network name.
  const pairs=wifiFields('WIFI:S:;'+code.text.slice(5));
  const fields=Object.fromEntries(Object.entries(pairs).map(([key,value])=>[key.toUpperCase(),value]));
  if (!Object.hasOwn(fields,'P')) return code;
  const wifi={password:'[hidden]'};
  if (fields.S) wifi.ssid=fields.S;
  if (fields.T!==undefined) wifi.security=fields.T;
  if (fields.H==='true' || fields.H==='false') wifi.hidden=fields.H==='true';
  return {...code,type:'wifi',text:null,redacted:true,wifi};
}

async function readCodes(args) {
  if (![1,3].includes(args.length) || args.length===3 && (args[1]!=='--raw-output' || !args[2])) {
    throw new InputError(commands.read.usage);
  }
  const image=await boundedFile(args[0],12*1024*1024,'image');
  const wasm=await readFile(new URL('./zxing_reader.wasm',import.meta.url));
  const report=await readImage(image,wasm);
  if (args.length===3) await writeNew(args[2],JSON.stringify(report)+'\n');
  return {...report,codes:report.codes.map(safeCode)};
}

async function execute(args) {
  const [command,...options]=args;
  if (!command || args.length===1 && command==='--help') return usage();
  if (args.length===1 && command==='--version') return {version:packageMetadata.version};
  if (!Object.hasOwn(commands,command)) throw new InputError('Unknown command. Use qracorn --help.');
  if (options.length===1 && options[0]==='--help') return usage(command);
  if (command==='read') return readCodes(options);
  if (command==='check') {
    const {report,status}=await runPosterCheck(options);
    process.exitCode=status;
    return report;
  }
  return generateCode(options,command==='wifi');
}

try {
  const report=await execute(process.argv.slice(2));
  console.log(JSON.stringify(report));
} catch (error) {
  const message=error instanceof InputError ? error.message : 'The command could not finish. Check the supplied files and try again.';
  console.error(JSON.stringify({error:message}));
  process.exitCode=1;
}
